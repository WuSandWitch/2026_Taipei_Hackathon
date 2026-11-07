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
    say(`你在${trip.stop.name}。這裡有${zhCount(routes.value.length)}條路線，請選擇要搭的公車。`);
  } catch {
    phase.value = 'error';
    say('找不到附近的站牌。請確認定位已開啟，再試一次。', { urgent: true });
  }
}

async function pickRoute(r: RouteOption) {
  if (!trip.stop) return;
  trip.route = r;
  trip.stopsAhead = await source.stopsAfter(r, trip.stop.id);
  phase.value = 'dest';
  say(`${r.routeName}，往${r.headsign}。請選擇要在哪一站下車。`);
}

function pickDest(s: RouteStop) {
  trip.destination = s;
  phase.value = 'confirm';
  say(`搭${trip.route!.routeName}，在${s.name}下車，共${zhCount(stopsToGo.value)}站。確認的話，請按開始。`);
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
  return `${r.routeName}，往${r.headsign}，${formatEta(r.etaSec)}`;
}

function destLabel(s: RouteStop, i: number) {
  return `${s.name}，第${i + 1}站`;
}

onMounted(locate);
</script>

<template>
  <div class="page">
    <!-- Locating -->
    <template v-if="phase === 'locating'">
      <StepHeading :step="1" focus-key="locating">正在找你附近的站牌</StepHeading>
      <p class="lede">請稍等，正在確認你的位置。</p>
    </template>

    <!-- Error -->
    <template v-else-if="phase === 'error'">
      <StepHeading :step="1" focus-key="error">找不到附近的站牌</StepHeading>
      <p class="lede">請確認手機的定位已開啟，並允許城市通使用位置，再試一次。</p>
      <div class="page__actions">
        <BigButton @click="locate">再試一次</BigButton>
      </div>
    </template>

    <!-- Pick a route -->
    <template v-else-if="phase === 'route'">
      <StepHeading :step="1" focus-key="route">要搭哪一路公車？</StepHeading>
      <p class="section-title">
        你在 <strong class="here">{{ trip.stop?.name }}</strong>
      </p>
      <ul class="section list" aria-label="這個站牌的公車">
        <li v-for="r in routes" :key="r.routeId + r.direction">
          <button type="button" class="row" :aria-label="routeLabel(r)" @click="pickRoute(r)">
            <span class="chip num" aria-hidden="true">{{ r.routeName }}</span>
            <span class="row__text" aria-hidden="true">
              <span class="row__main">往 {{ r.headsign }}</span>
              <span class="row__sub" :class="{ 'row__sub--soon': (r.etaSec ?? 999) <= 180 }">{{ formatEta(r.etaSec) }}</span>
            </span>
            <span class="chevron" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <div class="page__actions">
        <BigButton variant="quiet" @click="locate">不是這個站牌？重新定位</BigButton>
      </div>
    </template>

    <!-- Pick destination -->
    <template v-else-if="phase === 'dest'">
      <StepHeading :step="1" focus-key="dest">在哪一站下車？</StepHeading>
      <p class="section-title">
        搭 <strong class="num here">{{ trip.route?.routeName }}</strong>，往{{ trip.route?.headsign }}
      </p>
      <ol class="section list" aria-label="下車站">
        <li v-for="(s, i) in trip.stopsAhead" :key="s.stopId">
          <button type="button" class="row row--stop" :aria-label="destLabel(s, i)" @click="pickDest(s)">
            <span class="row__count num" aria-hidden="true">{{ i + 1 }}</span>
            <span class="row__main" aria-hidden="true">{{ s.name }}</span>
            <span class="chevron" aria-hidden="true" />
          </button>
        </li>
      </ol>
      <div class="page__actions">
        <BigButton variant="quiet" @click="backToRoutes">重選公車</BigButton>
      </div>
    </template>

    <!-- Confirm -->
    <template v-else-if="phase === 'confirm' && trip.route && trip.destination">
      <StepHeading :step="1" focus-key="confirm">確認這趟車</StepHeading>
      <LedSign
        :route="trip.route.routeName"
        :headsign="trip.route.headsign"
        :status="`到 ${trip.destination.name} 下車`"
        :detail="`共 ${stopsToGo} 站，公車${formatEta(trip.route.etaSec)}到`"
      />
      <p class="lede">接下來會用語音和震動提醒你：車快到了、有沒有上對車、什麼時候下車。</p>
      <div class="page__actions">
        <p class="page__hint" aria-hidden="true">共 {{ stopsToGo }} 站・在 {{ trip.destination.name }} 下車</p>
        <BigButton @click="start">開始，陪我搭車</BigButton>
        <BigButton variant="secondary" @click="backToDest">重選下車站</BigButton>
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
