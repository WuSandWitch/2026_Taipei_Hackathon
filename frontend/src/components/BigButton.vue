<script setup lang="ts">
/**
 * Town Pass "Button/L": 8px radius, semibold label, filled primary or
 * outlined secondary. Taller than the kit's 48–56px because riders tap it
 * without looking.
 */
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
  min-height: 3.5rem;
  width: 100%;
  padding: 12px 20px;
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 120ms ease;
}

.btn:disabled {
  background: var(--surface);
  border-color: var(--surface);
  color: var(--ink-soft);
  cursor: not-allowed;
}

.btn--primary {
  background: var(--brand-fill);
  color: var(--on-brand);
}

.btn--primary:active:not(:disabled) {
  background: var(--brand-press);
}

/* Outlined: white fill, teal border and label. */
.btn--secondary {
  background: var(--paper);
  color: var(--teal);
  border-color: var(--brand-fill);
}

.btn--secondary:active:not(:disabled) {
  background: var(--teal-tint);
}

/* Grey button from the kit; label darkened to stay readable. */
.btn--quiet {
  background: var(--surface);
  color: var(--ink);
}

.btn--danger {
  background: var(--danger);
  color: var(--paper);
}
</style>
