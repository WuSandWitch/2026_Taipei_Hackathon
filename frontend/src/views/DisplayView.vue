<script setup lang="ts">
/**
 * Step 2 of 2 — text size, and whether alerts are read aloud.
 *
 * The choice is made by looking at the result, not at a label: picking an
 * option changes the real sentence in the preview box immediately, the same way
 * iOS and Android present their own text-size settings. "大字" means nothing to
 * someone until they see how big it actually gets.
 *
 * Large is pre-selected (see DEFAULT_MODE), so this screen is already legible
 * to the person most likely to need it.
 */
import { useRouter } from 'vue-router';
import { s } from '@/i18n';
import { confirmChoice, profile, setMode, type Mode } from '@/stores/profile';
import { Vibe, say, vibrate } from '@/lib/announcer';
import BigButton from '@/components/BigButton.vue';

const router = useRouter();

const options: { value: Mode; label: 'modeStandard' | 'modeLarge' | 'modeVoice'; hint: 'modeStandardHint' | 'modeLargeHint' | 'modeVoiceHint'; scale: string }[] = [
  { value: 'standard', label: 'modeStandard', hint: 'modeStandardHint', scale: '1rem' },
  { value: 'large', label: 'modeLarge', hint: 'modeLargeHint', scale: '1.3rem' },
  { value: 'voice', label: 'modeVoice', hint: 'modeVoiceHint', scale: '1.3rem' }
];

const previewScale = () => options.find((o) => o.value === profile.mode)?.scale ?? '1rem';

function pick(mode: Mode): void {
  setMode(mode);
  vibrate(Vibe.tick);
  // Only speak when speech is the thing being chosen, so the other two options
  // do not talk at someone who did not ask for it.
  if (mode === 'voice') say(s.value.preview);
}

function start(): void {
  confirmChoice();
  router.replace({ name: 'plan', query: router.currentRoute.value.query });
}

function back(): void {
  router.back();
}
</script>

<template>
  <div class="page step">
    <p class="step__count" aria-hidden="true">2 / 2</p>

    <h1 class="step__h">
      <svg class="step__icon" viewBox="0 0 24 24" aria-hidden="true">
        <text x="1" y="19" font-size="15" font-weight="700" fill="currentColor">A</text>
        <text x="11" y="19" font-size="22" font-weight="700" fill="currentColor">A</text>
      </svg>
      {{ s.displayHeading }}
    </h1>
    <p class="step__hint">{{ s.displayHint }}</p>

    <ul class="rows">
      <li v-for="o in options" :key="o.value">
        <label class="row" :class="{ 'row--on': profile.mode === o.value }">
          <input
            class="sr-only"
            type="radio"
            name="mode"
            :value="o.value"
            :checked="profile.mode === o.value"
            @change="pick(o.value)"
          />
          <span class="row__text">
            <span class="row__label" :style="{ fontSize: o.scale }">{{ s[o.label] }}</span>
            <span class="row__hint">{{ s[o.hint] }}</span>
          </span>
          <svg v-if="profile.mode === o.value" class="row__tick" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
        </label>
      </li>
    </ul>

    <!-- A real line from the service, at the chosen size. aria-hidden because a
         screen reader already read the option it belongs to; this is for eyes. -->
    <p class="preview" :style="{ fontSize: previewScale() }" aria-hidden="true">
      {{ s.preview }}
    </p>

    <div class="page__actions">
      <BigButton @click="start">{{ s.start }}</BigButton>
      <BigButton variant="quiet" @click="back">{{ s.back }}</BigButton>
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
  width: 1.4em;
  height: 1.4em;
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

.row {
  width: 100%;
  min-height: 3.6rem;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 2px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--paper);
  cursor: pointer;
}

.row--on {
  border-color: var(--brand-fill);
  background: var(--teal-tint);
}

.row__text {
  flex: 1;
  min-width: 0;
}

.row__label {
  display: block;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.3;
}

.row--on .row__label {
  color: var(--teal);
}

.row__hint {
  display: block;
  margin-top: 4px;
  color: var(--ink-soft);
  font-size: 0.9rem;
  line-height: 1.4;
}

.row__tick {
  flex: none;
  width: 1.5rem;
  height: 1.5rem;
  color: var(--teal);
}

.row:focus-within {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
  box-shadow: 0 0 0 7px var(--focus-halo);
}

.preview {
  padding: 16px;
  border: 2px dashed var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink);
  font-weight: 700;
  line-height: 1.4;
  text-align: center;
}
</style>
