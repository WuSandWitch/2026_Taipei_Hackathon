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
    lat: float
    lng: float


class RouteOption(BaseModel):
    routeId: str
    routeName: str
    direction: Literal[0, 1]
    headsign: str
    etaSec: int | None = None


class RouteStop(BaseModel):
    stopId: str
    name: str
    seq: int


class ArrivalUpdate(BaseModel):
    etaSec: int | None = None
    status: ArrivalStatus
    plate: str | None = None
    otherArriving: list[str] = []
    # Extra (not in the frontend types yet): the product spec wants
    # "這班是低地板" in the spoken announcement.
    lowFloor: bool | None = None


class BoardCheck(BaseModel):
    onBus: bool
    plate: str | None = None
    reason: str | None = None


class RidePosition(BaseModel):
    plate: str
    seq: int
    atStop: bool
