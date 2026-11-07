"""
Realtime layer: the three TDX bus feeds, mapped to what the four screens need.

  N1  /v2/Bus/EstimatedTimeOfArrival  預估到站 — seconds to this stop, StopStatus
  A2  /v2/Bus/RealTimeNearStop        到離站事件 — StopSequence + A2EventType
  A1  /v2/Bus/RealTimeByFrequency     車輛即時位置 — BusPosition (WGS84)

Codes below are quoted from the live spec, not from memory:
  N1 StopStatus  0 正常 / 1 尚未發車 / 2 交管不停靠 / 3 末班車已過 / 4 今日未營運
  N1 PlateNumb   "-1" means no vehicle is currently assigned to this row
  A2 A2EventType 0 離站 / 1 進站
  Direction      0 去程 / 1 返程 / 2 迴圈 / 10 循環線 / 255 未知
"""
from datetime import datetime, timedelta, timezone

from app import catalog, config
from app.cache import cache
from app.geo import haversine_m
from app.models import ArrivalUpdate, BoardCheck, BusStop, RidePosition, RouteOption, RouteStop
from app.tdx import tdx

_CITY = config.CITY
_NO_SERVICE_STATUS = {1, 2, 3, 4}


def _parse_time(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _plate(row: dict) -> str | None:
    plate = row.get("PlateNumb")
    # N1 uses "-1" as "no bus on this row"; A1/A2 always carry a real plate.
    return plate if isinstance(plate, str) and plate and plate != "-1" else None


def _position(row: dict) -> tuple[float, float] | None:
    pos = row.get("BusPosition") or {}
    lat, lng = pos.get("PositionLat"), pos.get("PositionLon")
    if lat is None or lng is None:
        return None
    return float(lat), float(lng)


def _route_label(row: dict, index: dict[str, "catalog.RouteInfo"]) -> str:
    """Readable route name for an A1/A2 row, preferring our cached catalog."""
    info = index.get(row.get("RouteUID") or "")
    if info is not None and info.name:
        return info.name
    name = row.get("RouteName")
    if isinstance(name, dict) and name.get("Zh_tw"):
        return str(name["Zh_tw"])
    return "別的路線"


# --- feeds ---------------------------------------------------------------
async def _n1_at_station(station: catalog.Station) -> list[dict]:
    """Every route+direction serving this station, with its ETA. One call."""
    rows = await tdx.get_cached(
        f"n1:{_CITY}:{station.uid}",
        f"/v2/Bus/EstimatedTimeOfArrival/City/{_CITY}",
        {"$filter": catalog.stop_uid_filter(station.stop_uids)},
        ttl=config.TTL_REALTIME,
    )
    return rows if isinstance(rows, list) else []


async def _a2_for_route(route_name: str) -> list[dict]:
    rows = await tdx.get_cached(
        f"a2:{_CITY}:{route_name}",
        f"/v2/Bus/RealTimeNearStop/City/{_CITY}/{route_name}",
        ttl=config.TTL_REALTIME,
    )
    return rows if isinstance(rows, list) else []


async def _a1_city() -> list[dict]:
    """
    City-wide vehicle positions, trimmed with $select.

    City-wide rather than per-route because the boarding check has to notice a
    bus the user did *not* mean to board, and one shared copy per TTL is far
    cheaper than a per-route call per phone.
    """
    rows = await tdx.get_cached(
        f"a1:{_CITY}",
        f"/v2/Bus/RealTimeByFrequency/City/{_CITY}",
        {"$select": "PlateNumb,RouteUID,RouteName,Direction,BusPosition,BusStatus"},
        ttl=config.TTL_REALTIME,
    )
    return rows if isinstance(rows, list) else []


# --- step 1: pick a stop and a route -------------------------------------
async def nearest_stop(lat: float, lng: float) -> BusStop:
    station = await catalog.nearest_station(lat, lng)
    return BusStop(id=station.uid, name=station.name, lat=station.lat, lng=station.lng)


async def routes_at_station(station: catalog.Station) -> list[RouteOption]:
    """
    One entry per route+direction that stops here.

    Direction comes from the N1 rows: Station/Stops carries no direction, and N1
    returns a row per route+direction even when no bus is running (PlateNumb -1).
    """
    rows = await _n1_at_station(station)
    index = await catalog.routes()
    best: dict[tuple[str, int], int | None] = {}

    for row in rows:
        uid, direction = row.get("RouteUID"), row.get("Direction")
        if not uid or direction not in (0, 1):
            continue
        if int(row.get("StopStatus") or 0) in _NO_SERVICE_STATUS:
            best.setdefault((uid, direction), None)
            continue
        eta = row.get("EstimateTime")
        eta = int(eta) if isinstance(eta, (int, float)) else None
        key = (uid, direction)
        current = best.get(key, "missing")
        if current == "missing" or current is None or (eta is not None and eta < current):
            best[key] = eta

    options: list[RouteOption] = []
    for (uid, direction), eta in best.items():
        info = index.get(uid)
        if info is None or not info.name:
            continue
        # 552 direction 0 terminates at 捷運市政府站: a rider standing there cannot
        # ride it anywhere. Offering it and then failing on the next screen is a
        # dead end, which is far worse for someone navigating by ear.
        if not await _has_onward_stops(uid, direction, station):
            continue
        options.append(
            RouteOption(
                routeId=uid,
                routeName=info.name,
                direction=direction,  # type: ignore[arg-type]
                headsign=await catalog.headsign(uid, direction),
                etaSec=eta,
            )
        )
    # Buses that are actually coming first; routes with no service last.
    options.sort(key=lambda o: (o.etaSec is None, o.etaSec or 0, o.routeName))
    return options


async def _has_onward_stops(route_uid: str, direction: int, station: catalog.Station) -> bool:
    """Is there anywhere to go from this station on this route+direction?"""
    try:
        stops = await catalog.stops_of_route(route_uid, direction)
    except Exception:
        return True  # Unknown: keep the route rather than hide a usable one.
    here = set(station.stop_uids)
    for i, stop in enumerate(stops):
        if stop["stopUid"] in here:
            return i + 1 < len(stops)
    return False


async def stops_after(route_uid: str, direction: int, from_station: catalog.Station) -> list[RouteStop]:
    stops = await catalog.stops_of_route(route_uid, direction)
    here = set(from_station.stop_uids)
    start = next((i for i, s in enumerate(stops) if s["stopUid"] in here), None)
    if start is None:
        return []
    return [RouteStop(stopId=s["stopUid"], name=s["name"], seq=s["seq"]) for s in stops[start + 1 :]]


# --- step 2: waiting at the stop -----------------------------------------
async def arrival(station: catalog.Station, route_uid: str, direction: int) -> ArrivalUpdate:
    rows = await _n1_at_station(station)
    index = await catalog.routes()
    info = index.get(route_uid)
    here = set(station.stop_uids)

    mine = [
        r
        for r in rows
        if r.get("RouteUID") == route_uid
        and r.get("Direction") == direction
        and r.get("StopUID") in here
    ]

    # Of the station's stops for this route+direction, trust the soonest ETA.
    # A row with no ETA still tells us the StopStatus (尚未發車 / 末班車已過 …).
    def eta_of(row: dict) -> int | None:
        value = row.get("EstimateTime")
        return int(value) if isinstance(value, (int, float)) else None

    best = min(mine, key=lambda r: (eta_of(r) is None, eta_of(r) or 0), default=None)
    eta = eta_of(best) if best else None
    stop_status = int((best or {}).get("StopStatus") or 0)

    # Taipei's N1 feed leaves PlateNumb and StopSequence null on every row, so the
    # plate can only come from A2, which reports it with each enter/leave event.
    # That is enough for what it is used for: we need the plate at the moment the
    # bus pulls in, to follow that vehicle for the boarding check.
    event, plate = (None, None)
    if info is not None and info.name:
        event, plate = await _latest_stop_event(info.name, route_uid, direction, station)

    # Another route pulling in right now, so we can say "這不是你的車".
    other_arriving: list[str] = []
    for row in rows:
        uid = row.get("RouteUID")
        if not uid or uid == route_uid or row.get("StopUID") not in here:
            continue
        value = row.get("EstimateTime")
        if not isinstance(value, (int, float)) or value > config.OTHER_ARRIVING_SEC:
            continue
        name = (index.get(uid).name if index.get(uid) else "") or ""
        if name and name not in other_arriving:
            other_arriving.append(name)

    status = _arrival_status(event, eta, stop_status)
    return ArrivalUpdate(
        etaSec=eta,
        status=status,
        plate=plate,
        otherArriving=other_arriving,
        lowFloor=await catalog.is_low_floor(plate),
    )


def _arrival_status(event: int | None, eta: int | None, stop_status: int) -> str:
    if stop_status in _NO_SERVICE_STATUS:
        return "no_service"
    if event == 1:   # 進站
        return "at_stop"
    if event == 0:   # 離站
        return "departed"
    if eta is None:
        return "no_service"
    if eta <= 30:
        return "arriving"
    return "coming"


async def _latest_stop_event(
    route_name: str, route_uid: str, direction: int, station: catalog.Station
) -> tuple[int | None, str | None]:
    """
    Freshest A2 enter/leave event for this route+direction at this station,
    as `(A2EventType, PlateNumb)`. Both are None when no bus has reached the
    stop recently, which is the normal case while the rider is still waiting.
    """
    here = set(station.stop_uids)
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=config.A2_EVENT_FRESH_SEC)
    latest_at: datetime | None = None
    latest: dict | None = None

    for row in await _a2_for_route(route_name):
        if row.get("RouteUID") != route_uid or row.get("Direction") != direction:
            continue
        if row.get("StopUID") not in here:
            continue
        at = _parse_time(row.get("GPSTime")) or _parse_time(row.get("UpdateTime"))
        if at is None or at < cutoff:
            continue
        if latest_at is None or at > latest_at:
            latest_at, latest = at, row
    if latest is None:
        return None, None
    event = latest.get("A2EventType")
    return (event if isinstance(event, int) else None), _plate(latest)


