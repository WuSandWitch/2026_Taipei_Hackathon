/**
 * Keep the screen on while a trip is running.
 *
 * Why this matters more than it looks: when the screen sleeps, the WebView
 * throttles and then suspends JavaScript timers, so the arrival polling and the
 * "press the bell now" announcement simply stop. An older rider has no reason
 * to sit staring at their phone for twenty minutes, so without this the
 * headline feature quietly fails exactly when it is needed.
 *
 * Implemented with the Screen Wake Lock API rather than a Flutter plugin: it
 * needs no new dependency, and it is supported by WKWebView from iOS 16.4 and
 * by Android WebView from 84. It requires a secure context, so it works on the
 * deployed HTTPS build and on localhost, but not over plain http to a LAN IP.
 *
 * If the API is missing we fall back to posting `wakelock` to the app, which
 * today no handler answers — harmless, and the hook is there for a native
 * implementation (wakelock_plus, BSD-3-Clause) if testing shows we need one.
 */
import { inApp, post } from './bridge';

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

function api(): WakeLockLike | null {
  const nav = navigator as unknown as { wakeLock?: WakeLockLike };
  return nav.wakeLock ?? null;
}

export function wakeLockSupported(): boolean {
  return api() !== null;
}

let sentinel: WakeLockSentinelLike | null = null;
let wanted = false;

async function acquire(): Promise<void> {
  const wakeLock = api();
  if (!wakeLock || sentinel) return;
  try {
    sentinel = await wakeLock.request('screen');
    // The browser drops the lock on its own when the tab is hidden or the
    // battery gets low; clear our handle so the next re-check can retry.
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    // Refused (not a secure context, no user gesture yet, battery saver).
    sentinel = null;
  }
}

async function drop(): Promise<void> {
  const held = sentinel;
  sentinel = null;
  try {
    if (held && !held.released) await held.release();
  } catch {
    // Already gone.
  }
}

/**
 * The lock is lost whenever the page is hidden, so it has to be taken again on
 * the way back. Without this, one glance at another app ends the wake lock for
 * the rest of the trip.
 */
function onVisibility(): void {
  if (document.visibilityState === 'visible' && wanted) void acquire();
}

export function setKeepAwake(on: boolean): void {
  wanted = on;
  if (on) {
    document.addEventListener('visibilitychange', onVisibility);
    void acquire();
    if (!api() && inApp()) post('wakelock', { on: true });
  } else {
    document.removeEventListener('visibilitychange', onVisibility);
    void drop();
    if (!api() && inApp()) post('wakelock', { on: false });
  }
}
