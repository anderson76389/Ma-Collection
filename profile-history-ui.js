import {readProfiles, readProfileHistory} from './profile-history.mjs';

const views = {library:'Bibliothèque', progress:'Progression', watched:'Titres vus'};
const dateFormat = new Intl.DateTimeFormat('fr-FR', {dateStyle:'medium'});
let dialog, profiles, lists, activeView, generation = 0, displayed = 0, opener;

const api = () => window.MaCollectionAccount;
const el = key => dialog.querySelector('[data-history="' + key + '"]');
const notice = message => { el('status').textContent = message; };
const formatSearch = value => value.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{M}/gu, '');
const formatDate = value => value > 0 && value <= 8.64e15 ? dateFormat.format(value) : '';
const pageSize = 50;

function clearLists() {
  lists = null;
  displayed = pageSize;
  el('search').value = '';
  for (const key of ['search','view','export']) el(key).disabled = true;
  el('rows').replaceChildren();
  el('more').hidden = true;
}

function mount() {
  dialog = document.createElement('dialog');
  dialog.className = 'mc-profile-panel mc-history';
  dialog.id = 'mc-profile-history';
  dialog.setAttribute('aria-labelledby', 'mc-profile-history-title');
  dialog.innerHTML = `<header>
    <h2 id="mc-profile-history-title">Bibliothèque et historique Kovelyx</h2>
    <button type="button" data-history="close">Fermer</button>
  </header>
  <p>Retrouve les titres enregistrés et vus, et la progression de lecture synchronisée sur ton profil Kovelyx.</p>
  <div class="mc-profile-toolbar">
    <button type="button" data-history="account">Compte Kovelyx</button>
    <button type="button" data-history="profiles">Actualiser les profils</button>
  </div>
  <div class="mc-profile-fields">
    <label>Profil <select data-history="profile" disabled><option value="">Choisir un profil</option></select></label>
    <label>Rubrique <select data-history="view" disabled>
      <option value="library">Bibliothèque</option>
      <option value="progress">Progression</option>
      <option value="watched">Titres vus</option>
    </select></label>
  </div>
  <label>Rechercher un titre <input type="search" data-history="search" disabled></label>
  <p role="status" data-history="status"></p>
  <ul data-history="rows"></ul>
  <div class="mc-profile-toolbar">
    <button type="button" data-history="more" hidden>Afficher plus de titres</button>
    <button type="button" data-history="export" disabled>Télécharger l’historique et la bibliothèque (.json)</button>
  </div>`;
  document.body.append(dialog);
  el('close').onclick = () => dialog.close();
  el('account').onclick = () => { dialog.close(); window.MaCollectionAccountUi?.openModal('cloud'); };
  el('profiles').onclick = loadProfiles;
  el('profile').onchange = loadHistory;
  el('view').onchange = () => { activeView = el('view').value; displayed = pageSize; renderRows(); };
  el('search').oninput = () => { displayed = pageSize; renderRows(); };
  el('more').onclick = () => { displayed += pageSize; renderRows(); };
  el('export').onclick = exportHistory;
  dialog.addEventListener('close', () => {
    // A close notification can arrive after a new opening.
    if (dialog.open) return;
    generation++;
    clearLists();
    profiles = [];
    el('profile').length = 1;
    const active = document.activeElement;
    if (active === document.body || dialog.contains(active)) opener?.focus();
  });
}

function sessionFetch(ticket) {
  const account = api();
  const session = account?.status();
  if (!session?.cloudSignedIn) throw new Error('Connecte-toi à Kovelyx pour consulter tes profils.');
  return async path => {
    const current = account.status();
    if (ticket !== generation || !dialog.open || !current.cloudSignedIn ||
        current.cloudEmail !== session.cloudEmail) throw new Error('Lecture annulée.');
    return account.cloudFetch(path);
  };
}

async function loadProfiles() {
  const ticket = ++generation;
  clearLists();
  profiles = [];
  el('profile').length = 1;
  el('profile').disabled = true;
  notice('Chargement des profils…');
  try {
    const result = await readProfiles(sessionFetch(ticket));
    if (ticket !== generation || !dialog.open) return;
    profiles = result;
    for (const {id,name} of profiles) el('profile').add(new Option(name,id));
    el('profile').disabled = !profiles.length;
    notice(profiles.length ? 'Choisis un profil pour afficher ses données.' : 'Aucun profil Kovelyx disponible.');
  } catch (error) {
    if (ticket === generation && dialog.open) notice(error.message || 'Impossible de lire les profils.');
  }
}

async function loadHistory() {
  const ticket = ++generation;
  clearLists();
  const profile = profiles.find(p => p.id === el('profile').value);
  if (!profile) { notice('Choisis un profil pour afficher ses données.'); return; }
  notice('Lecture du profil…');
  try {
    const result = await readProfileHistory(sessionFetch(ticket),profile.id);
    if (ticket !== generation || !dialog.open) return;
    lists = result;
    for (const key of ['search','view','export']) el(key).disabled = false;
    activeView = el('view').value;
    renderRows();
  } catch (error) {
    if (ticket === generation && dialog.open) notice(error.message || 'Impossible de lire ce profil.');
  }
}

function renderRows() {
  if (!lists) return;
  const search = formatSearch(el('search').value.trim());
  const filtered = lists[activeView].filter(row => formatSearch(row.title).includes(search));
  const fragment = document.createDocumentFragment();
  for (const item of filtered.slice(0, displayed)) {
    const li = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const content = [item.season != null ? 'Saison ' + item.season : '', item.episode != null ? 'Épisode ' + item.episode : '', formatDate(item.updatedAt)];
    if (item.completed) content.push('Terminé');
    else if (item.durationMs > 0 && item.positionMs != null) content.push(Math.min(100,Math.round(item.positionMs/item.durationMs*100)) + ' %');
    const detail = document.createElement('span');
    detail.textContent = content.filter(Boolean).join(' · ');
    li.append(title, detail);
    fragment.append(li);
  }
  el('rows').replaceChildren(fragment);
  el('more').hidden = filtered.length <= displayed;
  notice(filtered.length ? views[activeView] + ' · ' + filtered.length + (filtered.length === 1 ? ' titre' : ' titres') : (search ? 'Aucun titre ne correspond à cette recherche.' : 'Aucun titre synchronisé dans cette rubrique.'));
}

function exportHistory() {
  if (!lists) return;
  const file = new Blob([JSON.stringify({schema:1, ...lists},null,2)],{type:'application/json'});
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Kovelyx-bibliotheque-historique.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function open() {
  if (!dialog) mount();
  if (dialog.open) return;
  opener = document.activeElement;
  dialog.showModal();
  loadProfiles();
}

document.getElementById('home-profile-history')?.addEventListener('click', open);
window.MaCollectionProfileHistory = Object.freeze({open});
