/**
 * MOCK DATA — 模擬資料，不是真實路線或即時資料。
 * Stop names and sequences below are illustrative only, used until the backend
 * serves real TDX data. Time runs faster than real life so a demo fits in ~2 minutes.
 *
 * URL switches (browser or app):
 *   ?speed=20   simulation speed (simulated seconds per real second, default 10)
 *   ?wrong=1    make the boarding check fail, to demo the "wrong bus" path
 */
import type { ArrivalUpdate, BoardCheck, BusDataSource, BusStop, RidePosition, RouteOption, RouteStop } from './types';

const params = new URLSearchParams(window.location.search);
const SPEED = Math.max(1, Number(params.get('speed')) || 10);
const FORCE_WRONG = params.get('wrong') === '1';

const STOP: BusStop = {
  id: 'mock-stop-1',
  name: '捷運市政府站',
  nameEn: 'MRT Taipei City Hall Sta.',
  lat: 25.0411,
  lng: 121.5651
};

const ROUTES: RouteOption[] = [
  { routeId: 'mock-307', routeName: '307', direction: 0, headsign: '板橋前站', headsignEn: 'Banqiao Front Sta.', etaSec: 240 },
  { routeId: 'mock-212', routeName: '212', direction: 0, headsign: '中興新村', headsignEn: 'Zhongxing New Village', etaSec: 120 },
  { routeId: 'mock-blue5', routeName: '藍5', direction: 1, headsign: '捷運市政府站', headsignEn: 'MRT Taipei City Hall Sta.', etaSec: 540 },
  { routeId: 'mock-zx', routeName: '忠孝幹線', direction: 0, headsign: '蘆洲', headsignEn: 'Luzhou', etaSec: 900 }
];

const STOPS_307: RouteStop[] = [
  { stopId: 'm-11', name: '忠孝敦化', nameEn: 'Zhongxiao Dunhua', seq: 11 },
  { stopId: 'm-12', name: '忠孝復興', nameEn: 'Zhongxiao Fuxing', seq: 12 },
  { stopId: 'm-13', name: '忠孝新生', nameEn: 'Zhongxiao Xinsheng', seq: 13 },
  { stopId: 'm-14', name: '善導寺', nameEn: 'Shandao Temple', seq: 14 },
  { stopId: 'm-15', name: '臺北車站', nameEn: 'Taipei Main Station', seq: 15 },
  { stopId: 'm-16', name: '西門', nameEn: 'Ximen', seq: 16 },
  { stopId: 'm-17', name: '龍山寺', nameEn: 'Longshan Temple', seq: 17 },
  { stopId: 'm-18', name: '萬華車站', nameEn: 'Wanhua Station', seq: 18 },
  { stopId: 'm-19', name: '板橋前站', nameEn: 'Banqiao Front Sta.', seq: 19 }
];

const BOARDING_SEQ = 10;
const MOCK_PLATE = 'KKA-1234';

function wait(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

export const mockSource: BusDataSource = {
  isMock: true,

  async nearestStop() {
    await wait(400);
    return STOP;
  },

  async routesAtStop() {
    await wait(300);
    return ROUTES.map((r) => ({ ...r }));
  },

  async stopsAfter(route) {
    await wait(200);
    if (route.routeId === 'mock-307') return STOPS_307;
    // Other mock routes reuse the same list with a different prefix so the flow still works.
    return STOPS_307.map((s) => ({ ...s, stopId: `${route.routeId}-${s.seq}` }));
  },

  watchArrival(route, _stopId, cb) {
    let eta = route.etaSec ?? 240;
    let atStopFor = 0;
    let departed = false;

    const emit = () => {
      const otherArriving = eta <= 150 && eta > 110 ? ['212'] : [];
      let u: ArrivalUpdate;
      if (departed) {
        u = { etaSec: eta, status: 'coming', otherArriving };
      } else if (eta <= 0) {
        u = { etaSec: 0, status: 'at_stop', plate: MOCK_PLATE, otherArriving: [] };
      } else if (eta <= 40) {
        u = { etaSec: eta, status: 'arriving', plate: MOCK_PLATE, otherArriving };
      } else {
        u = { etaSec: eta, status: 'coming', plate: MOCK_PLATE, otherArriving };
      }
      cb(u);
    };

    emit();
    const timer = window.setInterval(() => {
      if (eta > 0) {
        eta = Math.max(0, eta - SPEED);
      } else {
        // Bus waits at the stop for ~45 s of real time, then leaves.
        atStopFor += 1;
        if (atStopFor > 45 && !departed) {
          departed = true;
          eta = 480;
          cb({ etaSec: null, status: 'departed', plate: MOCK_PLATE, otherArriving: [] });
          return;
        }
      }
      emit();
    }, 1000);
    return () => window.clearInterval(timer);
  },

  async checkBoarded(): Promise<BoardCheck> {
    await wait(1800);
    if (FORCE_WRONG) {
      return { onBus: false, status: 'wrong_bus', reason: '你的位置沒有跟著 307 移動，可能搭到別的車。' };
    }
    return { onBus: true, status: 'on_board', plate: MOCK_PLATE };
  },

  watchRide(_route, plate, fromSeq, cb) {
    let seq = fromSeq;
    let atStop = true;
    const emit = () => cb({ plate, seq, atStop } satisfies RidePosition);
    emit();
    // A stop takes ~6 s of real time at speed 10 (60 s simulated).
    const step = Math.max(1500, Math.round(60000 / SPEED / 2));
    const timer = window.setInterval(() => {
      if (atStop) {
        atStop = false;
      } else {
        seq += 1;
        atStop = true;
      }
      emit();
    }, step);
    return () => window.clearInterval(timer);
  }
};

export const MOCK_BOARDING_SEQ = BOARDING_SEQ;
