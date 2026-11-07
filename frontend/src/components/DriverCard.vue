<script setup lang="ts">
/**
 * Full-screen card the rider holds up to flag the bus down. In Taipei a bus
 * only stops if you signal it, so this is the moment the service exists for —
 * which is why WaitView only offers it once the bus is close enough for a
 * driver to see it, rather than as a button that is always sitting there.
 *
 * The driver-facing text is hardcoded Chinese and is NOT translated. The person
 * reading it is a Taipei bus driver; a Vietnamese card helps nobody. Only the
 * instruction to the rider follows their own language.
 *
 * Maximum contrast, no motion, no flashing.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { s } from '@/i18n';

defineProps<{ route: string }>();
const emit = defineEmits<{ close: [] }>();

const closeBtn = ref<HTMLButtonElement | null>(null);

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}

onMounted(async () => {
  window.addEventListener('keydown', onKey);
  await nextTick();
  closeBtn.value?.focus();
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="driver" role="dialog" aria-modal="true" aria-labelledby="driver-card-title">
    <!-- Rider-facing: their language. -->
    <p class="driver__hint">{{ s.driverHint }}</p>

    <!-- Driver-facing: always Chinese, whatever the rider chose. -->
    <h1 id="driver-card-title" class="driver__route num" lang="zh-TW">{{ route }}</h1>
    <p class="driver__msg" lang="zh-TW">我要搭這班，請停車</p>
    <p class="driver__sub" lang="zh-TW">謝謝您</p>

    <button ref="closeBtn" type="button" class="driver__close" @click="emit('close')">
      {{ s.close }}
    </button>
  </div>
</template>

<style scoped>
.driver {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--led-bg);
  color: var(--sign-ink);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px var(--gutter) calc(24px + env(safe-area-inset-bottom));
  gap: 12px;
}

.driver__hint {
  color: var(--sign-ink-dim);
  font-size: 1rem;
}

.driver__route {
  color: var(--led);
  font-size: clamp(6rem, 42vw, 11rem);
  line-height: 1;
  font-weight: 900;
}

.driver__msg {
  font-size: clamp(2rem, 10vw, 3rem);
  font-weight: 800;
  line-height: 1.2;
}

.driver__sub {
  font-size: 1.3rem;
  font-weight: 600;
  max-width: 18em;
}

.driver__close {
  margin-top: 28px;
  min-height: 3.6rem;
  min-width: 60%;
  border-radius: var(--radius-md);
  border: 3px solid var(--sign-ink);
  background: transparent;
  color: var(--sign-ink);
  font-size: 1.15rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
