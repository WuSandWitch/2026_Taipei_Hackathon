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
import { placeAlt, placeName, s as L, spoken, t } from '@/i18n';
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
  const d = spoken(dest.value.name, dest.value.nameEn);
  if (!n) return t('whereNearDest', { stop: d });
  if (left.value === 1) return t('whereBellNow', { stop: d });
  return t('whereNextStop', { next: spoken(n.name, n.nameEn), n: zhCount(left.value), stop: d });
}

function onPos(p: RidePosition) {
  trip.ride = p;
  const d = dest.value;

  if (p.seq > d.seq) {
    once(`passed-${p.seq}`, () =>
      say(t('sayPassed', { stop: spoken(d.name, d.nameEn) }), { urgent: true, vibe: Vibe.warning })
    );
    return;
  }
  if (p.atStop && p.seq === d.seq) {
    once('arrived', () => {
      say(t('sayGetOffNow', { stop: spoken(d.name, d.nameEn) }), { urgent: true, vibe: Vibe.arrived });
      notify(t('notifyArrivedDest', { stop: d.name }), L.value.tagGetOff);
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
        say(t('sayNextIsDest', { stop: spoken(d.name, d.nameEn) }), { urgent: true, vibe: Vibe.getOffNext });
        notify(L.value.notifyGetOffTitle, t('notifyGetOffBody', { stop: d.name }));
      } else if (n === 2) {
        say(t('sayTwoLeft', { stop: spoken(next?.name ?? '', next?.nameEn) }), { vibe: Vibe.tick });
      } else {
        say(t('sayNextStop', { stop: spoken(next?.name ?? '', next?.nameEn), n: zhCount(n) }));
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
  say(
    t('sayRideStart', {
      stop: spoken(dest.value.name, dest.value.nameEn),
      n: zhCount(left.value)
    })
  );
  unwatch = source.watchRide(r.value, trip.plate ?? '', boardingSeq.value, onPos);
});
onBeforeUnmount(() => unwatch?.());
</script>

<template>
  <div class="page">
    <StepHeading :step="4">{{ t('rideTitle', { stop: placeName(dest.name, dest.nameEn) }) }}</StepHeading>

    <LedSign
      :route="r.routeName"
      :headsign="placeName(r.headsign, r.headsignEn)"
      :status="nextStop ? t('nextStopIs', { stop: placeName(nextStop.name, nextStop.nameEn) }) : placeName(dest.name, dest.nameEn)"
      :detail="left > 0 ? t('rideLeft', { n: left, stop: placeName(dest.name, dest.nameEn) }) : L.rideArrived"
    />

    <p v-if="getOffNext" class="bell" role="note">{{ L.bellNow }}</p>

    <ol class="card strip" :aria-label="L.stripLabel">
      <li
        v-for="s in strip"
        :key="s.stopId"
        :class="{ 'strip__item--next': s.seq === nextStop?.seq, 'strip__item--dest': s.seq === dest.seq }"
        :aria-current="s.seq === nextStop?.seq ? 'step' : undefined"
      >
        <span class="strip__dot" aria-hidden="true" />
        <span class="strip__name">
          {{ placeName(s.name, s.nameEn) }}
          <span v-if="placeAlt(s.name, s.nameEn)" class="alt">{{ placeAlt(s.name, s.nameEn) }}</span>
        </span>
        <span v-if="s.seq === dest.seq" class="strip__tag">{{ L.tagGetOff }}</span>
        <span v-else-if="s.seq === nextStop?.seq" class="strip__tag strip__tag--next">{{ L.tagNext }}</span>
      </li>
    </ol>

    <div class="page__actions">
      <BigButton @click="say(whereAmI())">{{ L.whereNow }}</BigButton>
      <BigButton variant="quiet" @click="repeatLast">{{ L.sayAgain }}</BigButton>
    </div>
  </div>
</template>

<style scoped>
.bell {
  background: var(--led);
  color: var(--led-ink);
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
