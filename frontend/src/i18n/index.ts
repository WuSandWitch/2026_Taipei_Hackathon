/**
 * A small hand-rolled i18n layer. No dependency: the whole surface is a typed
 * dictionary per locale plus `t()`, which is less code than wiring up a library
 * and keeps the string contract in `types.ts` where the type-checker enforces
 * it across all six languages.
 *
 * TRANSLATION STATUS. zh-TW and en are written by the team. vi / id / th / fil
 * are first-pass translations and `reviewed: false` marks them as such —
 * CLAUDE.md is explicit that a multilingual UI must not lean on machine
 * translation alone, so every locale is paired with icons on screen and the
 * unreviewed ones need a native speaker before the demo. Flip `reviewed` to
 * true per language as that happens.
 */
import { computed, reactive } from 'vue';
import type { LocaleCode, LocaleMeta, Strings } from './types';
import { zhTW } from './locales/zh-TW';
import { en } from './locales/en';
import { vi } from './locales/vi';
import { id } from './locales/id';
import { th } from './locales/th';
import { fil } from './locales/fil';

export type { LocaleCode, LocaleMeta, Strings } from './types';

const DICTS: Record<LocaleCode, Strings> = { 'zh-TW': zhTW, en, vi, id, th, fil };

/** Order is deliberate: Chinese first as the city's own language, then the
 *  languages of Taipei's largest migrant communities, with English as the
 *  common fallback. */
export const LOCALES: LocaleMeta[] = [
  { code: 'zh-TW', endonym: '中文', bcp47: 'zh-TW', reviewed: true },
  { code: 'vi', endonym: 'Tiếng Việt', bcp47: 'vi-VN', reviewed: false },
  { code: 'id', endonym: 'Bahasa Indonesia', bcp47: 'id-ID', reviewed: false },
  { code: 'th', endonym: 'ภาษาไทย', bcp47: 'th-TH', reviewed: false },
  { code: 'fil', endonym: 'Filipino', bcp47: 'fil-PH', reviewed: false },
  { code: 'en', endonym: 'English', bcp47: 'en-US', reviewed: true }
];

export const DEFAULT_LOCALE: LocaleCode = 'zh-TW';

export function isLocale(value: unknown): value is LocaleCode {
  return typeof value === 'string' && value in DICTS;
}

/** Best guess from the device, used only when nothing was chosen or passed in. */
export function deviceLocale(): LocaleCode | null {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const lower = (tag || '').toLowerCase();
    if (lower.startsWith('zh')) return 'zh-TW';
    if (lower.startsWith('vi')) return 'vi';
    if (lower.startsWith('id')) return 'id';
    if (lower.startsWith('th')) return 'th';
    if (lower.startsWith('fil') || lower.startsWith('tl')) return 'fil';
    if (lower.startsWith('en')) return 'en';
  }
  return null;
}

const state = reactive({ locale: DEFAULT_LOCALE as LocaleCode });

export const locale = computed(() => state.locale);
export const localeMeta = computed(
  () => LOCALES.find((l) => l.code === state.locale) ?? LOCALES[0]!
);
/** The whole dictionary, for templates that read several keys. */
export const s = computed(() => DICTS[state.locale]);

/**
 * One string, with optional `{placeholder}` substitution.
 *
 *   t('arrivingNow', { route: '307' })   // 307 即將進站
 *
 * Placeholders rather than sentence fragments glued together, because word
 * order differs per language: "Route 307 arrives in 3 minutes" and
 * "Tuyến 307 đến trong 3 phút" cannot be built from the same concatenation.
 *
 * A missing value leaves the placeholder visible on purpose. A half-built
 * sentence is easier to spot and report than a silently empty gap.
 */
export function t(key: keyof Strings, vars?: Record<string, string | number>): string {
  const raw = DICTS[state.locale][key] ?? DICTS[DEFAULT_LOCALE][key];
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

/**
 * The form of a place name to speak, as opposed to the one to show.
 *
 * The screen always shows the Chinese name so it matches the stop sign. Speech
 * cannot use it outside Chinese: an engine set to vi, th or fil has no reading
 * for Chinese characters and will skip or mangle exactly the word that carries
 * the information. So non-Chinese locales speak the romanised name, and fall
 * back to the Chinese one when TDX has no English for that stop — a
 * mispronounced name still beats silence.
 */
export function spoken(zh: string, en?: string): string {
  if (state.locale === 'zh-TW') return zh;
  return en && en.trim() ? en : zh;
}

export function setLocale(next: LocaleCode): void {
  state.locale = next;
  const meta = LOCALES.find((l) => l.code === next);
  // Screen readers pick their voice from this, so it has to track the choice.
  document.documentElement.lang = meta?.bcp47 ?? next;
}
