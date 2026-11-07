"""
Response models. Field names mirror `frontend/src/data/types.ts` exactly, so the
frontend can swap its mock source for this backend without touching the views.
"""
from typing import Literal

from pydantic import BaseModel

ArrivalStatus = Literal["coming", "arriving", "at_stop", "departed", "no_service"]


class BusStop(BaseModel):
    id: str
    name: str
    # Romanised name, for speech only. The screen keeps the Chinese name so it
    # matches the physical stop sign; a vi/th/fil speech engine cannot
    # pronounce Chinese characters, so spoken announcements use this instead.
    # Empty when TDX has none.
    nameEn: str = ""
    lat: float
    lng: float


class RouteOption(BaseModel):
    routeId: str
    routeName: str
    direction: Literal[0, 1]
    headsign: str
    headsignEn: str = ""
    etaSec: int | None = None


class RouteStop(BaseModel):
    stopId: str
    name: str
    nameEn: str = ""
    seq: int


class ArrivalUpdate(BaseModel):
    etaSec: int | None = None
    status: ArrivalStatus
    plate: str | None = None
    otherArriving: list[str] = []
    # Extra (not in the frontend types yet): the product spec wants
    # "這班是低地板" in the spoken announcement.
    lowFloor: bool | None = None


BoardStatus = Literal["on_board", "wrong_bus", "unknown"]


class BoardCheck(BaseModel):
    onBus: bool
    # Why `unknown` is separate from `wrong_bus`: not finding the vehicle is not
    # evidence of being on the wrong one. A1 positions lag by 15-60 s, so "we
    # cannot tell yet" is the common case right after boarding. Telling a rider
    # they are on the wrong bus when we simply have no data gets them off a
    # perfectly good bus.
    status: BoardStatus = "unknown"
    plate: str | None = None
    reason: str | None = None


class RidePosition(BaseModel):
    plate: str
    seq: int
    atStop: bool
