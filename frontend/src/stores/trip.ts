/**
 * Trip state shared across the four steps:
 *   1. plan (stop → route → destination)  2. wait  3. board check  4. ride
 */
import { computed, reactive } from 'vue';
import { locale, t } from '@/i18n';
import type { ArrivalUpdate, BoardCheck, BusStop, RidePosition, RouteOption, RouteStop } from '@/data';

export const trip = reactive({
  stop: null as BusStop | null,
  route: null as RouteOption | null,
  /** Stops after the boarding stop, in order. */
  stopsAhead: [] as RouteStop[],
  destination: null as RouteStop | null,
  arrival: null as ArrivalUpdate | null,
  plate: undefined as string | undefined,
  boardCheck: null as BoardCheck | null,
  ride: null as RidePosition | null
});

export const boardingSeq = computed(() => {
  const first = trip.stopsAhead[0];
  return first ? first.seq - 1 : 0;
});

/** Stops still to go until the destination, counted from the bus's current position. */
export const stopsLeft = computed(() => {
  if (!trip.destination) return null;
  const seq = trip.ride?.seq ?? boardingSeq.value;
  return Math.max(0, trip.destination.seq - seq);
});

export const nextStop = computed<RouteStop | null>(() => {
  const seq = trip.ride?.seq ?? boardingSeq.value;
  // At a stop: the next one is seq+1. Between stops: the bus is heading to seq+1 too.
  return trip.stopsAhead.find((s) => s.seq === seq + 1) ?? null;
});

export function resetTrip(keepStop = true): void {
  if (!keepStop) trip.stop = null;
  trip.route = null;
  trip.stopsAhead = [];
  trip.destination = null;
  trip.arrival = null;
  trip.plate = undefined;
  trip.boardCheck = null;
  trip.ride = null;
}

export function formatEta(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return t('etaNone');
  if (sec <= 30) return t('etaSoon');
  return t('etaMin', { min: Math.round(sec / 60) });
}

/**
 * Small counts as Chinese numerals, so a zh-TW voice reads 兩條 rather than
 * spelling out a digit. Every other language keeps digits: 二/兩 has no
 * equivalent problem there, and a Vietnamese voice handles "2" correctly.
 */
export function zhCount(n: number): string {
  if (locale.value !== 'zh-TW') return String(n);
  const map = ['零', '一', '兩', '三', '四', '五', '六', '七', '八', '九', '十'];
  return n >= 0 && n <= 10 ? map[n]! : String(n);
}
