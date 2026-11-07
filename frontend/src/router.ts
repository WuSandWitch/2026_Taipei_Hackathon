import { createRouter, createWebHistory } from 'vue-router';
import LanguageView from '@/views/LanguageView.vue';
import DisplayView from '@/views/DisplayView.vue';
import PlanView from '@/views/PlanView.vue';
import WaitView from '@/views/WaitView.vue';
import BoardCheckView from '@/views/BoardCheckView.vue';
import RideView from '@/views/RideView.vue';
import ArriveView from '@/views/ArriveView.vue';
import { trip } from '@/stores/trip';
import { profile } from '@/stores/profile';
import { s } from '@/i18n';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    // Two steps, one decision each: language, then text size.
    { path: '/', name: 'language', component: LanguageView },
    { path: '/setup', name: 'display', component: DisplayView },
    { path: '/plan', name: 'plan', component: PlanView },
    { path: '/wait', name: 'wait', component: WaitView, meta: { needsTrip: true } },
    { path: '/board', name: 'board', component: BoardCheckView, meta: { needsTrip: true } },
    { path: '/ride', name: 'ride', component: RideView, meta: { needsTrip: true } },
    { path: '/arrive', name: 'arrive', component: ArriveView, meta: { needsTrip: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
});

router.beforeEach((to) => {
  // Someone arriving with their language and mode already settled — a returning
  // user, or one who came in through a Town Pass card carrying ?profile= —
  // should not be asked again. See stores/profile.ts for the precedence rules.
  if (to.name === 'language' && profile.chosen) {
    return { name: 'plan', query: to.query };
  }
  // A reload mid-trip loses in-memory state; start over instead of showing an
  // empty screen.
  if (to.meta.needsTrip && (!trip.route || !trip.destination)) {
    return { name: 'plan', query: to.query };
  }
  return true;
});

// The WebView header already shows the service name, so the document title is
// only here for a desktop browser tab.
router.afterEach(() => {
  document.title = s.value.appName;
});

export default router;
