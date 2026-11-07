import { createRouter, createWebHistory } from 'vue-router';
import PlanView from '@/views/PlanView.vue';
import WaitView from '@/views/WaitView.vue';
import BoardCheckView from '@/views/BoardCheckView.vue';
import RideView from '@/views/RideView.vue';
import ArriveView from '@/views/ArriveView.vue';
import { trip } from '@/stores/trip';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'plan', component: PlanView, meta: { title: '公車陪你搭' } },
    { path: '/wait', name: 'wait', component: WaitView, meta: { title: '等車', needsTrip: true } },
    { path: '/board', name: 'board', component: BoardCheckView, meta: { title: '確認上車', needsTrip: true } },
    { path: '/ride', name: 'ride', component: RideView, meta: { title: '下車提醒', needsTrip: true } },
    { path: '/arrive', name: 'arrive', component: ArriveView, meta: { title: '到站', needsTrip: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
});

router.beforeEach((to) => {
  // A reload mid-trip loses in-memory state; start over instead of showing an empty screen.
  if (to.meta.needsTrip && (!trip.route || !trip.destination)) return { name: 'plan', query: to.query };
  return true;
});

router.afterEach((to) => {
  document.title = (to.meta.title as string) || '公車陪你搭';
});

export default router;
