<script setup lang="ts">
/**
 * Full-screen card the rider holds up toward the bus driver.
 * Maximum contrast, no motion, no flashing.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

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
    <p class="driver__hint">把螢幕朝向司機</p>
    <h1 id="driver-card-title" class="driver__route num">{{ route }}</h1>
    <p class="driver__msg">我要搭這班車</p>
    <p class="driver__sub">我看不見，請等我上車，謝謝</p>
    <button ref="closeBtn" type="button" class="driver__close" @click="emit('close')">關閉</button>
  </div>
</template>

<style scoped>
.driver {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px var(--gutter) calc(24px + env(safe-area-inset-bottom));
  gap: 12px;
}

.driver__hint {
  color: #bdbdbd;
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
  border: 3px solid #fff;
  background: transparent;
  color: #fff;
  font-size: 1.15rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
