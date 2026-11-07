<script setup lang="ts">
/**
 * Page heading that takes focus when shown, so screen readers announce the new
 * step right away. Also shows which of the four steps the rider is on.
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
    <p v-if="step" class="heading__step">第 {{ step }} 步，共 4 步</p>
    <h1 ref="el" tabindex="-1"><slot /></h1>
  </div>
</template>

<style scoped>
.heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.heading__step {
  color: var(--ink-soft);
  font-size: 0.9rem;
  font-weight: 600;
}
</style>
