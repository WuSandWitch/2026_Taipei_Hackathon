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
      <p class="here">
        你在 <strong>{{ trip.stop?.name }}</strong>
      </p>
      <ul class="list" aria-label="這個站牌的公車">
        <li v-for="r in routes" :key="r.routeId + r.direction">
          <button type="button" class="row" :aria-label="routeLabel(r)" @click="pickRoute(r)">
            <span class="chip num" aria-hidden="true">{{ r.routeName }}</span>
            <span class="row__text" aria-hidden="true">
              <span class="row__main">往 {{ r.headsign }}</span>
              <span class="row__sub" :class="{ 'row__sub--soon': (r.etaSec ?? 999) <= 180 }">{{ formatEta(r.etaSec) }}</span>
            </span>
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
      <p class="here">
        搭 <strong class="num">{{ trip.route?.routeName }}</strong>，往{{ trip.route?.headsign }}
      </p>
      <ol class="list" aria-label="下車站">
        <li v-for="(s, i) in trip.stopsAhead" :key="s.stopId">
          <button type="button" class="row row--stop" :aria-label="destLabel(s, i)" @click="pickDest(s)">
            <span class="row__count num" aria-hidden="true">{{ i + 1 }}</span>
            <span class="row__main" aria-hidden="true">{{ s.name }}</span>
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
        <BigButton @click="start">開始，陪我搭車</BigButton>
        <BigButton variant="secondary" @click="backToDest">重選下車站</BigButton>
      </div>
    </template>
  </div>
</template>

<style scoped>
.here {
  font-size: 1.05rem;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border-top: 2px solid var(--line);
}

.list li {
  border-bottom: 2px solid var(--line);
}

.row {
  width: 100%;
  min-height: 4.4rem;
  padding: 12px 4px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: transparent;
  border: 0;
  text-align: left;
  cursor: pointer;
}

.row:active {
  background: var(--teal-tint);
}

.chip {
  flex: none;
  min-width: 4.2rem;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--led-bg);
  color: var(--led);
  font-size: 1.6rem;
  font-weight: 800;
  text-align: center;
  line-height: 1.1;
}

.row__text {
  display: flex;
  flex-direction: column;
}

.row__main {
  font-size: 1.2rem;
  font-weight: 700;
}

.row__sub {
  color: var(--ink-soft);
  font-weight: 600;
}

.row__sub--soon {
  color: var(--ok);
}

.row--stop {
  min-height: 3.8rem;
}

.row__count {
  flex: none;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  border: 2px solid var(--teal);
  color: var(--teal);
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 1rem;
}
</style>
