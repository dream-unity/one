import { portals, portalUrl, worlds } from './catalog.js';
import { $, esc } from './ui.js';
const id = document.body.dataset.portal;
const portal = portals.find(p => p.id === id);
const picker = $('#portal-select');
picker.innerHTML = `<option value="">All portals</option>` + portals.map(p => `<option value="${esc(p.id)}" ${id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
picker.addEventListener('change', () => { location.href = picker.value ? portalUrl(picker.value) : new URL('./', import.meta.url).href; });
if (portal) {
  const next = portals.find(p => p.id === portal.next);
  $('#next-portal').href = portalUrl(next.id);
  $('#next-portal').textContent = `Next: ${next.name} · ${next.title} →`;
  const modules = {
    body: () => import('./experiences/body.js'),
    perceive: () => import('./experiences/perceive.js'),
    predict: () => import('./experiences/predict.js'),
    intend: () => import('./experiences/intend.js'),
    act: () => import('./experiences/act.js'),
    become: () => import('./experiences/become.js'),
    matter: () => import('./experiences/matter.js'),
    structure: () => import('./experiences/structure.js'),
    emerge: () => import('./experiences/emerge.js')
  };
  try { const module = await modules[id](); module.mount(); }
  catch (error) {
    console.error('The portal could not start.', error);
    $('#stage').innerHTML = '<div class="center-scene"><h2>This portal could not open.</h2><p>Reload the page to try again, or choose another portal above.</p><button type="button" class="primary" id="reload">Try again</button></div>';
    $('#reload').addEventListener('click', () => location.reload());
  }
} else {
  $('#portal-groups').innerHTML = Object.entries(worlds).map(([world, name]) => `<section class="portal-group" data-world="${world}"><div class="group-heading"><h2>${name}</h2><span>${{machine:'Feel. Think. Move.',maker:'Choose. Try. Grow.',world:'Experiment. Connect. Discover.'}[world]}</span></div><div class="portal-grid">${portals.filter(p => p.world === world).map(p => `<a class="portal-tile" href="${esc(portalUrl(p.id))}"><span class="tile-name">${p.name}<span aria-hidden="true">↗</span></span><h3>${p.title}</h3><p>${p.line}</p><small>${p.type} · ${p.time}</small></a>`).join('')}</div></section>`).join('');
}
