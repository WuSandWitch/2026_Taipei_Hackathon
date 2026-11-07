/**
 * Who is using this, and how. Two independent dimensions:
 *
 *   locale — which language to read and hear
 *   mode   — how much the person can use the screen
 *
 * They are separate on purpose. "新住民" is a language need and "視障" is an
 * access need, so a blind Vietnamese rider picks Tiếng Việt *and* voice-first.
 * Folding them into one list of user types would force that person to choose
 * which half of themselves to declare.
 *
 * ENTRY PARAMETERS (what the planned Town Pass card entry will use)
 *
 *   ?lang=zh-TW|en|vi|id|th|fil
 *   ?mode=standard|large|voice
 *   ?profile=general|newresident|lowvision|blind     shorthand for the above
 *
 * A card issued to a particular group links to the service with its own
 * parameters, so the person never has to describe themselves twice:
 *
 *   視障卡    →  ?profile=blind
 *   新住民卡  →  ?profile=newresident&lang=vi
 *
 * Precedence is URL > saved choice > device language > zh-TW. The landing
 * screen is skipped only when BOTH dimensions are settled, so a newresident
 * card with no `lang` still gets the language picker instead of a silent guess.
 */
import { computed, reactive } from 'vue';
import { DEFAULT_LOCALE, deviceLocale, isLocale, setLocale, type LocaleCode } from '@/i18n';

export type Mode = 'standard' | 'large' | 'voice';

const MODES: Mode[] = ['standard', 'large', 'voice'];
const PROFILES: Record<string, Mode> = {
  general: 'standard',
  newresident: 'standard',
  lowvision: 'large',
  blind: 'voice'
};

const STORE_LANG = 'bus-assist:lang';
const STORE_MODE = 'bus-assist:mode';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // Private mode or blocked storage; stay in memory.
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore: the choice still applies for this session.
  }
}

const isMode = (v: unknown): v is Mode => typeof v === 'string' && MODES.includes(v as Mode);

export const profile = reactive({
  locale: DEFAULT_LOCALE as LocaleCode,
  mode: 'standard' as Mode,
  /** True once the person (or their card) has settled both dimensions. */
  chosen: false
});

/** Mode drives type scale and contrast from one attribute, so every screen
 *  follows without each component knowing about modes. */
function applyMode(mode: Mode): void {
  document.documentElement.dataset.mode = mode;
}

export function setLocalePref(next: LocaleCode): void {
  profile.locale = next;
  setLocale(next);
  write(STORE_LANG, next);
}

export function setMode(next: Mode): void {
  profile.mode = next;
  applyMode(next);
  write(STORE_MODE, next);
}

export function confirmChoice(): void {
  profile.chosen = true;
  write(STORE_LANG, profile.locale);
  write(STORE_MODE, profile.mode);
}

/** Resolve everything once at startup. Returns whether the landing screen can
 *  be skipped. */
export function initProfile(search: string = window.location.search): boolean {
  const q = new URLSearchParams(search);

  const paramProfile = q.get('profile');
  const profileMode = paramProfile ? PROFILES[paramProfile] : undefined;

  const paramLang = q.get('lang');
  const paramMode = q.get('mode');

  const storedLang = read(STORE_LANG);
  const storedMode = read(STORE_MODE);

  // Language: explicit beats remembered beats the device.
  const langSettled = isLocale(paramLang) || isLocale(storedLang);
  const lang = isLocale(paramLang)
    ? paramLang
    : isLocale(storedLang)
      ? storedLang
      : (deviceLocale() ?? DEFAULT_LOCALE);

  // Mode: ?mode beats ?profile beats remembered. Nothing is inferred from the
  // device, because no device setting tells us a person is blind.
  const modeSettled = isMode(paramMode) || profileMode !== undefined || isMode(storedMode);
  const mode = isMode(paramMode)
    ? paramMode
    : (profileMode ?? (isMode(storedMode) ? storedMode : 'standard'));

  profile.locale = lang;
  profile.mode = mode;
  setLocale(lang);
  applyMode(mode);

  profile.chosen = langSettled && modeSettled;
  return profile.chosen;
}

export const needsLanding = computed(() => !profile.chosen);
