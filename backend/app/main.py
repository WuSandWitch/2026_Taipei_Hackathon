"""
Bussistant API — proxies TDX bus data for the 公車幫 micro-service page.

The HTTP contract is the one documented in frontend/README.md: the frontend's
`src/data/api.ts` talks to exactly these six paths and expects the shapes in
`src/data/types.ts`. The TDX key stays here and never reaches the phone, and one
cached copy of each realtime feed is shared by every client.
"""
import asyncio
import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app import catalog, config, realtime
from app.models import ArrivalUpdate, BoardCheck, BusStop, RidePosition, RouteOption, RouteStop
from app.tdx import TdxError, tdx

log = logging.getLogger("bus-assist")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await tdx.start()
    if not tdx.configured:
        log.warning("TDX_CLIENT_ID / TDX_CLIENT_SECRET 未設定，所有資料端點都會回 503")
    # The city-wide stop sequences take ~13 s to fetch. Warm them in the
    # background so the service is ready immediately and the first rider is not
    # the one waiting; single-flight means a request arriving meanwhile joins
    # this load instead of starting a second one.
    warm = asyncio.create_task(catalog.warm_up()) if tdx.configured else None
    try:
        yield
    finally:
        if warm is not None:
            warm.cancel()
        await tdx.close()


app = FastAPI(
    title="Bussistant API",
    version="0.1.0",
    description="Bussistant 公車幫的後端。資料來源：TDX 運輸資料流通服務。",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _upstream(exc: TdxError) -> HTTPException:
    """TDX problems are 503: the frontend keeps its last state and retries."""
    log.warning("tdx error: %s", exc)
    return HTTPException(status_code=503, detail=str(exc))


async def _station(stop_id: str) -> catalog.Station:
    try:
        station = await catalog.station_by_id(stop_id)
    except TdxError as exc:
        raise _upstream(exc) from exc
    if station is None:
        raise HTTPException(status_code=404, detail=f"找不到站位 {stop_id}")
    return station


# 對外一律用 /health：Cloud Run 的 Google 前端會把 run.app 網域上的 /healthz 直接回
# 自己的 404 HTML，請求根本到不了容器。2026/11/07 在本服務實測過，被攔的只有
# /healthz 這個路徑本身——/livez、/readyz、/fooz 都正常進到 FastAPI，所以不是
# 「所有 z 結尾路徑」都不能用（網路上常見的說法比實際情況誇大）。
# /healthz 仍然保留著，因為 Cloud Run 自己的 startup/liveness probe 是直連容器的。
@app.get("/health")
@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict:
    return {"ok": True, "city": config.CITY, "tdxConfigured": tdx.configured}


@app.get("/stops/nearest", response_model=BusStop)
async def stops_nearest(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> BusStop:
    try:
        return await realtime.nearest_stop(lat, lng)
    except TdxError as exc:
        raise _upstream(exc) from exc


@app.get("/stops/{stop_id}/routes", response_model=list[RouteOption])
async def stop_routes(stop_id: str) -> list[RouteOption]:
    station = await _station(stop_id)
    try:
        return await realtime.routes_at_station(station)
    except TdxError as exc:
        raise _upstream(exc) from exc


@app.get("/routes/{route_id}/stops", response_model=list[RouteStop])
async def route_stops(
    route_id: str,
    direction: int = Query(..., ge=0, le=1),
    from_: str = Query(..., alias="from", description="上車站的 stopId（站位 StationUID）"),
) -> list[RouteStop]:
    station = await _station(from_)
    try:
        stops = await realtime.stops_after(route_id, direction, station)
    except TdxError as exc:
        raise _upstream(exc) from exc
    if not stops:
        raise HTTPException(
            status_code=404,
            detail="這條路線在這個方向查不到這一站之後的站序，請換一個方向或路線。",
        )
    return stops


@app.get("/arrivals", response_model=ArrivalUpdate)
async def arrivals(
    routeId: str,
    direction: int = Query(..., ge=0, le=1),
    stopId: str = Query(...),
) -> ArrivalUpdate:
    station = await _station(stopId)
    try:
        return await realtime.arrival(station, routeId, direction)
    except TdxError as exc:
        raise _upstream(exc) from exc


@app.get("/board-check", response_model=BoardCheck)
async def board_check(
    routeId: str,
    direction: int = Query(..., ge=0, le=1),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    plate: str | None = None,
) -> BoardCheck:
    try:
        return await realtime.board_check(routeId, direction, plate, lat, lng)
    except TdxError as exc:
        raise _upstream(exc) from exc


@app.get("/buses/{plate}", response_model=RidePosition)
async def bus_position(
    plate: str,
    routeId: str,
    direction: int = Query(..., ge=0, le=1),
) -> RidePosition:
    try:
        position = await realtime.ride_position(routeId, direction, plate)
    except TdxError as exc:
        raise _upstream(exc) from exc
    if position is None:
        raise HTTPException(status_code=404, detail=f"查不到車牌 {plate} 的即時位置")
    return position
