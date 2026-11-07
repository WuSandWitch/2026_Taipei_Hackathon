<script setup lang="ts">
/**
 * Step 1 of 2 — language.
 *
 * One decision per screen, because research on interfaces for older adults and
 * for people with low literacy converges on the same thing: keep the cognitive
 * load low and make each step predictable rather than asking several questions
 * at once.
 *
 * A single column, not a grid. Rows are easier to scan than a wrapping grid,
 * they survive screen magnification without horizontal scrolling, and each row
 * can be far larger than the 44-48px minimum the platforms ask for — older
 * users lose pointing precision, so the targets here are roughly 72px tall.
 *
 * Languages are listed by endonym and never as flags: a flag is a country, not
 * a language, and someone who cannot read Chinese has to find their own
 * language without reading ours first.
 */
import { useRouter } from 'vue-router';
import { LOCALES, s, type LocaleCode } from '@/i18n';
import { profile, setLocalePref } from '@/stores/profile';
import { Vibe, say, vibrate } from '@/lib/announcer';
import BigButton from '@/components/BigButton.vue';

const router = useRouter();

function pick(code: LocaleCode): void {
  setLocalePref(code);
  // A short buzz confirms the tap landed, which matters when you cannot be sure
  // your finger hit the right row. Saying the service name in the language just
  // chosen is the fastest proof that the choice took effect.
  vibrate(Vibe.tick);
  say(s.value.appName);
}

function next(): void {
  router.push({ name: 'display', query: router.currentRoute.value.query });
}
</script>

<template>
  <div class="page step">
    <p class="step__count" aria-hidden="true">1 / 2</p>

    <h1 class="step__h">
      <svg class="step__icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
        <path
          d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        />
      </svg>
      {{ s.langHeading }}
    </h1>
    <p class="step__hint">{{ s.langHint }}</p>

    <ul class="rows">
      <li v-for="l in LOCALES" :key="l.code">
        <button
          type="button"
          class="row"
          :class="{ 'row--on': profile.locale === l.code }"
          :lang="l.bcp47"
          :aria-pressed="profile.locale === l.code"
          @click="pick(l.code)"
        >
          <span class="row__label">{{ l.endonym }}</span>
          <svg v-if="profile.locale === l.code" class="row__tick" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
        </button>
      </li>
    </ul>

    <div class="page__actions">
      <BigButton @click="next">{{ s.next }}</BigButton>
    </div>
  </div>
</template>

<style scoped>
.step {
  gap: 16px;
}

.step__count {
  color: var(--ink-soft);
  font-weight: 600;
}

.step__h {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step__icon {
  flex: none;
  width: 1.2em;
  height: 1.2em;
  color: var(--brand-fill);
}

.step__hint {
  color: var(--ink-soft);
  line-height: 1.5;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

/* Roughly 72px tall at the default size, well above the 44-48px platform
   minimum, because pointing precision drops with age. */
.row {
  width: 100%;
  min-height: 3.6rem;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 2px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--paper);
  color: var(--ink);
  font-size: 1.15rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.row--on {
  border-color: var(--brand-fill);
  background: var(--teal-tint);
  color: var(--teal);
}

.row__label {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.row__tick {
  flex: none;
  width: 1.5rem;
  height: 1.5rem;
}
</style>
