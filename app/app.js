// Leonida Trophy Guide — an offline checklist and tracker for the 55 GTA VI
// trophies. Progress lives in localStorage; export and import are local files.
// The trophy data (names, descriptions, grades, guides) comes from
// data/trophies.json, fetched from this app's own folder and nowhere else.

const STORAGE_KEY = 'leonida-trophy-guide-v1';
const DATA_URL = 'data/trophies.json';

const STAGES = [
  { n: 1, title: 'Story — first playthrough', blurb: 'Play the story in order: the four chapters and the named missions inside them. Nothing here is missable — just keep playing.' },
  { n: 2, title: 'The finale', blurb: 'Finish the final mission. One gold trophy, earned by completing the story.' },
  { n: 3, title: 'Character finales & stranger strands', blurb: 'Finish the mission strands for Andy, Kenton, Billy, Randy and Tyrone, and complete 8 stranger strands across Leonida.' },
  { n: 4, title: 'Activities & challenges', blurb: 'Stunts, races, the shooting range, fishing, arcade, meditation, hunting and the rest — the skill and pastime trophies.' },
  { n: 5, title: 'Open-world crime', blurb: 'Robberies, getaways and wanted-level feats. Read the missables page first: several of these need a specific setup.' },
  { n: 6, title: 'Collectibles, exploration & cleanup', blurb: 'Cards, WAiNK spots, vehicles, areas, garages — plus the slow counters that finish while you do everything else.' },
  { n: 7, title: 'The platinum', blurb: 'Earn the other 54 and this unlocks by itself. The last trophy you will earn.' },
];

const KIND_LABELS = {
  story: 'Story',
  missable: 'Missable',
  collectibles: 'Collectibles',
  activities: 'Activities',
  online: 'Online',
  platinum: 'Platinum',
};

const state = {
  trophies: [],
  sources: {},
  earned: new Set(),
  kind: 'all',
  grade: 'all',
  search: '',
  earnedOnly: false,
  spoilersHidden: false,
  view: 'guide',
};

const $ = (id) => document.getElementById(id);

function loadEarned() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const names = JSON.parse(raw);
    return new Set(Array.isArray(names) ? names : []);
  } catch {
    return new Set();
  }
}

function saveEarned() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.earned]));
  $('saveState').textContent = 'Progress saved in this browser.';
}

function trophyIsEarned(t) {
  return state.earned.has(t.name);
}

function isSpoilerHidden(t) {
  return state.spoilersHidden && t.kind === 'story' && !trophyIsEarned(t);
}

