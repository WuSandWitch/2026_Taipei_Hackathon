/**
 * The translation contract. Every locale file must satisfy `Strings`, so adding
 * a key fails the type-check until all six languages have it — that is the
 * point, because a half-translated screen is worse than an obviously English
 * one for someone who cannot read Chinese.
 */
export interface Strings {
  /** Service name. Shown on the landing screen only: inside the app the
   *  WebView header already shows it, so repeating it wastes a line. */
  appName: string;
  tagline: string;

  /** Step 1 of 2: language. */
  langHeading: string;
  langHint: string;

  /** Step 2 of 2: text size and read-aloud. */
  displayHeading: string;
  displayHint: string;
  /** A real sentence from the service, rendered at the size being chosen, so
   *  the choice is made by looking at the result rather than at a label. */
  preview: string;
  modeStandard: string;
  modeStandardHint: string;
  modeLarge: string;
  modeLargeHint: string;
  modeVoice: string;
  modeVoiceHint: string;

  next: string;
  back: string;
  start: string;
  changeLang: string;

  /** Flagging the bus down. The card's driver-facing text is deliberately NOT
   *  in here: it is always Chinese, because the person reading it is a Taipei
   *  bus driver. Only the rider-facing instruction is translated. */
  showDriver: string;
  driverHint: string;
  close: string;

  /** Trip flow. `{...}` placeholders are filled by t(key, vars). */
  stepOf: string;
  etaNone: string;
  etaSoon: string;
  etaMin: string;
  locatingTitle: string;
  locatingBody: string;
  noStopTitle: string;
  noStopBody: string;
  retry: string;
  pickRouteTitle: string;
  youAreAt: string;
  routeListLabel: string;
  toward: string;
  relocate: string;
  pickDestTitle: string;
  takingRoute: string;
  destListLabel: string;
  backToRoutes: string;
  confirmTitle: string;
  getOffAt: string;
  totalStops: string;
  confirmBody: string;
  confirmHint: string;
  startTrip: string;
  backToDest: string;
  routeAria: string;
  destAria: string;
  sayAtStop: string;
  sayNoStop: string;
  sayRoutePicked: string;
  sayDestPicked: string;

  waitTitle: string;
  statusChecking: string;
  statusAtStop: string;
  statusArriving: string;
  statusDeparted: string;
  statusNoService: string;
  plateIs: string;
  notYourBus: string;
  waitBody: string;
  iBoarded: string;
  sayAgain: string;
  sayOtherBus: string;
  sayArrived: string;
  notifyArrivedTitle: string;
  notifyArrivedBody: string;
  sayDeparted: string;
  sayArriving: string;
  sayOneMin: string;
  sayMins: string;
  sayWaitStart: string;

  checkTitle: string;
  checkBody: string;
  okTitle: string;
  okBody: string;
  startRideAlert: string;
  wrongTitle: string;
  wrongBody: string;
  wrongHint: string;
  gotOffRewait: string;
  sureRight: string;
  unknownTitle: string;
  unknownBody: string;
  unknownHint: string;
  checkAgain: string;
  sureRightStart: string;
  cantCheckTitle: string;
  cantCheckBody: string;
  retry2: string;
  sayChecking: string;
  sayOnBoard: string;
  sayWrongBus: string;
  sayUnknown: string;
  sayCantCheck: string;
  rideTitle: string;
  rideLeft: string;
  rideArrived: string;
  bellNow: string;
  tagGetOff: string;
  tagNext: string;
  whereNow: string;
  sayPassed: string;
  sayGetOffNow: string;
  notifyArrivedDest: string;
  notifyGetOffTitle: string;
  notifyGetOffBody: string;
  sayNextIsDest: string;
  sayTwoLeft: string;
  sayNextStop: string;
  sayRideStart: string;
  arriveTitle: string;
  arriveBody: string;
  done: string;

  whereNearDest: string;
  whereBellNow: string;
  whereNextStop: string;
  stripLabel: string;
  nextStopIs: string;

  busInfo: string;

  /** Chrome that stays visible during a trip. */
  voiceToggle: string;
  endTrip: string;
  endTripArmed: string;
  mockData: string;
  mockDataSr: string;
}

export type LocaleCode = 'zh-TW' | 'en' | 'vi' | 'id' | 'th' | 'fil';

export interface LocaleMeta {
  code: LocaleCode;
  /** The language's own name, in that language. Never translated. */
  endonym: string;
  /** BCP 47 tag for <html lang> and for the speech engine. */
  bcp47: string;
  /** False until a native speaker has reviewed the strings. */
  reviewed: boolean;
}
