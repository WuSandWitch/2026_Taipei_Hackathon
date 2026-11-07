<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { announcer, probeNativeTts, setTtsEnabled, stopSpeaking } from '@/lib/announcer';
import { source } from '@/data';
import { resetTrip } from '@/stores/trip';

const route = useRoute();
const router = useRouter();

const onTrip = computed(() => route.name !== 'plan' && route.name !== 'arrive');
const title = computed(() => (route.meta.title as string) || '公車陪你搭');

// Ending a trip by accident is costly for a blind rider, so it takes two presses.
const armed = ref(false);
let armTimer = 0;
function endTrip() {
  if (!armed.value) {
    armed.value = true;
    armTimer = window.setTimeout(() => (armed.value = false), 4000);
    return;
  }
  window.clearTimeout(armTimer);
  armed.value = false;
  stopSpeaking();
  resetTrip();
  router.replace({ name: 'plan', query: route.query });
}

onMounted(probeNativeTts);
onBeforeUnmount(() => {
  window.clearTimeout(armTimer);
  stopSpeaking();
});
</script>

<template>
  <!-- Town Pass "Top navigation / text button": white bar, centred title,
       text button on the left, control on the right. -->
  <header class="bar">
    <div class="bar__side">
      <button v-if="onTrip" type="button" class="bar__end" :class="{ 'bar__end--armed': armed }" @click="endTrip">
        {{ armed ? '再按一次結束' : '結束行程' }}
      </button>
    </div>

    <div class="bar__title" aria-hidden="true">
      <span>{{ title }}</span>
      <span v-if="source.isMock" class="bar__mock">模擬資料</span>
    </div>
    <p v-if="source.isMock" class="sr-only">目前使用模擬資料</p>

    <div class="bar__side bar__side--end">
      <button
        type="button"
        role="switch"
        class="toggle"
        aria-label="語音播報"
        :aria-checked="announcer.ttsEnabled"
        @click="setTtsEnabled(!announcer.ttsEnabled)"
      >
        <span class="toggle__label">語音</span>
        <span class="toggle__track" aria-hidden="true"><span class="toggle__knob" /></span>
      </button>
    </div>
  </header>

  <main>
    <RouterView />
  </main>

  <!-- Live regions: every announcement also lands here for VoiceOver / TalkBack. -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">{{ announcer.polite }}</div>
  <div class="sr-only" aria-live="assertive" aria-atomic="true">{{ announcer.assertive }}</div>
</template>

<style scoped>
.bar {
  position: sticky;
  top: 0;
  z-index: 10;
  min-height: var(--bar-h);
  padding: 4px 8px;
  background: var(--paper);
  box-shadow: var(--shadow-bar);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
}

.bar__side {
  display: flex;
  align-items: center;
  min-width: 0;
}

.bar__side--end {
  justify-content: flex-end;
}

.bar__title {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--ink-2);
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.3;
  text-align: center;
}

.bar__mock {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--ink-soft);
}

/* Text button, as in the kit's top navigation. */
.bar__end {
  min-height: 48px;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--teal);
  font-size: 0.9rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.bar__end--armed {
  background: var(--danger);
  color: var(--paper);
}

/* Notification Toggle from the kit (40×26 track, 20px knob), in a 48px target. */
.toggle {
  min-height: 48px;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-2);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.toggle__track {
  position: relative;
  flex: none;
  width: 40px;
  height: 26px;
  border-radius: 27px;
  background: var(--line);
  transition: background-color 120ms ease;
}

.toggle__knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--tp-white);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: transform 120ms ease;
}

.toggle[aria-checked='true'] .toggle__track {
  background: var(--brand-fill);
}

.toggle[aria-checked='true'] .toggle__knob {
  transform: translateX(14px);
}
</style>
