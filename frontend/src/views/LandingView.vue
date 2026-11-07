<script setup lang="ts">
/**
 * First screen: choose a language, then choose how to use the service.
 *
 * Languages are listed by endonym — 中文, Tiếng Việt, ภาษาไทย — never
 * translated and never shown as flags. Someone who cannot read Chinese has to
 * be able to find their own language without reading ours first, and a flag is
 * a country, not a language.
 */
import { useRouter } from 'vue-router';
import { LOCALES, s, type LocaleCode } from '@/i18n';
import { confirmChoice, profile, setLocalePref, setMode, type Mode } from '@/stores/profile';
import { say } from '@/lib/announcer';
import BigButton from '@/components/BigButton.vue';

const router = useRouter();

const modes: { value: Mode; label: keyof typeof s.value; hint: keyof typeof s.value }[] = [
  { value: 'standard', label: 'modeStandard', hint: 'modeStandardHint' },
  { value: 'large', label: 'modeLarge', hint: 'modeLargeHint' },
  { value: 'voice', label: 'modeVoice', hint: 'modeVoiceHint' }
];

function pickLocale(code: LocaleCode): void {
  setLocalePref(code);
}

function pickMode(mode: Mode): void {
  setMode(mode);
  // Confirms the choice out loud in the language just chosen, which is also the
  // first proof to a voice-first user that speech is working at all.
  say(s.value[modes.find((m) => m.value === mode)!.label]);
}

function start(): void {
  confirmChoice();
  router.replace({ name: 'plan', query: router.currentRoute.value.query });
}
</script>

<template>
  <div class="page landing">
    <h1 class="landing__name">{{ s.appName }}</h1>
    <p class="lede">{{ s.tagline }}</p>

    <section aria-labelledby="lang-h">
      <h2 id="lang-h">{{ s.langHeading }}</h2>
      <p class="landing__hint">{{ s.langHint }}</p>
      <ul class="langs">
        <li v-for="l in LOCALES" :key="l.code">
          <button
            type="button"
            class="lang"
            :class="{ 'lang--on': profile.locale === l.code }"
            :lang="l.bcp47"
            :aria-pressed="profile.locale === l.code"
            @click="pickLocale(l.code)"
          >
            {{ l.endonym }}
          </button>
        </li>
      </ul>
    </section>

    <section aria-labelledby="mode-h">
      <h2 id="mode-h">{{ s.modeHeading }}</h2>
      <p class="landing__hint">{{ s.modeHint }}</p>
      <!-- Native radios: correct roles, grouping and arrow-key behaviour for
           VoiceOver and TalkBack without reimplementing any of it. -->
      <ul class="modes">
        <li v-for="m in modes" :key="m.value">
          <label class="mode" :class="{ 'mode--on': profile.mode === m.value }">
            <input
              class="sr-only"
              type="radio"
              name="mode"
              :value="m.value"
              :checked="profile.mode === m.value"
              @change="pickMode(m.value)"
            />
            <span class="mode__label">{{ s[m.label] }}</span>
            <span class="mode__hint">{{ s[m.hint] }}</span>
          </label>
        </li>
      </ul>
    </section>

    <div class="page__actions">
      <BigButton @click="start">{{ s.start }}</BigButton>
    </div>
  </div>
</template>

<style scoped>
.landing {
  gap: 24px;
}

.landing__name {
  margin-bottom: -8px;
}

.landing__hint {
  color: var(--ink-soft);
  font-size: 0.9rem;
  margin-bottom: 10px;
}

.langs,
.modes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.langs {
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}

.lang {
  width: 100%;
  min-height: 3.5rem;
  padding: 10px 14px;
  border: 2px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--paper);
  color: var(--ink);
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
}

.lang--on {
  border-color: var(--brand-fill);
  background: var(--teal-tint);
  color: var(--teal);
}

.mode {
  display: block;
  padding: 14px 16px;
  border: 2px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--paper);
  cursor: pointer;
}

.mode--on {
  border-color: var(--brand-fill);
  background: var(--teal-tint);
}

.mode__label {
  display: block;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--ink);
}

.mode--on .mode__label {
  color: var(--teal);
}

.mode__hint {
  display: block;
  margin-top: 4px;
  color: var(--ink-soft);
  font-size: 0.9rem;
  line-height: 1.4;
}

/* The radio is visually hidden, so the focus ring has to land on the card. */
.mode:focus-within {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
  box-shadow: 0 0 0 7px var(--focus-halo);
}
</style>