# --- step 3: did I board the right bus? ----------------------------------
async def board_check(route_uid: str, direction: int, plate: str | None, lat: float, lng: float) -> BoardCheck:
    index = await catalog.routes()
    info = index.get(route_uid)
    route_name = (info.name if info else "") or "這條路線"

    mine: tuple[float, str] | None = None   # (distance, plate)
    other: tuple[float, str] | None = None  # (distance, route name)

    for row in await _a1_city():
        pos = _position(row)
        bus_plate = _plate(row)
        if pos is None or bus_plate is None:
            continue
        distance = haversine_m(lat, lng, pos[0], pos[1])
        if row.get("RouteUID") == route_uid:
            # A1 Direction is nullable; an unknown direction still counts as ours.
            row_direction = row.get("Direction")
            if row_direction is not None and row_direction not in (direction, 2, 10, 255):
                continue
            # Trust the plate we noted when the bus pulled in, if we have one.
            if plate and bus_plate != plate:
                continue
            if mine is None or distance < mine[0]:
                mine = (distance, bus_plate)
        elif other is None or distance < other[0]:
            other = (distance, _route_label(row, index))

    if mine is None:
        return BoardCheck(
            onBus=False,
            reason=f"現在查不到 {route_name} 的車輛位置，可能是車上定位還沒更新。再等一下，或按一次重新確認。",
        )
    # Only warn about another bus when the user is actually next to it. Merely
    # being *closer* to some other route is not evidence of boarding it: standing
    # 3 km from every 藍10 would otherwise announce "you are on the wrong bus".
    if (
        other is not None
        and other[0] <= config.BOARD_RADIUS_M
        and other[0] + config.WRONG_BUS_MARGIN_M < mine[0]
    ):
        return BoardCheck(
            onBus=False,
            reason=f"你的位置正在跟著 {other[1]} 的車移動，可能搭錯車了。建議下一站就下車。",
        )
    if mine[0] <= config.BOARD_RADIUS_M:
        return BoardCheck(onBus=True, plate=mine[1])
    return BoardCheck(
        onBus=False,
        reason=f"你的位置離 {route_name} 的車還有大約 {round(mine[0] / 10) * 10} 公尺，可能還沒上車。",
    )


