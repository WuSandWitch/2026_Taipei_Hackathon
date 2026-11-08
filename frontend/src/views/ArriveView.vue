<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import BigButton from '@/components/BigButton.vue';
import StepHeading from '@/components/StepHeading.vue';
import { repeatLast } from '@/lib/announcer';
import { resetTrip, trip } from '@/stores/trip';
import { placeName, s as L, t } from '@/i18n';

const router = useRouter();
const route = useRoute();
const destName = placeName(trip.destination?.name ?? '', trip.destination?.nameEn);

function done() {
  resetTrip();
  router.replace({ name: 'plan', query: route.query });
}
</script>

<template>
  <div class="page">
    <StepHeading>{{ t('arriveTitle', { stop: destName }) }}</StepHeading>
    <div class="card result">
      <div class="badge" aria-hidden="true">✓</div>
      <p class="lede">{{ L.arriveBody }}</p>
    </div>
    <div class="page__actions">
      <BigButton @click="done">{{ L.done }}</BigButton>
      <BigButton variant="quiet" @click="repeatLast">{{ L.sayAgain }}</BigButton>
    </div>
  </div>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.badge {
  width: 5.5rem;
  height: 5.5rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
  background: var(--brand-fill);
  color: var(--on-brand);
}
</style>
