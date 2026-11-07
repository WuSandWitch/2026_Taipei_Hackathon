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
  if (!u) return '查詢中';
  if (u.status === 'at_stop') return '車子到了';
  if (u.status === 'arriving') return '即將進站';
  if (u.status === 'departed') return '剛開走了';
  if (u.status === 'no_service') return '目前沒有班次';
  return formatEta(u.etaSec);
});

const others = computed(() => (a.value?.otherArriving ?? []).filter((n) => n !== r.value.routeName));

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
    say(`進站的是${o}，不是你要的${name}，請繼續等。`, { urgent: true, vibe: Vibe.warning });
  }
  lastOthers = o;

  if (u.status === 'at_stop') {
    once('at_stop', () => {
      say(`${name}到了，就在站牌前。上車後，請按「我上車了」。`, { urgent: true, vibe: Vibe.arriving });
      notify(`${name} 到站了`, '上車後請在城市通按「我上車了」');
    });
    return;
  }
  if (u.status === 'departed') {
    fired.delete('at_stop');
    fired.delete('arriving');
    fired.delete('1min');
    fired.delete('3min');
    say(`${name}已經開走了。我們會繼續幫你等下一班。`, { urgent: true, vibe: Vibe.warning });
    return;
  }
  if (u.status === 'arriving') {
    once('arriving', () => say(`${name}即將進站，請準備上車。`, { urgent: true, vibe: Vibe.arriving }));
    return;
  }
  const eta = u.etaSec;
  if (eta === null) return;
  if (eta <= 60) once('1min', () => say(`${name}大約一分鐘後到，請到站牌前準備。`, { vibe: Vibe.tick }));
  else if (eta <= 180) once('3min', () => say(`${name}大約${zhCount(Math.round(eta / 60))}分鐘後到。`));
}

function boarded() {
  router.push({ name: 'board', query: route.query });
}

onMounted(() => {
  const eta = trip.route?.etaSec;
  say(`開始等車。${r.value.routeName}${formatEta(eta)}到站，車快到時會提醒你。`);
  unwatch = source.watchArrival(r.value, trip.stop!.id, onUpdate);
});
onBeforeUnmount(() => unwatch?.());
</script>

<template>
  <div class="page">
    <StepHeading :step="2">在站牌等 {{ r.routeName }}</StepHeading>

    <LedSign
      :route="r.routeName"
      :headsign="r.headsign"
      :status="status"
      :detail="trip.plate ? `車牌 ${trip.plate}` : undefined"
    />

    <p v-if="others.length" class="warn" role="note">
      進站的是 <strong class="num">{{ others.join('、') }}</strong>，不是你要的車
    </p>
    <p v-else class="lede">在 {{ trip.destination?.name }} 下車。車快到、車到站時，會用語音和震動提醒你。</p>

    <div class="page__actions">
      <BigButton :variant="a?.status === 'at_stop' ? 'primary' : 'secondary'" @click="boarded">我上車了</BigButton>
      <BigButton variant="secondary" @click="showDriverCard = true">給司機看：我要搭這班</BigButton>
      <BigButton variant="quiet" @click="repeatLast">再說一次</BigButton>
    </div>
  </div>

  <DriverCard v-if="showDriverCard" :route="r.routeName" @close="showDriverCard = false" />
</template>

<style scoped>
.warn {
  background: var(--danger-tint);
  color: var(--danger);
  border: 2px solid var(--danger-fill);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  font-size: 1.1rem;
  font-weight: 600;
}
</style>
