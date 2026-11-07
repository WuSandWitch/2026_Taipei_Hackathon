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

type Phase = 'checking' | 'ok' | 'wrong' | 'error';

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
    } else {
      phase.value = 'wrong';
      say(`這班車可能不是${r.value.routeName}。${result.reason ?? ''}建議在下一站下車，我們會幫你重新等車。`, {
        urgent: true,
        vibe: Vibe.warning
      });
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
      <div class="badge badge--wait" aria-hidden="true"><span class="spinner" /></div>
      <p class="lede">比對你的位置和 {{ r.routeName }} 公車的即時位置，大約需要幾秒。</p>
    </template>

    <template v-else-if="phase === 'ok'">
      <StepHeading :step="3" focus-key="ok">搭對了，你在 {{ r.routeName }} 上</StepHeading>
      <div class="badge badge--ok" aria-hidden="true">✓</div>
      <p class="big">往 {{ r.headsign }}<br />在 {{ trip.destination?.name }} 下車</p>
      <p v-if="trip.plate" class="lede">車牌 <span class="num">{{ trip.plate }}</span></p>
      <div class="page__actions">
        <BigButton @click="goRide">開始下車提醒</BigButton>
      </div>
    </template>

    <template v-else-if="phase === 'wrong'">
      <StepHeading :step="3" focus-key="wrong">這班可能不是 {{ r.routeName }}</StepHeading>
      <div class="badge badge--bad" aria-hidden="true">!</div>
      <p class="big">{{ trip.boardCheck?.reason ?? '你的位置和這路公車對不起來。' }}</p>
      <p class="lede">建議在下一站下車，可以請司機或旁人協助。下車後我們會幫你重新等車。</p>
      <div class="page__actions">
        <BigButton variant="danger" @click="waitAgain">我下車了，重新等車</BigButton>
        <BigButton variant="secondary" @click="goRide">我確定搭對了</BigButton>
      </div>
    </template>

    <template v-else>
      <StepHeading :step="3" focus-key="error">現在沒辦法確認</StepHeading>
      <p class="lede">可能是網路或定位不穩。你也可以直接問司機：「這是 {{ r.routeName }} 嗎？」</p>
      <div class="page__actions">
        <BigButton @click="check">再試一次</BigButton>
        <BigButton variant="secondary" @click="goRide">先開始下車提醒</BigButton>
      </div>
    </template>
  </div>
</template>

<style scoped>
.badge {
  width: 9rem;
  height: 9rem;
  border-radius: 50%;
  margin: 12px auto 0;
  display: grid;
  place-items: center;
  font-size: 5rem;
  font-weight: 900;
  line-height: 1;
}

.badge--ok {
  background: var(--ok-tint);
  color: var(--ok);
  border: 6px solid var(--ok);
}

.badge--bad {
  background: var(--danger-tint);
  color: var(--danger);
  border: 6px solid var(--danger);
}

.badge--wait {
  background: var(--surface);
}

.spinner {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  border: 6px solid var(--line);
  border-top-color: var(--teal);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.big {
  font-size: 1.4rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.4;
}
</style>
