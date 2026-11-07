/**
 * Domain types the UI works with. The backend maps TDX bus data into these
 * shapes, so the frontend never depends on TDX field names directly.
 * See frontend/README.md for the HTTP contract.
 */

export interface BusStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** A route that serves the user's stop, in one direction. */
export interface RouteOption {
  routeId: string;
  /** Route number as people say it, e.g. "307". */
  routeName: string;
  /** 0 = 去程, 1 = 返程 */
  direction: 0 | 1;
  /** Where the bus is heading, e.g. "板橋前站". */
  headsign: string;
  /** Seconds until the next bus reaches the user's stop; null if unknown / no service. */
  etaSec: number | null;
}

/** A stop after the boarding stop, in travel order. */
export interface RouteStop {
  stopId: string;
  name: string;
  /** Stop sequence on the route. */
  seq: number;
}

export type ArrivalStatus = 'coming' | 'arriving' | 'at_stop' | 'departed' | 'no_service';

export interface ArrivalUpdate {
  etaSec: number | null;
  status: ArrivalStatus;
  /** Plate of the bus that is coming / at the stop, e.g. "KKA-1234". */
  plate?: string;
  /** Other routes pulling into the stop right now (so we can say "this is not your bus"). */
  otherArriving: string[];
}

export interface BoardCheck {
  onBus: boolean;
  plate?: string;
  /** Plain-language reason when we couldn't confirm. */
  reason?: string;
}

export interface RidePosition {
  plate: string;
  /** Sequence of the stop the bus is at, or has just left. */
  seq: number;
  atStop: boolean;
}

export interface BusDataSource {
  readonly isMock: boolean;
  nearestStop(pos: { lat: number; lng: number } | null): Promise<BusStop>;
  routesAtStop(stopId: string): Promise<RouteOption[]>;
  /** Stops after `fromStopId` on this route + direction, in order. */
  stopsAfter(route: RouteOption, fromStopId: string): Promise<RouteStop[]>;
  /** Live arrival updates for this route at this stop. Returns an unsubscribe function. */
  watchArrival(route: RouteOption, stopId: string, cb: (u: ArrivalUpdate) => void): () => void;
  /** Is the user on this route's bus? Uses the user's position vs. live bus positions. */
  checkBoarded(route: RouteOption, plate: string | undefined, pos: { lat: number; lng: number } | null): Promise<BoardCheck>;
  /** Live position of the bus the user is riding. Returns an unsubscribe function. */
  watchRide(route: RouteOption, plate: string, fromSeq: number, cb: (p: RidePosition) => void): () => void;
}
