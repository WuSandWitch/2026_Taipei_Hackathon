<script setup lang="ts">
/**
 * Step 3: did the rider get on the right bus?
 * Compares the rider's position with the live position of buses on this route.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BigButton from '@/components/BigButton.vue';
import StepHeading from '@/components/StepHeading.vue';
import { say, Vibe } from '@/lib/announcer';
import { getLocation } from '@/lib/bridge';
import { source } from '@/data';
import { trip } from '@/stores/trip';
import { locale, s as L, spoken, t } from '@/i18n';

type Phase = 'checking' | 'ok' | 'wrong' | 'unknown' | 'error';

const router = useRouter();
const route = useRoute();
const phase = ref<Phase>('checking');
const r = computed(() => trip.route!);

/**
 * The backend writes `reason` as Chinese prose, so it is only shown to Chinese
 * readers. Everyone else gets the localised explanation instead — a Vietnamese
 * screen that suddenly drops into Chinese is worse than a slightly less
 * specific sentence.
 */
const reasonFor = (fallback: string) =>
  locale.value === 'zh-TW' ? (trip.boardCheck?.reason ?? fallback) : fallback;
let autoTimer = 0;

async function check() {
  phase.value = 'checking';
  say(t('sayChecking', { route: r.value.routeName }));
  try {
    const pos = await getLocation();
    const result = await source.checkBoarded(r.value, trip.plate, pos);
    trip.boardCheck = result;
    if (result.onBus) {
      if (result.plate) trip.plate = result.plate;
      phase.value = 'ok';
      say(
        t('sayOnBoard', {
          route: r.value.routeName,
          place: spoken(r.value.headsign, r.value.headsignEn)
        }),
        { vibe: Vibe.tick }
      );
      autoTimer = window.setTimeout(goRide, 5000);
    } else if (result.status === 'wrong_bus') {
      phase.value = 'wrong';
      say(t('sayWrongBus', { route: r.value.routeName }), { urgent: true, vibe: Vibe.warning });
    } else {
      // Not "wrong bus" — just no position data yet. Deliberately calmer: no
      // urgent announcement and no alarm buzz, because the usual cause is the
      // 15-60 s lag in A1 and the rider is most likely on the right bus.
      phase.value = 'unknown';
      say(t('sayUnknown'), { vibe: Vibe.tick });
    }
  } catch {
    phase.value = 'error';
    say(L.value.sayCantCheck, { urgent: true });
  }
}

function goRide() {
  window.clearTimeout(autoTimer);
  router.replace({ name: 'ride', query: route.query });
}

function waitAgain() {
  trip.arrival = null;
  trip.plate = undefined;
  router.replace({ name: 'wait', query: route.query });
}

onMounted(check);
onBeforeUnmount(() => window.clearTimeout(autoTimer));
</script>

<template>
  <div class="page">
    <template v-if="phase === 'checking'">
      <StepHeading :step="3" focus-key="checking">{{ L.checkTitle }}</StepHeading>
      <div class="card result">
        <div class="badge badge--wait" aria-hidden="true"><span class="spinner" /></div>
        <p class="lede">{{ t('checkBody', { route: r.routeName }) }}</p>
      </div>
    </template>

    <template v-else-if="phase === 'ok'">
      <StepHeading :step="3" focus-key="ok">{{ t('okTitle', { route: r.routeName }) }}</StepHeading>
      <div class="card result">
        <div class="badge badge--ok" aria-hidden="true">✓</div>
        <p class="big">{{ t('okBody', { place: r.headsign, stop: trip.destination?.name ?? '' }) }}</p>
        <p v-if="trip.plate" class="lede">{{ t('plateIs', { plate: trip.plate }) }}</p>
      </div>
      <div class="page__actions">
        <BigButton @click="goRide">{{ L.startRideAlert }}</BigButton>
      </div>
    </template>

    <template v-else-if="phase === 'wrong'">
      <StepHeading :step="3" focus-key="wrong">{{ t('wrongTitle', { route: r.routeName }) }}</StepHeading>
      <div class="card result">
        <div class="badge badge--bad" aria-hidden="true">!</div>
        <p class="big">{{ reasonFor(L.wrongBody) }}</p>
        <p class="lede">{{ L.wrongHint }}</p>
      </div>
      <div class="page__actions">
        <BigButton variant="danger" @click="waitAgain">{{ L.gotOffRewait }}</BigButton>
        <BigButton variant="secondary" @click="goRide">{{ L.sureRight }}</BigButton>
      </div>
    </template>

    <!-- Cannot tell yet. Separate from "wrong bus" on purpose: the common cause
         is that A1 has not refreshed, so the rider is probably on the right
         bus. Reminder colours, and "stay on" is the first action. -->
    <template v-else-if="phase === 'unknown'">
      <StepHeading :step="3" focus-key="unknown">{{ t('unknownTitle', { route: r.routeName }) }}</StepHeading>
      <div class="card result">
        <div class="badge badge--warn" aria-hidden="true">?</div>
        <p class="big">{{ reasonFor(L.unknownBody) }}</p>
        <p class="lede">{{ t('unknownHint', { route: r.routeName }) }}</p>
      </div>
      <div class="page__actions">
        <BigButton @click="check">{{ L.checkAgain }}</BigButton>
        <BigButton variant="secondary" @click="goRide">{{ L.sureRightStart }}</BigButton>
        <BigButton variant="quiet" @click="waitAgain">{{ L.gotOffRewait }}</BigButton>
      </div>
    </template>

    <template v-else>
      <StepHeading :step="3" focus-key="error">{{ L.cantCheckTitle }}</StepHeading>
      <div class="card result">
        <div class="badge badge--warn" aria-hidden="true">?</div>
        <p class="lede">{{ t('cantCheckBody', { route: r.routeName }) }}</p>
      </div>
      <div class="page__actions">
        <BigButton @click="check">{{ L.retry2 }}</BigButton>
        <BigButton variant="secondary" @click="goRide">{{ L.startRideAlert }}</BigButton>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Town Pass "Pop up / type3": white card, round icon on top, centred text. */
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
}

.badge--ok {
  background: var(--brand-fill);
  color: var(--on-brand);
}

.badge--bad {
  background: var(--danger);
  color: var(--paper);
}

/* Secondary 500 circle, like the kit's alert pop-up. Icon is decorative. */
.badge--warn {
  background: var(--tp-secondary-500);
  color: var(--tp-grayscale-950);
}

.badge--wait {
  background: var(--teal-tint);
}

.spinner {
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 50%;
  border: 5px solid var(--divider);
  border-top-color: var(--brand);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.big {
  font-size: 1.3rem;
  font-weight: 600;
  line-height: 1.4;
}
</style>
