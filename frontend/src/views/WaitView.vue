<script setup lang="ts">
/**
 * Step 2: waiting at the stop.
 * Counts down, warns when a different bus pulls in, and alerts when ours arrives.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BigButton from '@/components/BigButton.vue';
import DriverCard from '@/components/DriverCard.vue';
import LedSign from '@/components/LedSign.vue';
import StepHeading from '@/components/StepHeading.vue';
import { repeatLast, say, Vibe } from '@/lib/announcer';
import { notify } from '@/lib/bridge';
import { source, type ArrivalUpdate } from '@/data';
import { formatEta, trip, zhCount } from '@/stores/trip';
import { placeName, s as L, t } from '@/i18n';

const router = useRouter();
const route = useRoute();
const showDriverCard = ref(false);
const fired = new Set<string>();
let lastOthers = '';
let unwatch: (() => void) | null = null;

const r = computed(() => trip.route!);
const a = computed(() => trip.arrival);

const status = computed(() => {
  const u = a.value;
  if (!u) return L.value.statusChecking;
  if (u.status === 'at_stop') return L.value.statusAtStop;
  if (u.status === 'arriving') return L.value.statusArriving;
  if (u.status === 'departed') return L.value.statusDeparted;
  if (u.status === 'no_service') return L.value.statusNoService;
  return formatEta(u.etaSec);
});

const others = computed(() => (a.value?.otherArriving ?? []).filter((n) => n !== r.value.routeName));

// The card is always available, and becomes the primary action once a driver
// could actually see it. Hiding it until then was a mistake: a control nobody
// can find is the same as one that does not exist, and someone who wants to
// rehearse before the bus arrives — or flag down a bus the service has not
// noticed yet — has every reason to open it early.
const flagDownIsNext = computed(
  () => a.value?.status === 'arriving' || a.value?.status === 'at_stop'
);

function once(key: string, fn: () => void) {
  if (fired.has(key)) return;
  fired.add(key);
  fn();
}

function onUpdate(u: ArrivalUpdate) {
  trip.arrival = u;
  if (u.plate) trip.plate = u.plate;
  const name = r.value.routeName;

  // A different bus pulling in: the moment blind riders most often board the wrong bus.
  const o = u.otherArriving.filter((n) => n !== name).join('、');
  if (o && o !== lastOthers) {
    say(t('sayOtherBus', { others: o, route: name }), { urgent: true, vibe: Vibe.warning });
  }
  lastOthers = o;

  if (u.status === 'at_stop') {
    once('at_stop', () => {
      say(t('sayArrived', { route: name }), { urgent: true, vibe: Vibe.arriving });
      notify(t('notifyArrivedTitle', { route: name }), L.value.notifyArrivedBody);
    });
    return;
  }
  if (u.status === 'departed') {
    fired.delete('at_stop');
    fired.delete('arriving');
    fired.delete('1min');
    fired.delete('3min');
    say(t('sayDeparted', { route: name }), { urgent: true, vibe: Vibe.warning });
    return;
  }
  if (u.status === 'arriving') {
    once('arriving', () => say(t('sayArriving', { route: name }), { urgent: true, vibe: Vibe.arriving }));
    return;
  }
  const eta = u.etaSec;
  if (eta === null) return;
  if (eta <= 60) once('1min', () => say(t('sayOneMin', { route: name }), { vibe: Vibe.tick }));
  else if (eta <= 180) once('3min', () => say(t('sayMins', { route: name, n: zhCount(Math.round(eta / 60)) })));
}

function boarded() {
  router.push({ name: 'board', query: route.query });
}

onMounted(() => {
  const eta = trip.route?.etaSec;
  say(t('sayWaitStart', { route: r.value.routeName, eta: formatEta(eta) }));
  unwatch = source.watchArrival(r.value, trip.stop!.id, onUpdate);
});
onBeforeUnmount(() => unwatch?.());
</script>

<template>
  <div class="page">
    <StepHeading :step="2">{{ t('waitTitle', { route: r.routeName }) }}</StepHeading>

    <LedSign
      :route="r.routeName"
      :headsign="placeName(r.headsign, r.headsignEn)"
      :status="status"
      :detail="trip.plate ? t('plateIs', { plate: trip.plate }) : undefined"
    />

    <p v-if="others.length" class="warn" role="note">
      {{ t('notYourBus', { others: others.join('、') }) }}
    </p>
    <p v-else class="lede">{{ t('waitBody', { stop: placeName(trip.destination?.name ?? '', trip.destination?.nameEn) }) }}</p>

    <div class="page__actions">
      <BigButton :variant="flagDownIsNext ? 'primary' : 'secondary'" @click="showDriverCard = true">
        {{ L.showDriver }}
      </BigButton>
      <BigButton :variant="a?.status === 'at_stop' ? 'primary' : 'secondary'" @click="boarded">
        {{ L.iBoarded }}
      </BigButton>
      <BigButton variant="quiet" @click="repeatLast">{{ L.sayAgain }}</BigButton>
    </div>
  </div>

  <DriverCard v-if="showDriverCard" :route="r.routeName" @close="showDriverCard = false" />
</template>

<style scoped>
.warn {
  /* reminder, not alarm: another bus pulling in is a notice and nothing has
     gone wrong yet. Red is kept for the wrong-bus case, so the two read
     differently to someone who can make out colour at all. */
  background: var(--reminder-tint);
  color: var(--reminder);
  border: 2px solid var(--reminder-fill);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  font-size: 1.1rem;
  font-weight: 600;
}
</style>
