/**
 * Bridge to the TownPass (城市通) app.
 *
 * The app injects `window.flutterObject` into the WebView. Messages in both
 * directions are JSON strings shaped `{ name, data }`
 * (see app/lib/util/web_message_handler/).
 *
 * Every call here is safe in a normal browser: when `flutterObject` is missing,
 * `post` is a no-op and `request` resolves to `null`, so callers fall back to
 * browser APIs or mock data.
 */

interface FlutterObject {
  postMessage(message: string): void;
  addEventListener(type: 'message', listener: (event: { data: string }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: string }) => void): void;
}

function flutterObject(): FlutterObject | null {
  const fo = (window as unknown as { flutterObject?: FlutterObject }).flutterObject;
  return fo ?? null;
}

export function inApp(): boolean {
  return flutterObject() !== null;
}

/** Fire-and-forget message to the app. */
export function post(name: string, data: unknown = null): void {
  flutterObject()?.postMessage(JSON.stringify({ name, data }));
}

/**
 * Send a message and wait for the app's reply with the same `name`.
 * Resolves to `null` outside the app, on timeout, or if the handler doesn't exist.
 */
export function request<T>(name: string, data: unknown = null, timeoutMs = 4000): Promise<T | null> {
  const fo = flutterObject();
  if (!fo) return Promise.resolve(null);

  return new Promise((resolve) => {
    const onMessage = (event: { data: string }) => {
      try {
        const reply = JSON.parse(event.data) as { name?: string; data?: T };
        if (reply.name !== name) return;
        cleanup();
        resolve(reply.data ?? null);
      } catch {
        // Not our message format; ignore.
      }
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timer);
      fo.removeEventListener('message', onMessage);
    };
    fo.addEventListener('message', onMessage);
    fo.postMessage(JSON.stringify({ name, data }));
  });
}

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Current position. In the app this uses the built-in `location` handler, which
 * replies with geolocator's Position.toJson() (`latitude`, `longitude`, ...) or `[]`.
 * In a browser it falls back to navigator.geolocation.
 */
export async function getLocation(): Promise<LatLng | null> {
  if (inApp()) {
    const pos = await request<{ latitude?: number; longitude?: number } | unknown[]>('location', null, 8000);
    if (pos && !Array.isArray(pos) && typeof pos.latitude === 'number' && typeof pos.longitude === 'number') {
      return { lat: pos.latitude, lng: pos.longitude };
    }
    return null;
  }
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 15000 }
    );
  });
}

/** Local notification via the built-in `notify` handler (expects `{ title, content }`). */
export function notify(title: string, content: string): void {
  post('notify', { title, content });
}
