import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { appFeatures } from './lib/features';
import { maximizeIfEnabled } from './lib/pwaWindow';

void appFeatures().then((features) => maximizeIfEnabled(features, window));
mount(App, { target: document.getElementById('app')! });

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}
