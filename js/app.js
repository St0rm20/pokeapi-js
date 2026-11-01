/* Pokédex móvil · lógica de la interfaz */
(function () {
  'use strict';

  const { TYPES, STATS, BOX_SIZE, STAT_MAX } = window.PokeData;
  const API = window.PokeAPI;

  /* ---------- Utilidades ---------- */
  const $ = (id) => document.getElementById(id);

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style') Object.assign(el.style, v);
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  const pad = (n) => String(n).padStart(3, '0');

  function displayName(slug) {
    if (!slug) return '';
    if (slug === 'nidoran-f') return 'Nidoran♀';
    if (slug === 'nidoran-m') return 'Nidoran♂';
    return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  function normalize(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/♀/g, '-f').replace(/♂/g, '-m').replace(/[\s.'’:]+/g, '-');
  }

  function typeBadge(type, large) {
    const t = TYPES[type] || { es: type, bg: '#ccc', fg: '#2B2B2B' };
    return h('span', {
      class: 'type' + (large ? ' type--lg' : ''),
      text: t.es,
      style: { background: t.bg, color: t.fg }
    });
  }

  const decimal = (n) => (n / 10).toFixed(1).replace('.', ',');

  const WIFI_OFF = 'M3 9a14 14 0 0 1 6-3M21 9a14 14 0 0 0-5-3M6 13a9 9 0 0 1 4-2M18 13a9 9 0 0 0-2-2M10 17a4 4 0 0 1 4 0M12 21h.01M3 3l18 18';

  function svgIcon(path, size, color, width) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', color);
    svg.setAttribute('stroke-width', width);
    svg.setAttribute('stroke-linecap', 'square');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', path);
    svg.appendChild(p);
    return svg;
  }

  function alertCard({ title, text, retry, info, inline }) {
    return h('div', { class: 'alert' + (inline ? ' alert--inline' : ''), role: info ? 'status' : 'alert' },
      info ? null : svgIcon(WIFI_OFF, 44, '#A32A1E', 2.5),
      h('div', { class: 'alert__title' + (info ? ' alert__title--info' : ''), text: title }),
      text ? h('p', { class: 'alert__text', text }) : null,
      retry ? h('button', { type: 'button', class: 'retry-btn', text: 'REINTENTAR', onclick: retry }) : null
    );
  }

  function loader(text) {
    return h('div', { class: 'loader', role: 'status' },
      h('span', { class: 'loader__dots', 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
      h('span', { class: 'loader__text', text })
    );
  }

  function imgFallback(img) {
    img.addEventListener('error', () => img.classList.add('is-broken'), { once: true });
  }

  const store = {
    get(k) { try { return localStorage.getItem('pkdx:' + k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem('pkdx:' + k, v); } catch (_) { /* sin almacenamiento */ } }
  };

  /* ---------- Estado ---------- */
  const state = {
    total: null,            // cantidad total de especies (dada por la API)
    boxesLoaded: 0,
    loadingBox: false,
    boxError: null,
    names: new Map(),       // id -> slug
    selectedId: Number(store.get('sel')) || 1,
    selToken: 0,
    query: '',
    searchToken: 0,
    detailToken: 0,
    scrollBoxes: 0
  };

  /* ---------- Referencias del DOM ---------- */
  const el = {
    viewMain: $('view-main'),
    viewDetail: $('view-detail'),
    net: $('net-status'),
    banner: $('offline-banner'),
    input: $('search-input'),
    clear: $('search-clear'),
    form: $('search-form'),
    selected: $('selected'),
    selImg: $('sel-img'),
    selInfo: $('sel-info'),
    selName: $('sel-name'),
    selNum: $('sel-num'),
    selTypes: $('sel-types'),
    selDetail: $('sel-detail'),
    scroll: $('pc-scroll'),
    content: $('pc-content'),
    thumb: $('pc-thumb'),
    detailBody: $('detail-body'),
    detChip: $('det-chip'),
    back: $('back-btn'),
    tplCell: $('tpl-cell')
  };

  const boxesWrap = h('div', { class: 'boxes', style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
  const boxesFooter = h('div');
  const resultsWrap = h('div', { hidden: true });
  el.content.append(boxesWrap, boxesFooter, resultsWrap);

  /* ---------- Conexión ---------- */
  function updateNet() {
    const online = navigator.onLine !== false;
    el.net.classList.toggle('is-offline', !online);
    el.net.querySelector('.net__label').textContent = online ? 'ONLINE' : 'OFFLINE';
    el.banner.hidden = online;
    updateThumb();
  }

  window.addEventListener('online', () => {
    updateNet();
    if (state.boxError) loadNextBox();
    if (state.query) runSearch();
    if (!el.viewDetail.hidden && el.detailBody.querySelector('.alert')) route();
  });
  window.addEventListener('offline', updateNet);

  /* ---------- Celdas ---------- */
  function makeCell(id, slug) {
    const node = el.tplCell.content.firstElementChild.cloneNode(true);
    node.dataset.id = id;
    node.setAttribute('aria-label', `${displayName(slug)}, número ${id}`);
    const img = node.querySelector('img');
    imgFallback(img);
    img.src = API.spriteUrl(id);
    node.querySelector('.cell__num').textContent = '#' + pad(id);
    if (id === state.selectedId) {
      node.classList.add('is-selected');
      node.setAttribute('aria-pressed', 'true');
    }
    return node;
  }

  function onCellTap(e) {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const id = Number(cell.dataset.id);
    if (id === state.selectedId) openDetail(id); // segundo toque: abre el detalle
    else select(id);
  }
  el.content.addEventListener('click', onCellTap);

  function markSelection() {
    el.content.querySelectorAll('.cell.is-selected').forEach((c) => {
      c.classList.remove('is-selected');
      c.removeAttribute('aria-pressed');
    });
    el.content.querySelectorAll(`.cell[data-id="${state.selectedId}"]`).forEach((c) => {
      c.classList.add('is-selected');
      c.setAttribute('aria-pressed', 'true');
    });
  }

  /* ---------- Panel del seleccionado ---------- */
  function renderEmptySelection() {
    el.selected.classList.add('is-empty');
    el.selImg.src = API.spriteUrl(state.selectedId || 1);
    el.selImg.alt = '';
    el.selInfo.replaceChildren(h('span', { class: 'selected__msg', text: 'Selecciona un Pokémon' }));
    el.selDetail.disabled = true;
  }

  function ensureInfoNodes() {
    if (el.selInfo.contains(el.selName)) return;
    el.selInfo.replaceChildren(
      h('span', { class: 'selected__tag', text: 'INFO PKMN' }),
      el.selName, el.selNum, el.selTypes
    );
  }

  async function select(id, { silent } = {}) {
    state.selectedId = id;
    store.set('sel', String(id));
    markSelection();
    const token = ++state.selToken;

    ensureInfoNodes();
    el.selected.classList.remove('is-empty');
    const slug = state.names.get(id);
    el.selImg.classList.remove('is-broken');
    el.selImg.src = API.spriteUrl(id);
    el.selImg.alt = displayName(slug) || `Pokémon ${id}`;
    el.selName.textContent = slug ? displayName(slug).toUpperCase() : '· · ·';
    el.selNum.textContent = 'No. ' + pad(id);
    el.selTypes.replaceChildren(h('span', { class: 'type type--skeleton', 'aria-hidden': 'true' }));
    el.selDetail.disabled = false;

    try {
      const p = await API.getPokemon(id);
      if (token !== state.selToken) return;
      if (!state.names.has(id)) state.names.set(id, p.name);
      el.selName.textContent = displayName(state.names.get(id)).toUpperCase();
      el.selImg.alt = displayName(state.names.get(id));
      el.selTypes.replaceChildren(...p.types.map((t) => typeBadge(t)));
    } catch (err) {
      if (token !== state.selToken) return;
      el.selTypes.replaceChildren();
      if (!silent && !state.names.has(id)) renderEmptySelection();
    }
  }

  el.selDetail.addEventListener('click', () => openDetail(state.selectedId));

  /* ---------- Cajas con carga progresiva ---------- */
  function hasMore() {
    return state.total == null || state.boxesLoaded * BOX_SIZE < state.total;
  }

  function renderBoxesFooter() {
    el.content.classList.remove('is-centered');
    if (state.boxError) {
      const empty = state.boxesLoaded === 0;
      if (empty) el.content.classList.add('is-centered');
      boxesFooter.replaceChildren(alertCard({
        title: 'ERROR DE RED',
        text: empty
          ? 'No se pudo cargar la caja. Revisa tu conexión e inténtalo de nuevo.'
          : 'No se pudo cargar la caja siguiente. Revisa tu conexión e inténtalo de nuevo.',
        retry: () => loadNextBox(),
        inline: !empty
      }));
      if (empty && !state.names.has(state.selectedId)) renderEmptySelection();
    } else if (state.loadingBox) {
      boxesFooter.replaceChildren(loader(state.boxesLoaded === 0 ? 'Cargando caja...' : 'Cargando caja siguiente...'));
    } else {
      boxesFooter.replaceChildren();
    }
    updateThumb();
  }

  async function loadNextBox() {
    if (state.loadingBox || !hasMore()) return;
    state.loadingBox = true;
    state.boxError = null;
    renderBoxesFooter();

    const index = state.boxesLoaded;
    try {
      const page = await API.getSpeciesPage(index * BOX_SIZE, BOX_SIZE);
      state.total = page.count;
      page.items.forEach((it) => state.names.set(it.id, it.name));

      const grid = h('div', { class: 'grid' }, page.items.map((it) => makeCell(it.id, it.name)));
      boxesWrap.appendChild(h('div', { class: 'box' },
        h('div', { class: 'box__title', text: 'CAJA ' + (index + 1) }),
        grid
      ));
      state.boxesLoaded++;
      state.loadingBox = false;
      renderBoxesFooter();

      // Si el seleccionado quedó sin nombre (por ejemplo tras un error) se refresca.
      if (state.names.has(state.selectedId) && el.selected.classList.contains('is-empty')) {
        select(state.selectedId, { silent: true });
      }
      requestAnimationFrame(maybeLoadMore);
    } catch (err) {
      state.loadingBox = false;
      state.boxError = err;
      renderBoxesFooter();
    }
  }

  function maybeLoadMore() {
    if (state.query || state.boxError || state.loadingBox || !hasMore()) return;
    const s = el.scroll;
    if (s.scrollHeight - s.scrollTop - s.clientHeight < 500) loadNextBox();
  }

  /* ---------- Barra de desplazamiento personalizada ---------- */
  let thumbRaf = 0;
  function updateThumb() {
    if (thumbRaf) return;
    thumbRaf = requestAnimationFrame(() => {
      thumbRaf = 0;
      const s = el.scroll;
      const track = s.clientHeight - 8;
      const ratio = s.clientHeight / Math.max(s.scrollHeight, 1);
      if (ratio >= 1 || track <= 0) {
        el.thumb.style.height = track + 'px';
        el.thumb.style.transform = 'translateY(0)';
        return;
      }
      const tH = Math.max(28, Math.round(track * ratio));
      const max = s.scrollHeight - s.clientHeight;
      const y = Math.round((s.scrollTop / max) * (track - tH));
      el.thumb.style.height = tH + 'px';
      el.thumb.style.transform = `translateY(${y}px)`;
    });
  }

  el.scroll.addEventListener('scroll', () => { updateThumb(); maybeLoadMore(); }, { passive: true });
  window.addEventListener('resize', () => { updateThumb(); maybeLoadMore(); });

  /* ---------- Búsqueda ---------- */
  let searchTimer = 0;

  el.input.addEventListener('input', () => {
    el.clear.hidden = el.input.value.length === 0;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 220);
  });

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(searchTimer);
    runSearch();
    el.input.blur(); // oculta el teclado del teléfono
  });

  el.clear.addEventListener('click', () => {
    el.input.value = '';
    el.clear.hidden = true;
    runSearch();
    el.input.focus();
  });

  function setSearchMode(on) {
    const wasOn = !resultsWrap.hidden;
    if (on === wasOn) return;
    if (on) state.scrollBoxes = el.scroll.scrollTop;
    boxesWrap.hidden = on;
    boxesFooter.hidden = on;
    resultsWrap.hidden = !on;
    el.content.classList.toggle('is-centered', !on && !!state.boxError && state.boxesLoaded === 0);
    el.scroll.scrollTop = on ? 0 : state.scrollBoxes;
    if (!on) markSelection();
    updateThumb();
  }

  function matchSearch(index, raw) {
    const q = raw.replace(/^#/, '').trim();
    if (/^\d+$/.test(q)) {
      const n = Number(q);
      const exact = index.filter((p) => p.id === n);
      const starts = index.filter((p) => p.id !== n && String(p.id).startsWith(q));
      return exact.concat(starts);
    }
    const nq = normalize(q);
    const starts = [];
    const contains = [];
    for (const p of index) {
      const name = p.name;
      if (name.startsWith(nq)) starts.push(p);
      else if (name.includes(nq)) contains.push(p);
    }
    return starts.concat(contains);
  }

  async function runSearch() {
    const raw = el.input.value.trim().toLowerCase();
    state.query = raw;
    const token = ++state.searchToken;

    if (!raw || raw === '#') {
      setSearchMode(false);
      resultsWrap.replaceChildren();
      return;
    }
    setSearchMode(true);

    const title = h('div', { class: 'box__title', text: 'RESULTADOS' });
    resultsWrap.replaceChildren(h('div', { class: 'box' }, title, loader('Buscando...')));

    let index;
    try {
      index = await API.getSpeciesIndex();
    } catch (err) {
      if (token !== state.searchToken) return;
      resultsWrap.replaceChildren(alertCard({
        title: 'ERROR DE RED',
        text: 'No se pudo cargar el índice para buscar. Revisa tu conexión e inténtalo de nuevo.',
        retry: runSearch,
        inline: true
      }));
      updateThumb();
      return;
    }
    if (token !== state.searchToken) return;
    index.forEach((p) => { if (!state.names.has(p.id)) state.names.set(p.id, p.name); });

    const LIMIT = 90;
    const found = matchSearch(index, raw);
    if (found.length === 0) {
      resultsWrap.replaceChildren(h('div', { class: 'box' }, title,
        alertCard({ title: 'SIN RESULTADOS', text: `No hay Pokémon que coincidan con “${el.input.value.trim()}”.`, info: true, inline: true })));
      updateThumb();
      return;
    }

    const shown = found.slice(0, LIMIT);
    const grid = h('div', { class: 'grid' }, shown.map((p) => makeCell(p.id, p.name)));
    const note = found.length > LIMIT
      ? h('div', { class: 'loader' }, h('span', { class: 'loader__text', text: `Mostrando ${LIMIT} de ${found.length}. Escribe más letras para afinar.` }))
      : null;
    resultsWrap.replaceChildren(h('div', { class: 'box' }, title, grid, note));

    if (!shown.some((p) => p.id === state.selectedId)) select(shown[0].id);
    else markSelection();
    updateThumb();
  }

  /* ---------- Detalle ---------- */
  function openDetail(id) {
    if (!id) return;
    location.hash = '#/pokemon/' + id;
  }

  function closeDetail() {
    if (history.state && history.state.fromMain) history.back();
    else location.hash = '';
  }
  el.back.addEventListener('click', closeDetail);

  function detailSkeleton(id) {
    return h('article', { class: 'card' },
      h('div', { class: 'card__top' },
        h('div', { class: 'artwork' },
          h('img', { src: API.spriteUrl(id), alt: '', width: 96, height: 96, class: 'pixel', style: { width: '96px', height: '96px' } })),
        h('div', { class: 'card__facts' },
          h('span', { class: 'card__num', text: 'No. ' + pad(id) }),
          h('div', { class: 'skeleton skeleton--line', style: { width: '80%' } }),
          h('div', { class: 'skeleton skeleton--line', style: { width: '60%' } }),
          h('div', { class: 'card__rule' }),
          h('div', { class: 'skeleton skeleton--line' }),
          h('div', { class: 'skeleton skeleton--line' })
        )
      ),
      loader('Cargando datos de la Pokédex...')
    );
  }

  async function renderDetail(id) {
    const token = ++state.detailToken;
    el.detChip.textContent = 'No. ' + pad(id);
    el.detailBody.scrollTop = 0;
    el.detailBody.replaceChildren(detailSkeleton(id));

    let p, s;
    try {
      [p, s] = await Promise.all([API.getPokemon(id), API.getSpecies(id)]);
    } catch (err) {
      if (token !== state.detailToken) return;
      el.detailBody.replaceChildren(h('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'center' } },
        alertCard({
          title: 'ERROR DE RED',
          text: navigator.onLine === false
            ? 'Este Pokémon no está guardado y no hay conexión. Conéctate e inténtalo de nuevo.'
            : 'No se pudo cargar la información de este Pokémon. Inténtalo de nuevo.',
          retry: () => renderDetail(id)
        })));
      return;
    }
    if (token !== state.detailToken) return;

    const name = (s.nameEs || displayName(p.name)).toUpperCase();
    document.title = `${s.nameEs || displayName(p.name)} · Pokédex`;

    const art = h('img', { src: p.artwork, alt: 'Ilustración oficial de ' + (s.nameEs || displayName(p.name)), width: 124, height: 124 });
    art.addEventListener('error', () => {
      art.src = p.sprite;
      art.classList.add('pixel');
    }, { once: true });

    const abilityList = h('div', { class: 'panel__body' },
      p.abilities.map((a) => h('span', { class: 'chip', 'data-ability': a.name,
        text: displayName(a.name) + (a.hidden ? ' (oculta)' : '') })));

    const statRows = p.stats.map((st) => {
      const v = st.value;
      const fill = h('div', { class: 'stat__fill', style: { background: v >= 80 ? '#58C858' : v >= 50 ? '#F8D030' : '#E04848' } });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        fill.style.width = Math.min(100, Math.round((v / STAT_MAX) * 100)) + '%';
      }));
      return h('div', { class: 'stat' },
        h('span', { class: 'stat__name', text: STATS[st.name] || displayName(st.name) }),
        h('div', { class: 'stat__bar', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 255, 'aria-valuenow': v,
          'aria-label': STATS[st.name] || st.name },
          h('div', { class: 'stat__track' }, fill)),
        h('span', { class: 'stat__val', text: String(v) })
      );
    });

    const fact = (k, v) => h('div', { class: 'fact' },
      h('span', { class: 'fact__k', text: k }), h('span', { class: 'fact__fill' }), h('span', { class: 'fact__v', text: v }));

    el.detailBody.replaceChildren(
      h('article', { class: 'card' },
        h('div', { class: 'card__top' },
          h('div', { class: 'artwork' }, art),
          h('div', { class: 'card__facts' },
            h('span', { class: 'card__num', text: 'No. ' + pad(p.id) }),
            h('span', { class: 'card__name', text: name }),
            s.genus ? h('span', { class: 'card__genus', text: s.genus }) : null,
            h('div', { class: 'card__rule' }),
            fact('ALT.', decimal(p.height) + ' m'),
            fact('PESO', decimal(p.weight) + ' kg'),
            h('div', { class: 'types' }, p.types.map((t) => typeBadge(t, true)))
          )
        ),
        h('p', { class: 'flavor', text: s.flavor || 'Sin descripción disponible.' })
      ),
      h('section', { class: 'panel' },
        h('h2', { class: 'panel__title', text: 'HABILIDADES' }),
        abilityList
      ),
      h('section', { class: 'panel' },
        h('h2', { class: 'panel__title', text: 'ESTADÍSTICAS BASE' }),
        h('div', { class: 'panel__body panel__body--col' }, statRows)
      )
    );

    // Nombres de habilidades en español (se completan cuando responde la API).
    p.abilities.forEach((a, i) => {
      API.getAbilityName(a.name).then((es) => {
        if (token !== state.detailToken) return;
        const chip = abilityList.children[i];
        if (chip) chip.textContent = es + (a.hidden ? ' (oculta)' : '');
      }, () => { /* se deja el nombre original */ });
    });
  }

  /* ---------- Rutas (hash) ---------- */
  function route() {
    const m = /^#\/pokemon\/(\d+)$/.exec(location.hash);
    if (m) {
      const id = Number(m[1]);
      el.viewMain.setAttribute('aria-hidden', 'true');
      el.viewDetail.hidden = false;
      if (id !== state.selectedId) select(id, { silent: true });
      renderDetail(id);
    } else {
      el.viewDetail.hidden = true;
      el.viewMain.removeAttribute('aria-hidden');
      document.title = 'Pokédex móvil';
      state.detailToken++;
      updateThumb();
    }
  }

  window.addEventListener('hashchange', (e) => {
    // Se marca la entrada del historial para que "volver" regrese a las cajas.
    if (/^#\/pokemon\//.test(location.hash) && !/#\/pokemon\//.test(e.oldURL || '')) {
      try { history.replaceState({ fromMain: true }, ''); } catch (_) { /* ignorar */ }
    }
    route();
  });

  /* ---------- Inicio ---------- */
  updateNet();
  select(state.selectedId, { silent: true });
  loadNextBox();
  route();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión completo */ });
    });
  }
})();
