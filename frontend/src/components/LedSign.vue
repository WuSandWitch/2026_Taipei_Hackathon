<script setup lang="ts">
/**
 * The bus head-sign: route number in big amber digits on black.
 * Text stays real text so screen readers read it; the dot grid is decoration.
 */
defineProps<{
  route: string;
  headsign?: string;
  /** Large status line under the route, e.g. "約 3 分鐘" / "下一站 善導寺". */
  status?: string;
  /** Smaller detail line. */
  detail?: string;
}>();
</script>

<template>
  <section class="led" aria-label="公車資訊">
    <div class="led__top">
      <p class="led__route num" :class="{ 'led__route--long': route.length > 3 }">{{ route }}</p>
      <p v-if="headsign" class="led__headsign">往 {{ headsign }}</p>
    </div>
    <p v-if="status" class="led__status">{{ status }}</p>
    <p v-if="detail" class="led__detail">{{ detail }}</p>
    <slot />
  </section>
</template>

<style scoped>
.led {
  position: relative;
  background-color: var(--led-bg);
  background-image: radial-gradient(rgba(255, 176, 0, 0.13) 1.2px, transparent 1.4px);
  background-size: 7px 7px;
  color: var(--led);
  border-radius: var(--radius-lg);
  padding: 20px 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: inset 0 0 0 3px var(--led-bezel);
}

.led__top {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  column-gap: 16px;
}

.led__route {
  /* Capped by width so 200% text size never clips the number. */
  font-size: min(4.6rem, 25vw);
  line-height: 0.95;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.led__route--long {
  font-size: min(3rem, 15vw);
}

.led__headsign {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--led-soft);
}

.led__status {
  font-size: 1.9rem;
  line-height: 1.2;
  font-weight: 800;
}

.led__detail {
  font-size: 1.05rem;
  color: var(--led-soft);
}
</style>
