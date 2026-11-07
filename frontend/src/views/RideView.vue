<script setup lang="ts">
/**
 * Step 4: on the bus. Announces each next stop, warns two stops ahead,
 * and tells the rider to press the bell one stop before the destination.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BigButton from '@/components/BigButton.vue';
import LedSign from '@/components/LedSign.vue';
import StepHeading from '@/components/StepHeading.vue';
import { repeatLast, say, Vibe } from '@/lib/announcer';
import { notify } from '@/lib/bridge';
import { source, type RidePosition } from '@/data';
import { boardingSeq, nextStop, stopsLeft, trip, zhCount } from '@/stores/trip';

const router = useRouter();
const route = useRoute();
const fired = new Set<string>();
let unwatch: (() => void) | null = null;

const r = computed(() => trip.route!);
const dest = computed(() => trip.destination!);
const left = computed(() => stopsLeft.value ?? 0);
const getOffNext = computed(() => left.value === 1 && trip.ride?.atStop === false);

/** Stops from the current position up to the destination, for the strip. */
const strip = computed(() => {
  const seq = trip.ride?.seq ?? boardingSeq.value;
  return trip.stopsAhead.filter((s) => s.seq > seq && s.seq <= dest.value.seq);
});

function whereAmI(): string {
  const n = nextStop.value;
  if (!n) return `快到${dest.value.name}了。`;
  if (left.value === 1) return `下一站就是${dest.value.name}，請按下車鈴。`;
  return `下一站${n.name}，還有${zhCount(left.value)}站到${dest.value.name}。`;
}

function onPos(p: RidePosition) {
  trip.ride = p;
  const d = dest.value;

  if (p.seq > d.seq) {
    once(`passed-${p.seq}`, () =>
      say(`已經過了${d.name}。請在下一站下車，再搭反方向回去。`, { urgent: true, vibe: Vibe.warning })
    );
    return;
  }
  if (p.atStop && p.seq === d.seq) {
    once('arrived', () => {
      say(`到了，${d.name}到了，請下車。`, { urgent: true, vibe: Vibe.arrived });
      notify(`${d.name} 到了`, '請下車');
      router.replace({ name: 'arrive', query: route.query });
    });
    return;
  }
  // Announce once per departure from a stop.
  if (!p.atStop) {
    const n = d.seq - p.seq;
    const next = nextStop.value;
    once(`leave-${p.seq}`, () => {
      if (n === 1) {
        say(`下一站就是${d.name}，請按下車鈴，準備下車。`, { urgent: true, vibe: Vibe.getOffNext });
        notify('下一站下車', `請按下車鈴，下一站是 ${d.name}`);
      } else if (n === 2) {
        say(`下一站${next?.name ?? ''}。再兩站就要下車。`, { vibe: Vibe.tick });
      } else {
        say(`下一站${next?.name ?? ''}，還有${zhCount(n)}站。`);
      }
    });
  }
}

function once(key: string, fn: () => void) {
  if (fired.has(key)) return;
  fired.add(key);
  fn();
}

onMounted(() => {
  say(`開始下車提醒。到${dest.value.name}還有${zhCount(left.value)}站，可以把手機收起來，到站前會震動提醒你。`);
  unwatch = source.watchRide(r.value, trip.plate ?? '', boardingSeq.value, onPos);
});
onBeforeUnmount(() => unwatch?.());
</script>

<template>
  <div class="page">
    <StepHeading :step="4">到 {{ dest.name }} 下車</StepHeading>

    <LedSign
      :route="r.routeName"
      :headsign="r.headsign"
      :status="nextStop ? `下一站 ${nextStop.name}` : `${dest.name}`"
      :detail="left > 0 ? `還有 ${left} 站到 ${dest.name}` : '到站了'"
    />

    <p v-if="getOffNext" class="bell" role="note">下一站下車<br />請按下車鈴</p>

    <ol class="card strip" aria-label="接下來的站">
      <li
        v-for="s in strip"
        :key="s.stopId"
        :class="{ 'strip__item--next': s.seq === nextStop?.seq, 'strip__item--dest': s.seq === dest.seq }"
        :aria-current="s.seq === nextStop?.seq ? 'step' : undefined"
      >
        <span class="strip__dot" aria-hidden="true" />
        <span class="strip__name">{{ s.name }}</span>
        <span v-if="s.seq === dest.seq" class="strip__tag">下車</span>
        <span v-else-if="s.seq === nextStop?.seq" class="strip__tag strip__tag--next">下一站</span>
      </li>
    </ol>

    <div class="page__actions">
      <BigButton @click="say(whereAmI())">現在到哪裡了？</BigButton>
      <BigButton variant="quiet" @click="repeatLast">再說一次</BigButton>
    </div>
  </div>
</template>

<style scoped>
.bell {
  background: var(--led);
  color: #000;
  border-radius: var(--radius-lg);
  padding: 18px 16px;
  font-size: 2rem;
  line-height: 1.2;
  font-weight: 700;
  text-align: center;
}

.strip {
  list-style: none;
  margin: 0;
  padding: 12px var(--gutter);
  display: flex;
  flex-direction: column;
}

/* Three columns: a fixed rail column for the dot, the stop name, the tag.
   The rail and every dot are centred on the same column, so nothing pokes out. */
.strip li {
  --rail-col: 28px;
  position: relative;
  display: grid;
  grid-template-columns: var(--rail-col) minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 14px;
  min-height: 3rem;
  padding: 4px 0;
}

/* Rail line connecting the dots. */
.strip li::before {
  content: '';
  position: absolute;
  left: calc(var(--rail-col) / 2 - 2px);
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--divider);
}

.strip li:first-child::before {
  top: 50%;
}

.strip li:last-child::before {
  bottom: 50%;
}

.strip li:only-child::before {
  display: none;
}

.strip__dot {
  position: relative;
  z-index: 1;
  justify-self: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--paper);
  border: 4px solid var(--line);
}

.strip__name {
  grid-column: 2;
  font-size: 1.1rem;
  color: var(--ink-soft);
  overflow-wrap: anywhere;
}

.strip__item--next .strip__dot {
  border-color: var(--brand-fill);
  background: var(--brand-fill);
}

.strip__item--next .strip__name {
  color: var(--ink);
  font-weight: 600;
}

.strip__item--dest .strip__dot {
  width: var(--rail-col);
  height: var(--rail-col);
  border-color: var(--ink);
  background: var(--led);
}

.strip__item--dest .strip__name {
  color: var(--ink);
  font-weight: 600;
  font-size: 1.25rem;
}

.strip__tag {
  grid-column: 3;
  white-space: nowrap;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 32px;
  background: var(--ink);
  color: var(--paper);
}

.strip__tag--next {
  background: var(--teal-tint);
  color: var(--teal);
  box-shadow: inset 0 0 0 1px var(--brand);
}
</style>
