<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
    disabled?: boolean;
  }>(),
  { variant: 'primary', disabled: false }
);
defineEmits<{ click: [] }>();
</script>

<template>
  <button type="button" class="btn" :class="`btn--${variant}`" :disabled="disabled" @click="$emit('click')">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  min-height: 3.6rem;
  width: 100%;
  padding: 14px 20px;
  border-radius: var(--radius-md);
  border: 3px solid transparent;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.25;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 80ms ease, background-color 120ms ease;
}

.btn:active:not(:disabled) {
  transform: scale(0.985);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--teal);
  color: var(--on-teal);
}

.btn--primary:active:not(:disabled) {
  background: var(--teal-press);
}

.btn--secondary {
  background: var(--paper);
  color: var(--teal);
  border-color: var(--teal);
}

.btn--quiet {
  background: var(--surface);
  color: var(--ink);
}

.btn--danger {
  background: var(--danger);
  color: var(--paper);
}
</style>
