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

type Phase = 'checking' | 'ok' | 'wrong' | 'unknown' | 'error';

const router = useRouter();
const route = useRoute();
const phase = ref<Phase>('checking');
const r = computed(() => trip.route!);
let autoTimer = 0;

async function check() {
  phase.value = 'checking';
  say(`正在確認你搭的是不是${r.value.routeName}，請稍等。`);
  try {
    const pos = await getLocation();
    const result = await source.checkBoarded(r.value, trip.plate, pos);
    trip.boardCheck = result;
    if (result.onBus) {
      if (result.plate) trip.plate = result.plate;
      phase.value = 'ok';
      say(`確認了，你在${r.value.routeName}上，往${r.value.headsign}。下車前會提醒你。`, { vibe: Vibe.tick });
      autoTimer = window.setTimeout(goRide, 5000);
    } else if (result.status === 'wrong_bus') {
      phase.value = 'wrong';
      say(`這班車可能不是${r.value.routeName}。${result.reason ?? ''}建議在下一站下車，我們會幫你重新等車。`, {
        urgent: true,
        vibe: Vibe.warning
      });
    } else {
      // Not "wrong bus" — just no position data yet. Deliberately calmer: no
      // urgent announcement and no alarm buzz, because the usual cause is the
      // 15-60 s lag in A1 and the rider is most likely on the right bus.
      phase.value = 'unknown';
      say(`還沒辦法確認。${result.reason ?? ''}`, { vibe: Vibe.tick });
    }
  } catch {
    phase.value = 'error';
    say('現在沒辦法確認，可能是網路不穩。你可以再試一次，或先開始下車提醒。', { urgent: true });
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
      <StepHeading :step="3" focus-key="checking">正在確認你搭的車</StepHeading>
      <div class="card result">
        <div class="badge badge--wait" aria-hidden="true"><span class="spinner" /></div>
        <p class="lede">比對你的位置和 {{ r.routeName }} 公車的即時位置，大約需要幾秒。</p>
      </div>
    </template>

    <template v-else-if="phase === 'ok'">
      <StepHeading :step="3" focus-key="ok">搭對了，你在 {{ r.routeName }} 上</StepHeading>
      <div class="card result">
        <div class="badge badge--ok" aria-hidden="true">✓</div>
        <p class="big">往 {{ r.headsign }}<br />在 {{ trip.destination?.name }} 下車</p>
        <p v-if="trip.plate" class="lede">車牌 <span class="num">{{ trip.plate }}</span></p>
      </div>
      <div class="page__actions">
        <BigButton @click="goRide">開始下車提醒</BigButton>
      </div>
    </template>

    <template v-else-if="phase === 'wrong'">
      <StepHeading :step="3" focus-key="wrong">這班可能不是 {{ r.routeName }}</StepHeading>
      <div class="card result">
        <div class="badge badge--bad" aria-hidden="true">!</div>
        <p class="big">{{ trip.boardCheck?.reason ?? '你的位置和這路公車對不起來。' }}</p>
        <p class="lede">建議在下一站下車，可以請司機或旁人協助。下車後我們會幫你重新等車。</p>
      </div>
      <div class="page__actions">
        <BigButton variant="danger" @click="waitAgain">我下車了，重新等車</BigButton>
        <BigButton variant="secondary" @click="goRide">我確定搭對了</BigButton>
      </div>
    </template>

    <!-- Cannot tell yet. Separate from "wrong bus" on purpose: the common cause
         is that A1 has not refreshed, so the rider is probably on the right
         bus. Reminder colours, and "stay on" is the first action. -->
    <template v-else-if="phase === 'unknown'">
      <StepHeading :step="3" focus-key="unknown">還沒辦法確認是不是 {{ r.routeName }}</StepHeading>
      <div class="card result">
        <div class="badge badge--warn" aria-hidden="true">?</div>
        <p class="big">{{ trip.boardCheck?.reason ?? '車上的定位還沒更新。' }}</p>
        <p class="lede">
          這不代表你搭錯車。公車的定位大約每分鐘才更新一次，先別急著下車。
          不放心的話，可以問司機：「這是 {{ r.routeName }} 嗎？」
        </p>
      </div>
      <div class="page__actions">
        <BigButton @click="check">再確認一次</BigButton>
        <BigButton variant="secondary" @click="goRide">我確定搭對了，開始提醒</BigButton>
        <BigButton variant="quiet" @click="waitAgain">我下車了，重新等車</BigButton>
      </div>
    </template>

    <template v-else>
      <StepHeading :step="3" focus-key="error">現在沒辦法確認</StepHeading>
      <div class="card result">
        <div class="badge badge--warn" aria-hidden="true">?</div>
        <p class="lede">可能是網路或定位不穩。你也可以直接問司機：「這是 {{ r.routeName }} 嗎？」</p>
      </div>
      <div class="page__actions">
        <BigButton @click="check">再試一次</BigButton>
        <BigButton variant="secondary" @click="goRide">先開始下車提醒</BigButton>
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
