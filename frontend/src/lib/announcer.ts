/**
 * One place for everything the user should *notice*: screen-reader live region,
 * spoken voice (TTS) and vibration.
 *
 * Voice output:
 *  - In the app: posts `tts_speak` `{ text }` to a custom native handler
 *    (TODO for the app side: implement with flutter_tts, offline engine).
 *    On start we probe the handler; if it doesn't reply we fall back to Web Speech.
 *  - In a browser: window.speechSynthesis (uses the OS voice; dev fallback).
 *
 * Vibration:
 *  - In the app: posts `vibrate` `{ pattern }` (TODO for the app side, e.g. HapticFeedback / vibration package).
 *  - In a browser: navigator.vibrate (Android Chrome only; iOS ignores it).
 *
 * Screen-reader users who rely on VoiceOver/TalkBack may prefer turning TTS off
 * and hearing the live region only, otherwise they hear everything twice.
 */
import { reactive } from 'vue';
import { inApp, post, request } from './bridge';

export const Vibe = {
  tick: [120],
  arriving: [400, 150, 400],
  getOffNext: [800, 200, 800, 200, 800],
  arrived: [1200],
  warning: [200, 100, 200, 100, 200, 100, 200]
} as const;

const STORAGE_KEY = 'bus-assist:tts';

function readTtsPref(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export const announcer = reactive({
  /** Text for the polite live region. */
  polite: '',
  /** Text for the assertive live region (urgent: arriving, get off, wrong bus). */
  assertive: '',
  /** Last spoken sentence, for the "再說一次" button. */
  last: '',
  ttsEnabled: readTtsPref(),
  nativeTts: false
});

let probed = false;
export async function probeNativeTts(): Promise<void> {
  if (probed || !inApp()) return;
  probed = true;
  const ok = await request<boolean>('tts_speak', { text: '', probe: true }, 1200);
  announcer.nativeTts = ok === true;
}

export function setTtsEnabled(on: boolean): void {
  announcer.ttsEnabled = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage unavailable (private mode / preview); keep in memory only.
  }
  if (!on) stopSpeaking();
}

function speakAloud(text: string): void {
  if (!announcer.ttsEnabled || !text) return;
  if (announcer.nativeTts) {
    post('tts_speak', { text });
    return;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW';
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }
}

export function stopSpeaking(): void {
  if (announcer.nativeTts) post('tts_stop');
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function vibrate(pattern: readonly number[]): void {
  if (inApp()) {
    post('vibrate', { pattern });
    return;
  }
  try {
    navigator.vibrate?.(pattern as number[]);
  } catch {
    // Not supported.
  }
}

// Re-setting identical text doesn't re-trigger screen readers, so clear first.
function setLive(key: 'polite' | 'assertive', text: string): void {
  announcer[key] = '';
  window.setTimeout(() => {
    announcer[key] = text;
  }, 60);
}

export interface SayOptions {
  urgent?: boolean;
  vibe?: readonly number[];
}

/** Announce a sentence through every channel. */
export function say(text: string, opts: SayOptions = {}): void {
  announcer.last = text;
  setLive(opts.urgent ? 'assertive' : 'polite', text);
  speakAloud(text);
  if (opts.vibe) vibrate(opts.vibe);
}

export function repeatLast(): void {
  if (!announcer.last) return;
  setLive('assertive', announcer.last);
  speakAloud(announcer.last);
}
