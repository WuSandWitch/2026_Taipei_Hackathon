<script setup lang="ts">
/**
 * Step 1: where am I, which bus, where do I get off.
 * Sub-steps stay on one page; the heading re-focuses on each so screen readers follow.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BigButton from '@/components/BigButton.vue';
import LedSign from '@/components/LedSign.vue';
import StepHeading from '@/components/StepHeading.vue';
import { getLocation } from '@/lib/bridge';
import { say } from '@/lib/announcer';
import { source, type RouteOption, type RouteStop } from '@/data';
import { formatEta, resetTrip, trip, zhCount } from '@/stores/trip';
import { placeAlt, placeName, s as L, spoken, t } from '@/i18n';

type Phase = 'locating' | 'error' | 'route' | 'dest' | 'confirm';

const router = useRouter();
const route = useRoute();
const phase = ref<Phase>('locating');
const routes = ref<RouteOption[]>([]);

const stopsToGo = computed(() => {
  if (!trip.destination) return 0;
  return trip.stopsAhead.findIndex((s) => s.stopId === trip.destination!.stopId) + 1;
});

async function locate() {
  phase.value = 'locating';
  resetTrip(false);
  try {
    const pos = await getLocation();
    trip.stop = await source.nearestStop(pos);
    routes.value = await source.routesAtStop(trip.stop.id);
    phase.value = 'route';
    say(t('sayAtStop', { stop: spoken(trip.stop.name, trip.stop.nameEn), n: zhCount(routes.value.length) }));
  } catch {
    phase.value = 'error';
    say(t('sayNoStop'), { urgent: true });
  }
}

async function pickRoute(r: RouteOption) {
  if (!trip.stop) return;
  trip.route = r;
  trip.stopsAhead = await source.stopsAfter(r, trip.stop.id);
  phase.value = 'dest';
  say(t('sayRoutePicked', { route: r.routeName, place: spoken(r.headsign, r.headsignEn) }));
}

function pickDest(s: RouteStop) {
  trip.destination = s;
  phase.value = 'confirm';
  say(
    t('sayDestPicked', {
      route: trip.route!.routeName,
      stop: spoken(s.name, s.nameEn),
      n: zhCount(stopsToGo.value)
    })
  );
}

function backToRoutes() {
  trip.route = null;
  trip.destination = null;
  phase.value = 'route';
}

function backToDest() {
  trip.destination = null;
  phase.value = 'dest';
}

function start() {
  router.push({ name: 'wait', query: route.query });
}

function routeLabel(r: RouteOption) {
  return t('routeAria', { route: r.routeName, place: placeName(r.headsign, r.headsignEn), eta: formatEta(r.etaSec) });
}

function destLabel(s: RouteStop, i: number) {
  return t('destAria', { stop: placeName(s.name, s.nameEn), n: i + 1 });
}

onMounted(locate);
</script>

<template>
  <div class="page">
    <!-- Locating -->
    <template v-if="phase === 'locating'">
      <StepHeading :step="1" focus-key="locating">{{ L.locatingTitle }}</StepHeading>
      <p class="lede">{{ L.locatingBody }}</p>
    </template>

    <!-- Error -->
    <template v-else-if="phase === 'error'">
      <StepHeading :step="1" focus-key="error">{{ L.noStopTitle }}</StepHeading>
      <p class="lede">{{ L.noStopBody }}</p>
      <div class="page__actions">
        <BigButton @click="locate">{{ L.retry }}</BigButton>
      </div>
    </template>

    <!-- Pick a route -->
    <template v-else-if="phase === 'route'">
      <StepHeading :step="1" focus-key="route">{{ L.pickRouteTitle }}</StepHeading>
      <p class="section-title">
        {{ L.youAreAt }}
        <strong class="here">{{ placeName(trip.stop?.name ?? '', trip.stop?.nameEn) }}</strong>
        <span v-if="placeAlt(trip.stop?.name ?? '', trip.stop?.nameEn)" class="alt">
          {{ placeAlt(trip.stop?.name ?? '', trip.stop?.nameEn) }}
        </span>
      </p>
      <ul class="section list" :aria-label="L.routeListLabel">
        <li v-for="r in routes" :key="r.routeId + r.direction">
          <button type="button" class="row" :aria-label="routeLabel(r)" @click="pickRoute(r)">
            <span class="chip num" aria-hidden="true">{{ r.routeName }}</span>
            <span class="row__text" aria-hidden="true">
              <span class="row__main">{{ t('toward', { place: placeName(r.headsign, r.headsignEn) }) }}</span>
              <span class="row__sub" :class="{ 'row__sub--soon': (r.etaSec ?? 999) <= 180 }">{{ formatEta(r.etaSec) }}</span>
            </span>
            <span class="chevron" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <div class="page__actions">
        <BigButton variant="quiet" @click="locate">{{ L.relocate }}</BigButton>
      </div>
    </template>

    <!-- Pick destination -->
    <template v-else-if="phase === 'dest'">
      <StepHeading :step="1" focus-key="dest">{{ L.pickDestTitle }}</StepHeading>
      <p class="section-title">
        {{ t('takingRoute', { route: trip.route?.routeName ?? '', place: placeName(trip.route?.headsign ?? '', trip.route?.headsignEn) }) }}
      </p>
      <ol class="section list" :aria-label="L.destListLabel">
        <li v-for="(s, i) in trip.stopsAhead" :key="s.stopId">
          <button type="button" class="row row--stop" :aria-label="destLabel(s, i)" @click="pickDest(s)">
            <span class="row__count num" aria-hidden="true">{{ i + 1 }}</span>
            <span class="row__main" aria-hidden="true">
              {{ placeName(s.name, s.nameEn) }}
              <span v-if="placeAlt(s.name, s.nameEn)" class="alt">{{ placeAlt(s.name, s.nameEn) }}</span>
            </span>
            <span class="chevron" aria-hidden="true" />
          </button>
        </li>
      </ol>
      <div class="page__actions">
        <BigButton variant="quiet" @click="backToRoutes">{{ L.backToRoutes }}</BigButton>
      </div>
    </template>

    <!-- Confirm -->
    <template v-else-if="phase === 'confirm' && trip.route && trip.destination">
      <StepHeading :step="1" focus-key="confirm">{{ L.confirmTitle }}</StepHeading>
      <LedSign
        :route="trip.route.routeName"
        :headsign="placeName(trip.route.headsign, trip.route.headsignEn)"
        :status="t('getOffAt', { stop: placeName(trip.destination.name, trip.destination.nameEn) })"
        :detail="t('totalStops', { n: stopsToGo, eta: formatEta(trip.route.etaSec) })"
      />
      <p class="lede">{{ L.confirmBody }}</p>
      <div class="page__actions">
        <p class="page__hint" aria-hidden="true">
          {{ t('confirmHint', { n: stopsToGo, stop: placeName(trip.destination.name, trip.destination.nameEn) }) }}
        </p>
        <BigButton @click="start">{{ L.startTrip }}</BigButton>
        <BigButton variant="secondary" @click="backToDest">{{ L.backToDest }}</BigButton>
      </div>
    </template>
  </div>
</template>

<style scoped>
.here {
  color: var(--ink);
  font-size: 1.1rem;
}

/* Town Pass "Table item": white rows, 16px padding, Grey 100 divider inset 16px. */
.list {
  list-style: none;
  padding: 0;
}

