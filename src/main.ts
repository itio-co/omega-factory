import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { maximizeOnLaunch } from './lib/pwaWindow';

maximizeOnLaunch(window);
mount(App, { target: document.getElementById('app')! });

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}
