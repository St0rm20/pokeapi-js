/* Capa de acceso a PokeAPI (https://pokeapi.co/api/v2).
   - Pide los datos en vivo a la API.
   - Guarda una versión reducida de cada respuesta en localStorage para
     poder seguir mostrándola cuando el teléfono no tiene conexión.
   - Evita pedir dos veces lo mismo al mismo tiempo. */
(function () {
  'use strict';

  const BASE = 'https://pokeapi.co/api/v2';
  const SPRITE = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  const ARTWORK = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  const PREFIX = 'pkdx:v1:';
  const TIMEOUT_MS = 12000;

  const memory = new Map();
  const inflight = new Map();

  class NetworkError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'NetworkError';
      this.status = status || 0;
    }
  }

  /* ---------- Almacenamiento local (siempre protegido con try/catch) ---------- */
  function readStore(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (_) {
      // Si el almacenamiento está lleno se borran las fichas guardadas y se reintenta una vez.
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith(PREFIX + 'mon:') || k.startsWith(PREFIX + 'spc:'))
          .forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } catch (__) { /* sin almacenamiento disponible */ }
    }
  }

  /* ---------- Petición HTTP con tiempo límite ---------- */
  async function fetchJSON(url) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
    let res;
    try {
      res = await fetch(url, { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: 'application/json' } });
    } catch (err) {
      throw new NetworkError('No se pudo conectar con PokeAPI');
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res.ok) throw new NetworkError(`PokeAPI respondió ${res.status}`, res.status);
    return res.json();
  }

  /* Obtiene un recurso: memoria → red → copia guardada. */
  function cached(key, url, transform) {
    if (memory.has(key)) return Promise.resolve(memory.get(key));
    if (inflight.has(key)) return inflight.get(key);

    const task = (async () => {
      const stored = readStore(key);
      const online = typeof navigator === 'undefined' || navigator.onLine !== false;

      if (!online && stored) return keep(key, stored);

      try {
        const data = transform(await fetchJSON(url));
        writeStore(key, data);
        return keep(key, data);
      } catch (err) {
        if (stored) return keep(key, stored);
        throw err;
      }
    })();

    inflight.set(key, task);
    task.then(() => inflight.delete(key), () => inflight.delete(key));
    return task;
  }

  function keep(key, data) { memory.set(key, data); return data; }

  function idFromUrl(url) {
    const m = /\/(\d+)\/?$/.exec(url || '');
    return m ? Number(m[1]) : 0;
  }

  function pickLang(list, field, lang) {
    const found = (list || []).filter((x) => x.language && x.language.name === lang);
    return found.length ? found[found.length - 1][field] : null;
  }

  function cleanText(t) {
    return String(t || '')
      .replace(/[\f\n\r­]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ---------- Endpoints ---------- */

  // Una caja: una página de especies (id y nombre).
  function getSpeciesPage(offset, limit) {
    return cached(`page:${offset}:${limit}`,
      `${BASE}/pokemon-species?offset=${offset}&limit=${limit}`,
      (json) => ({
        count: json.count,
        items: json.results
          .map((r) => ({ id: idFromUrl(r.url), name: r.name }))
          .sort((a, b) => a.id - b.id)
      }));
  }

  // Índice completo para la búsqueda (solo id y nombre, ~1000 registros).
  function getSpeciesIndex() {
    return cached('index',
      `${BASE}/pokemon-species?limit=100000`,
      (json) => json.results
        .map((r) => ({ id: idFromUrl(r.url), name: r.name }))
        .sort((a, b) => a.id - b.id));
  }

  // Ficha básica: tipos, medidas, habilidades y estadísticas.
  function getPokemon(id) {
    return cached(`mon:${id}`, `${BASE}/pokemon/${id}`, (p) => {
      const sp = p.sprites || {};
      const other = sp.other || {};
      const art = other['official-artwork'] || {};
      return {
        id: p.id,
        name: p.name,
        height: p.height,
        weight: p.weight,
        types: (p.types || []).sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
        abilities: (p.abilities || []).sort((a, b) => a.slot - b.slot)
          .map((a) => ({ name: a.ability.name, hidden: !!a.is_hidden })),
        stats: (p.stats || []).map((s) => ({ name: s.stat.name, value: s.base_stat })),
        sprite: sp.front_default || SPRITE(p.id),
        artwork: art.front_default || sp.front_default || ARTWORK(p.id)
      };
    });
  }

  // Datos de la especie: nombre, categoría y descripción en español.
  function getSpecies(id) {
    return cached(`spc:${id}`, `${BASE}/pokemon-species/${id}`, (s) => ({
      id: s.id,
      nameEs: pickLang(s.names, 'name', 'es') || s.name,
      genus: pickLang(s.genera, 'genus', 'es') || pickLang(s.genera, 'genus', 'en') || '',
      flavor: cleanText(pickLang(s.flavor_text_entries, 'flavor_text', 'es') ||
                        pickLang(s.flavor_text_entries, 'flavor_text', 'en') || '')
    }));
  }

  // Nombre de una habilidad en español.
  function getAbilityName(slug) {
    return cached(`abl:${slug}`, `${BASE}/ability/${slug}`,
      (a) => pickLang(a.names, 'name', 'es') || pickLang(a.names, 'name', 'en') || slug);
  }

  window.PokeAPI = {
    getSpeciesPage,
    getSpeciesIndex,
    getPokemon,
    getSpecies,
    getAbilityName,
    spriteUrl: SPRITE,
    artworkUrl: ARTWORK,
    NetworkError
  };
})();
