/**
 * Real data source: talks to our backend, which proxies TDX.
 * The HTTP contract is documented in frontend/README.md. Every response body
 * uses the domain types in ./types.ts.
 */
import type { ArrivalUpdate, BoardCheck, BusDataSource, BusStop, RidePosition, RouteOption, RouteStop } from './types';

const ARRIVAL_POLL_MS = 15000;
const RIDE_POLL_MS = 10000;

function apiSource(base: string): BusDataSource {
  const root = base.replace(/\/$/, '');

  async function get<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(root + path);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return (await res.json()) as T;
  }

  function poll<T>(fetcher: () => Promise<T>, cb: (v: T) => void, everyMs: number): () => void {
    let stopped = false;
    let timer = 0;
    const run = async () => {
      try {
        const v = await fetcher();
        if (!stopped) cb(v);
      } catch {
        // Keep the last known state; try again next tick.
      }
      if (!stopped) timer = window.setTimeout(run, everyMs);
    };
    run();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }

  return {
    isMock: false,
    nearestStop: (pos) => get<BusStop>('/stops/nearest', { lat: pos?.lat, lng: pos?.lng }),
    routesAtStop: (stopId) => get<RouteOption[]>(`/stops/${encodeURIComponent(stopId)}/routes`),
    stopsAfter: (route, fromStopId) =>
      get<RouteStop[]>(`/routes/${encodeURIComponent(route.routeId)}/stops`, {
        direction: route.direction,
        from: fromStopId
      }),
    watchArrival: (route, stopId, cb) =>
      poll(
        () => get<ArrivalUpdate>('/arrivals', { routeId: route.routeId, direction: route.direction, stopId }),
        cb,
        ARRIVAL_POLL_MS
      ),
    checkBoarded: (route, plate, pos) =>
      get<BoardCheck>('/board-check', {
        routeId: route.routeId,
        direction: route.direction,
        plate,
        lat: pos?.lat,
        lng: pos?.lng
      }),
    watchRide: (route, plate, _fromSeq, cb) =>
      poll(
        () => get<RidePosition>(`/buses/${encodeURIComponent(plate)}`, { routeId: route.routeId, direction: route.direction }),
        cb,
        RIDE_POLL_MS
      )
  };
}

export default apiSource;
