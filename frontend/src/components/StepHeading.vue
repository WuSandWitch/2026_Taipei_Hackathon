<script setup lang="ts">
/**
 * Page heading that takes focus when shown, so screen readers announce the new
 * step right away. Also shows which of the four steps the rider is on, as text
 * plus a four-segment progress bar in Town Pass primary.
 */
import { nextTick, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  step?: number;
  /** Change this to re-focus the heading within the same page (sub-steps). */
  focusKey?: string | number;
}>();

const el = ref<HTMLHeadingElement | null>(null);

async function focusHeading() {
  await nextTick();
  el.value?.focus();
}

onMounted(focusHeading);
watch(() => props.focusKey, focusHeading);
</script>

<template>
  <div class="heading">
    <template v-if="step">
      <div class="heading__bar" aria-hidden="true">
        <span v-for="n in 4" :key="n" :class="{ on: n <= step }" />
      </div>
      <p class="heading__step">第 {{ step }} 步，共 4 步</p>
    </template>
    <h1 ref="el" tabindex="-1"><slot /></h1>
  </div>
</template>

<style scoped>
.heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.heading__bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 4px;
}

.heading__bar span {
  height: 4px;
  border-radius: 2px;
  background: var(--divider);
}

.heading__bar span.on {
  background: var(--brand);
}

.heading__step {
  color: var(--teal);
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
