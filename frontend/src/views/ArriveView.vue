<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import BigButton from '@/components/BigButton.vue';
import StepHeading from '@/components/StepHeading.vue';
import { repeatLast } from '@/lib/announcer';
import { resetTrip, trip } from '@/stores/trip';

const router = useRouter();
const route = useRoute();
const destName = trip.destination?.name ?? '';

function done() {
  resetTrip();
  router.replace({ name: 'plan', query: route.query });
}
</script>

<template>
  <div class="page">
    <StepHeading>{{ destName }} 到了，請下車</StepHeading>
    <div class="badge" aria-hidden="true">✓</div>
    <p class="lede center">下車時請小心腳步。需要協助可以請司機或旁人幫忙。</p>
    <div class="page__actions">
      <BigButton @click="done">完成</BigButton>
      <BigButton variant="quiet" @click="repeatLast">再說一次</BigButton>
    </div>
  </div>
</template>

<style scoped>
.badge {
  width: 9rem;
  height: 9rem;
  border-radius: 50%;
  margin: 12px auto 0;
  display: grid;
  place-items: center;
  font-size: 5rem;
  font-weight: 900;
  background: var(--led-bg);
  color: var(--led);
}

.center {
  text-align: center;
}
</style>
