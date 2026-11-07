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

/** One string. Falls back to zh-TW, which can only happen if a locale file is
 *  mid-edit, because the type-checker requires every key everywhere. */
export function t(key: keyof Strings): string {
  return DICTS[state.locale][key] ?? DICTS[DEFAULT_LOCALE][key];
}

export function setLocale(next: LocaleCode): void {
  state.locale = next;
  const meta = LOCALES.find((l) => l.code === next);
  // Screen readers pick their voice from this, so it has to track the choice.
  document.documentElement.lang = meta?.bcp47 ?? next;
}
