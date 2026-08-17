import { renderHome } from './views/home.js';
import { renderNewLagerplatz } from './views/newLagerplatz.js';
import { renderNewVerschrottung } from './views/newVerschrottung.js';

const appEl = document.getElementById('app');

const router = {
  navigate(path) {
    window.location.hash = '#/' + path;
  },
};

let routeToken = 0;
async function route() {
  const myToken = ++routeToken;
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [head] = hash.split('/');
  try {
    if (!head) {
      await renderHome(appEl, router);
    } else if (head === 'neu-lagerplatz') {
      await renderNewLagerplatz(appEl, router);
    } else if (head === 'neu-verschrottung') {
      await renderNewVerschrottung(appEl, router);
    } else {
      await renderHome(appEl, router);
    }
  } catch (err) {
    if (myToken === routeToken) {
      appEl.innerHTML = `<div class="error-box">Fehler: ${err.message}</div>`;
    }
    console.error(err);
    return;
  }
  if (myToken !== routeToken) return; // eine neuere Navigation hat diese überholt
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', route);
} else {
  route();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW-Registrierung fehlgeschlagen', err));
  });
}
