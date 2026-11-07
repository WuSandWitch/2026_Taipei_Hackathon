<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { announcer, probeNativeTts, setTtsEnabled, stopSpeaking } from '@/lib/announcer';
import { source } from '@/data';
import { resetTrip } from '@/stores/trip';

const route = useRoute();
const router = useRouter();

const onTrip = computed(() => route.name !== 'plan' && route.name !== 'arrive');

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
  <header class="bar">
    <button v-if="onTrip" type="button" class="bar__end" :class="{ 'bar__end--armed': armed }" @click="endTrip">
      {{ armed ? '再按一次，結束行程' : '結束行程' }}
    </button>
    <p v-if="source.isMock" class="bar__mock">模擬資料</p>
    <button
      type="button"
      class="bar__tts"
      :aria-pressed="announcer.ttsEnabled"
      @click="setTtsEnabled(!announcer.ttsEnabled)"
    >
      語音播報：{{ announcer.ttsEnabled ? '開' : '關' }}
    </button>
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
  max-width: 560px;
  margin: 0 auto;
  min-height: 64px;
  padding: 8px var(--gutter);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.bar__end,
.bar__tts {
  min-height: 48px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 2px solid var(--line);
  background: var(--paper);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.bar__tts {
  margin-left: auto;
}

.bar__end--armed {
  background: var(--danger);
  border-color: var(--danger);
  color: var(--paper);
}

.bar__mock {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ink-soft);
  border: 1px dashed var(--line);
  border-radius: 6px;
  padding: 2px 6px;
}
</style>
