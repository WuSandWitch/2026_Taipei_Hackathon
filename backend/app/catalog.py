"""
Slow-changing TDX data: bus stations, route headsigns, stop sequences, vehicles.

The Bus APIs have no `$spatialFilter`, so "nearest stop" is computed here: the
city's station list is fetched once and kept in memory, then scanned with
haversine. Taipei has a few thousand stations, so a scan costs well under a
millisecond and avoids an upstream call per request.

TDX vocabulary (the two are easy to mix up):
  Station (站位) — the physical place a person stands; groups both directions.
  Stop    (站牌) — one route+direction at that place. Realtime data is keyed by
                   StopUID, so a station maps to several StopUIDs.
We hand the frontend the StationUID as its `stopId` and resolve it back to
StopUIDs here, so the user picks "this stop" once and direction comes later.
"""
from dataclasses import dataclass, field

from app import config
from app.cache import cache
from app.geo import haversine_m
from app.tdx import TdxError, odata_str, tdx

_CITY = config.CITY


@dataclass(frozen=True)
class Station:
    uid: str
    name: str
    lat: float
    lng: float
    stop_uids: tuple[str, ...]
    route_names: tuple[str, ...] = field(default=())


@dataclass(frozen=True)
class RouteInfo:
    uid: str
    name: str
    departure: str
    destination: str
    departure_en: str = ""
    destination_en: str = ""

    def headsign(self, direction: int) -> str:
        """Where a bus in this direction is going (0 = 去程, 1 = 返程)."""
        return self.departure if direction == 1 else self.destination


def _zh(name: object) -> str:
    """TDX NameType -> 繁中名稱."""
    if isinstance(name, dict):
        return str(name.get("Zh_tw") or name.get("En") or "")
    return str(name or "")


def _en(name: object) -> str:
    """
    TDX NameType -> English, empty when TDX has none.

    Only used for speech. The screen always shows the Chinese name, because the
    rider has to match it against the physical stop sign; a speech engine set to
    vi/th/fil cannot pronounce Chinese characters at all, so the spoken form
    needs a romanised one. Two channels, two forms of the same name.
    """
    return str(name.get("En") or "") if isinstance(name, dict) else ""


# --- stations ------------------------------------------------------------
async def _load_stations() -> list[Station]:
    rows = await tdx.get(
        f"/v2/Bus/Station/City/{_CITY}",
        {"$select": "StationUID,StationName,StationPosition,Stops"},
    )
    stations: list[Station] = []
    for row in rows if isinstance(rows, list) else []:
        pos = row.get("StationPosition") or {}
        lat, lng = pos.get("PositionLat"), pos.get("PositionLon")
        if lat is None or lng is None:
            continue
        stops = row.get("Stops") or []
        stop_uids = tuple(dict.fromkeys(s["StopUID"] for s in stops if s.get("StopUID")))
        if not stop_uids:
            continue
        route_names = tuple(dict.fromkeys(_zh(s.get("RouteName")) for s in stops if s.get("RouteName")))
        stations.append(
            Station(
                uid=row["StationUID"],
                name=_zh(row.get("StationName")),
                lat=float(lat),
                lng=float(lng),
                stop_uids=stop_uids,
                route_names=route_names,
            )
        )
    if not stations:
        raise TdxError(f"TDX 沒有回傳 {_CITY} 的公車站位資料")
    return stations


async def stations() -> list[Station]:
    return await cache.get(f"stations:{_CITY}", config.TTL_STATIC, _load_stations)


async def nearest_station(lat: float, lng: float) -> Station:
    rows = await stations()
    return min(rows, key=lambda s: haversine_m(lat, lng, s.lat, s.lng))


async def station_by_id(station_uid: str) -> Station | None:
    for s in await stations():
        if s.uid == station_uid:
            return s
    return None


# --- routes --------------------------------------------------------------
async def _load_routes() -> dict[str, RouteInfo]:
    rows = await tdx.get(
        f"/v2/Bus/Route/City/{_CITY}",
        {
            "$select": "RouteUID,RouteName,DepartureStopNameZh,DestinationStopNameZh,"
            "DepartureStopNameEn,DestinationStopNameEn"
        },
    )
    index: dict[str, RouteInfo] = {}
    for row in rows if isinstance(rows, list) else []:
        uid = row.get("RouteUID")
        if not uid:
            continue
        index[uid] = RouteInfo(
            uid=uid,
            name=_zh(row.get("RouteName")),
            departure=str(row.get("DepartureStopNameZh") or ""),
            destination=str(row.get("DestinationStopNameZh") or ""),
            departure_en=str(row.get("DepartureStopNameEn") or ""),
            destination_en=str(row.get("DestinationStopNameEn") or ""),
        )
    return index


async def routes() -> dict[str, RouteInfo]:
    return await cache.get(f"routes:{_CITY}", config.TTL_STATIC, _load_routes)


async def route_info(route_uid: str) -> RouteInfo | None:
    return (await routes()).get(route_uid)


