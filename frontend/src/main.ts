import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { initProfile } from './stores/profile';
import './styles.css';

// Resolve language and mode before the first render, so nobody sees a flash of
// Chinese on the way to their own language.
initProfile();

createApp(App).use(router).mount('#app');