function sourceLink(id) {
  const s = state.sources[id];
  if (!s) return id;
  const a = document.createElement('a');
  a.href = s.url;
  a.textContent = s.label;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function gradeBadge(t) {
  const b = document.createElement('span');
  b.className = 'grade-badge grade-' + t.grade;
  b.textContent = t.grade;
  return b;
}

function buildCard(t) {
  const card = document.createElement('article');
  card.className = 'trophy-card' + (trophyIsEarned(t) ? ' earned' : '');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = trophyIsEarned(t);
  box.setAttribute('aria-label', 'Mark ' + t.name + ' as earned');
  box.addEventListener('change', () => {
    if (box.checked) state.earned.add(t.name);
    else state.earned.delete(t.name);
    saveEarned();
    renderAll();
  });
  card.append(box);

  const name = document.createElement('h3');
  name.className = 'trophy-name';
  name.textContent = isSpoilerHidden(t) ? 'Hidden story trophy' : t.name;
  card.append(name);
  card.append(gradeBadge(t));
  if (t.missable) {
    const flag = document.createElement('span');
    flag.className = 'flag';
    flag.textContent = 'MISSABLE';
    card.append(flag);
  }

  if (isSpoilerHidden(t)) {
    const note = document.createElement('p');
    note.className = 'spoiler-note';
    note.textContent = 'Spoilers hidden: earn this story trophy to reveal its name, description and guide.';
    card.append(note);
  } else {
    const desc = document.createElement('p');
    desc.className = 'official-desc';
    desc.textContent = '“' + t.description + '”';
    card.append(desc);
    const guide = document.createElement('p');
    guide.className = 'guide-text';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'Guide — ';
    guide.append(label, document.createTextNode(t.guide));
    card.append(guide);
    const stage = STAGES.find((s) => s.n === t.stage);
    const tag = document.createElement('p');
    tag.className = 'stage-tag';
    tag.textContent = 'Roadmap: stage ' + t.stage + ' — ' + (stage ? stage.title : '') + ' · Kind: ' + KIND_LABELS[t.kind];
    card.append(tag);
  }

  const sources = document.createElement('p');
  sources.className = 'sources';
  sources.append(document.createTextNode('Sources: '));
  (t.sources || ['exophase', 'psnprofiles']).forEach((id, i) => {
    if (i > 0) sources.append(document.createTextNode(' · '));
    sources.append(sourceLink(id));
  });
  card.append(sources);
  return card;
}

function trophyMatches(t) {
  if (state.kind === 'missable') {
    if (!t.missable) return false;
  } else if (state.kind !== 'all' && t.kind !== state.kind) {
    return false;
  }
  if (state.grade !== 'all' && t.grade !== state.grade) return false;
  if (state.earnedOnly && !trophyIsEarned(t)) return false;
  if (state.search) {
    const q = state.search.toLowerCase();
    const hay = (t.name + ' ' + t.description + ' ' + t.guide).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function renderList() {
  const list = $('trophyList');
  list.replaceChildren();
  const shown = state.trophies.filter(trophyMatches);
  $('resultLine').textContent =
    'Showing ' + shown.length + ' of ' + state.trophies.length + ' trophies' +
    (state.kind === 'online' ? ' — the official list has no online trophies.' : '');
  for (const t of shown) list.append(buildCard(t));
  if (shown.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'No trophies match these filters. Clear the search or pick another kind.';
    list.append(p);
  }
}

function renderMissables() {
  const list = $('missableList');
  list.replaceChildren();
  for (const t of state.trophies.filter((x) => x.missable)) {
    list.append(buildCard(t));
  }
}

function renderRoadmap() {
  const list = $('roadmapList');
  list.replaceChildren();
  for (const stage of STAGES) {
    const li = document.createElement('li');
    const h = document.createElement('h3');
    h.textContent = 'Stage ' + stage.n + ' — ' + stage.title;
    const p = document.createElement('p');
    p.textContent = stage.blurb;
    const chips = document.createElement('div');
    chips.className = 'chips';
    const members = state.trophies.filter((t) => t.stage === stage.n);
    for (const t of members) {
      const chip = document.createElement('span');
      chip.className = 'chip' + (trophyIsEarned(t) ? ' done' : '');
      chip.textContent = (trophyIsEarned(t) ? '✓ ' : '') + t.name + ' (' + t.grade + ')';
      chips.append(chip);
    }
    const count = document.createElement('p');
    const done = members.filter(trophyIsEarned).length;
    count.textContent = done + ' of ' + members.length + ' done in this stage.';
    li.append(h, p, chips, count);
    list.append(li);
  }
}

function renderProgress() {
  const total = state.trophies.length;
  const earned = state.earned.size;
  $('earnedCount').textContent = String(earned);
  $('meterFill').style.width = total ? Math.round((earned / total) * 100) + '%' : '0%';
  const parts = ['platinum', 'gold', 'silver', 'bronze'].map((g) => {
    const inGrade = state.trophies.filter((t) => t.grade === g);
    const got = inGrade.filter(trophyIsEarned).length;
    return got + '/' + inGrade.length + ' ' + g;
  });
  $('gradeCounts').textContent = parts.join(' · ');
  const others = state.trophies.filter((t) => t.grade !== 'platinum');
  const othersDone = others.filter(trophyIsEarned).length;
  $('platinumNote').textContent = 'Platinum: ' + othersDone + ' of ' + others.length + ' others earned';
  const next = [...state.trophies]
    .filter((t) => !trophyIsEarned(t) && t.grade !== 'platinum')
    .sort((a, b) => a.stage - b.stage || a.id - b.id)[0];
  $('nextUp').textContent = next
    ? 'Next up: ' + next.name + ' (stage ' + next.stage + ')'
    : 'All 54 others earned — the platinum is yours.';
  $('missablePill').textContent = String(state.trophies.filter((t) => t.missable).length);
}

function renderAll() {
  renderProgress();
  renderList();
  renderRoadmap();
  renderMissables();
}

function switchView(view) {
  state.view = view;
  for (const v of ['guide', 'roadmap', 'missable']) {
    $('view-' + v).classList.toggle('hidden', v !== view);
    $('tab' + v[0].toUpperCase() + v.slice(1)).classList.toggle('active', v === view);
  }
}

function wireControls() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  document.querySelectorAll('.kind-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.kind = btn.dataset.kind;
      document.querySelectorAll('.kind-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderList();
    });
  });
  $('gradeFilter').addEventListener('change', (e) => {
    state.grade = e.target.value;
    renderList();
  });
  $('search').addEventListener('input', (e) => {
    state.search = e.target.value.trim();
    renderList();
  });
  $('earnedOnly').addEventListener('change', (e) => {
    state.earnedOnly = e.target.checked;
    renderList();
  });
  $('spoilerToggle').addEventListener('change', (e) => {
    state.spoilersHidden = e.target.checked;
    renderAll();
  });
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ game: 'Grand Theft Auto VI', earned: [...state.earned] }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gta6-trophy-progress.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const names = Array.isArray(data) ? data : data.earned;
      if (!Array.isArray(names)) throw new Error('not a progress file');
      const known = new Set(state.trophies.map((t) => t.name));
      state.earned = new Set(names.filter((n) => known.has(n)));
      saveEarned();
      $('saveState').textContent = 'Imported ' + state.earned.size + ' earned trophies.';
      renderAll();
    } catch {
      $('saveState').textContent = 'That file is not a progress export from this guide.';
    }
    e.target.value = '';
  });
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('Clear all earned trophies?')) return;
    state.earned = new Set();
    saveEarned();
    renderAll();
  });
}

async function boot() {
  state.earned = loadEarned();
  const res = await fetch(DATA_URL);
  const doc = await res.json();
  state.trophies = doc.trophies || [];
  state.sources = {};
  for (const s of doc.sources || []) state.sources[s.id] = s;
  wireControls();
  renderAll();
}

await boot();