# --- step 4: where is my bus now? ----------------------------------------
async def ride_position(route_uid: str, direction: int, plate: str) -> RidePosition | None:
    info = await catalog.route_info(route_uid)
    if info is None or not info.name:
        return None

    # A2 is the precise source: it carries the stop sequence directly.
    latest_at: datetime | None = None
    latest: dict | None = None
    for row in await _a2_for_route(info.name):
        if row.get("PlateNumb") != plate or row.get("RouteUID") != route_uid:
            continue
        if row.get("Direction") not in (direction, None, 2, 10, 255):
            continue
        at = _parse_time(row.get("GPSTime")) or _parse_time(row.get("UpdateTime"))
        if at is None:
            continue
        if latest_at is None or at > latest_at:
            latest_at, latest = at, row
    if latest is not None:
        return RidePosition(
            plate=plate,
            seq=int(latest.get("StopSequence") or 0),
            atStop=latest.get("A2EventType") == 1,
        )

    # Fallback: no enter/leave event yet, so place the bus by its A1 position.
    return await _ride_position_from_a1(route_uid, direction, plate)


async def _ride_position_from_a1(route_uid: str, direction: int, plate: str) -> RidePosition | None:
    position: tuple[float, float] | None = None
    for row in await _a1_city():
        if row.get("PlateNumb") == plate and row.get("RouteUID") == route_uid:
            position = _position(row)
            break
    if position is None:
        return None
    stops = await catalog.stops_of_route(route_uid, direction)
    located = [s for s in stops if s["lat"] is not None and s["lng"] is not None]
    if not located:
        return None
    nearest = min(located, key=lambda s: haversine_m(position[0], position[1], s["lat"], s["lng"]))
    distance = haversine_m(position[0], position[1], nearest["lat"], nearest["lng"])
    return RidePosition(plate=plate, seq=int(nearest["seq"]), atStop=distance <= 40)


def clear_caches() -> None:
    cache.clear()