# --- stop sequence of every route (one city-wide fetch) ---
async def _load_stop_sequences() -> dict[tuple[str, int], list[dict]]:
    """
    Build `(RouteUID, Direction) -> ordered stops` for the whole city in one call.

    Per-route `/StopOfRoute/City/{City}/{RouteName}` calls were the first design
    and measured 49 s to label the 17 routes of one station, because a station
    listing needs every route's terminus at once. The city-wide call costs ~13 s
    and ~13 MB once, then every route lookup and every stop list is free, so it
    is warmed in the background at startup instead.

    One route+direction can return several rows, one per 附屬路線: 藍5 comes back as
    the main line (23 stops) plus variants including a "藍5返程半" row with a single
    stop. The platform-generated main line (SubRouteUID == RouteUID) wins, and the
    longest stop list is the fallback.
    """
    rows = await tdx.get(
        f"/v2/Bus/StopOfRoute/City/{_CITY}",
        {"$select": "RouteUID,SubRouteUID,Direction,Stops"},
    )

    best_rows: dict[tuple[str, int], dict] = {}
    for row in rows if isinstance(rows, list) else []:
        uid, direction = row.get("RouteUID"), row.get("Direction")
        if not uid or direction is None or not row.get("Stops"):
            continue
        key = (uid, int(direction))
        rank = (row.get("SubRouteUID") == uid, len(row["Stops"]))
        kept = best_rows.get(key)
        if kept is None or rank > (kept.get("SubRouteUID") == uid, len(kept["Stops"])):
            best_rows[key] = row

    index: dict[tuple[str, int], list[dict]] = {}
    for key, row in best_rows.items():
        stops = []
        for stop in row["Stops"]:
            pos = stop.get("StopPosition") or {}
            stops.append(
                {
                    "stopUid": stop.get("StopUID", ""),
                    "name": _zh(stop.get("StopName")),
                    "nameEn": _en(stop.get("StopName")),
                    "seq": int(stop.get("StopSequence", 0)),
                    "lat": pos.get("PositionLat"),
                    "lng": pos.get("PositionLon"),
                }
            )
        stops.sort(key=lambda s: s["seq"])
        index[key] = stops
    if not index:
        raise TdxError(f"TDX 沒有回傳 {_CITY} 的公車路線站序資料")
    return index


async def stop_sequences() -> dict[tuple[str, int], list[dict]]:
    return await cache.get(f"stopofroute:{_CITY}", config.TTL_STATIC, _load_stop_sequences)


async def stops_of_route(route_uid: str, direction: int) -> list[dict]:
    """Ordered stops of one route+direction: `[{stopUid, name, seq, lat, lng}, ...]`."""
    return (await stop_sequences()).get((route_uid, direction), [])


async def headsign(route_uid: str, direction: int) -> str:
    """
    Where a bus in this direction is actually going — the last stop of its stop
    sequence.

    Route-level DepartureStopNameZh/DestinationStopNameZh cannot be trusted for
    this: 藍10 reports Destination 南港花園社區 while direction 0 really ends at
    成福路口, and Taipei leaves the per-SubRoute `Headsign` field null. Announcing
    the wrong direction to a blind rider is the worst bug this service can have,
    so the stop sequence is the source of truth and the route metadata is only a
    fallback for routes with no StopOfRoute row.
    """
    try:
        stops = await stops_of_route(route_uid, direction)
    except TdxError:
        stops = []
    if stops:
        return stops[-1]["name"]
    info = await route_info(route_uid)
    return info.headsign(direction) if info else ""


async def headsign_en(route_uid: str, direction: int) -> str:
    """English terminus for speech. Same rule as `headsign`: the last stop of
    the direction's sequence, falling back to the route metadata."""
    try:
        stops = await stops_of_route(route_uid, direction)
    except TdxError:
        stops = []
    if stops and stops[-1].get("nameEn"):
        return str(stops[-1]["nameEn"])
    info = await route_info(route_uid)
    if info is None:
        return ""
    return info.destination_en if direction == 0 else info.departure_en


async def stop_name_en(stop_uids: tuple[str, ...]) -> str:
    """
    English name for a station, resolved from the stop sequences we already
    hold. Station.StationName.En is empty for Taipei, but the same place does
    carry an English name on its individual stops, so no extra API call is
    needed — just a lookup across the cached sequences.
    """
    try:
        index = await stop_sequences()
    except TdxError:
        return ""
    here = set(stop_uids)
    for stops in index.values():
        for stop in stops:
            if stop["stopUid"] in here and stop.get("nameEn"):
                return str(stop["nameEn"])
    return ""


async def warm_up() -> None:
    """Preload the slow static caches so the first real request is not the one
    paying for them. Called in the background at startup; failures are ignored
    because every endpoint loads what it needs on demand anyway."""
    for loader in (stations, routes, stop_sequences):
        try:
            await loader()
        except Exception:
            pass


# --- vehicles (low-floor lookup) -----------------------------------------
async def _load_low_floor() -> dict[str, bool]:
    rows = await tdx.get(
        f"/v2/Bus/Vehicle/City/{_CITY}",
        {"$select": "PlateNumb,IsLowFloor,HasLiftOrRamp"},
    )
    out: dict[str, bool] = {}
    for row in rows if isinstance(rows, list) else []:
        plate = row.get("PlateNumb")
        if not plate:
            continue
        # IsLowFloor / HasLiftOrRamp are 0/1 ints; either one means步入式可上車.
        out[plate] = bool(row.get("IsLowFloor") == 1 or row.get("HasLiftOrRamp") == 1)
    return out


async def is_low_floor(plate: str | None) -> bool | None:
    if not plate:
        return None
    try:
        table = await cache.get(f"vehicles:{_CITY}", config.TTL_STATIC, _load_low_floor)
    except TdxError:
        return None  # Nice-to-have; never fail an arrival because of it.
    return table.get(plate)


# --- shared OData helper -------------------------------------------------
def stop_uid_filter(stop_uids: tuple[str, ...], limit: int = 25) -> str:
    """`StopUID eq 'a' or StopUID eq 'b'` for the stops of one station."""
    return " or ".join(f"StopUID eq {odata_str(uid)}" for uid in stop_uids[:limit])