.list li {
  padding: 0 var(--gutter);
}

.list li:active {
  background: var(--teal-tint);
}

.list li + li .row {
  border-top: 1px solid var(--divider);
}

.row {
  width: 100%;
  min-height: 4.2rem;
  padding: 14px 0;
  display: flex;
  align-items: center;
  gap: 16px;
  background: transparent;
  border: 0;
  text-align: left;
  color: var(--ink);
  cursor: pointer;
}

.row .chevron {
  margin-left: auto;
  color: var(--ink-soft);
}

/* Route number as a Town Pass tag (pill, primary border). */
.chip {
  flex: none;
  min-width: 4rem;
  padding: 4px 12px;
  border-radius: 32px;
  border: 1px solid var(--brand);
  background: var(--teal-tint);
  color: var(--teal);
  font-size: 1.35rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
}

.row__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row__main {
  font-size: 1.1rem;
  font-weight: 600;
}

.row__sub {
  color: var(--ink-soft);
  font-size: 0.9rem;
}

.row__sub--soon {
  color: var(--ok);
  font-weight: 600;
}

.row--stop {
  min-height: 3.6rem;
}

.row__count {
  flex: none;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  background: var(--teal-tint);
  color: var(--teal);
  display: grid;
  place-items: center;
  font-weight: 600;
  font-size: 0.95rem;
}
</style>
