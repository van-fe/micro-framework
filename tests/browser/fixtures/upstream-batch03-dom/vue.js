import { createApp } from 'vue';
import App from './App.vue';
import './global.css';
let app;
window.Batch03App = { mount() { app = createApp(App); app.mount('#app'); }, unmount() { app.unmount(); } };
