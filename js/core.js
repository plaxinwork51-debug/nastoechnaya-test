// Ядро «Настоечной книжки»: данные гостя, печати бармена, звания, топ, бэкап-ссылка. Без DOM.
// Запись о настойке: {r: оценка 0-5, t: [теги гостя], n: заметка, f: 1 = возьму ещё, d: когда записал, s: когда поставлена печать, k: код печати}
const NK = (() => {
  const NOTE_MAX = 280, LINK_MAX = 3500, HASH_MAX = 20000;
  let cfg = null, st = null, key = '', mem = null, persistent = true, busy = false;

  const store = {
    read() { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { persistent = false; return mem; } },
    write() {
      try { localStorage.setItem(key, JSON.stringify(st)); persistent = true; }
      catch (e) { persistent = false; mem = JSON.parse(JSON.stringify(st)); }
    }
  };
  const byId = id => cfg.tinctures.find(t => t.id === +id);
  const tagKeys = () => cfg.tags.map(t => t.k);
  const maxTime = () => Date.now() + 86400000;
  const clean = e => {  // всё, что пришло извне (бэкап, старые версии), приводим к схеме
    const o = {}, tk = new Set(tagKeys());
    const r = Math.round(+e.r || 0); if (r >= 1 && r <= 5) o.r = r;
    const t = Array.isArray(e.t) ? [...new Set(e.t.filter(x => tk.has(x)))] : []; if (t.length) o.t = t;
    if (typeof e.n === 'string' && e.n.trim()) o.n = e.n.trim().slice(0, NOTE_MAX);
    if (e.f) o.f = 1;
    if (+e.d > 0 && +e.d < maxTime()) o.d = +e.d;
    if (+e.s > 0 && +e.s < maxTime()) { o.s = +e.s; if (/^\d{4}$/.test(e.k || '')) o.k = e.k; }
    return o;
  };
  const empty = e => !e || !(e.r || e.t || e.n || e.f || e.s);
  const touch = () => { st.ch = (st.ch || 0) + 1; };  // счётчик изменений, бэкап его запоминает

  async function sha(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }
  const codeOk = async (t, code) => !!code && (await sha(cfg.salt + ':' + t.id + ':' + code)) === t.h;

  // ---------- старт ----------
  function load() {
    st = store.read() || {};
    st.e = st.e || {};
    const e = {};
    for (const [id, v] of Object.entries(st.e)) { if (!byId(id)) continue; const c = clean(v); if (!empty(c)) e[String(+id)] = c; }
    st.e = e;
  }
  function init(config) { cfg = config; key = cfg.storageKey; load(); return api; }
  const flags = () => ({adult: !!st.adult, onboarded: !!st.onboarded});
  function setFlag(name) { st[name] = 1; store.write(); }

  // ---------- записи ----------
  const entry = id => st.e[String(+id)] || null;
  function save(id, patch) {  // patch: любые из r, t, n, f; дата ставится сама при первой записи
    if (!byId(id)) return null;
    const k = String(+id), cur = st.e[k] || {};
    const next = clean({...cur, ...patch, s: cur.s, k: cur.k, d: cur.d || Date.now()});
    if (empty(next)) delete st.e[k]; else st.e[k] = next;
    touch(); store.write();
    return st.e[k] || null;
  }
  function toggleTag(id, tag) {
    const t = new Set((entry(id) || {}).t || []);
    t.has(tag) ? t.delete(tag) : t.add(tag);
    return save(id, {t: [...t]});
  }

  // ---------- печать бармена ----------
  const lockLeft = () => Math.max(0, Math.ceil(((st.lockUntil || 0) - Date.now()) / 1000));
  async function stamp(id, code) {  // -> {ok, rankUp, rank, already, locked, left, error}
    const t = byId(id); if (!t) return {ok: false, error: 'unknown'};
    if (busy) return {ok: false, error: 'busy'};
    if (entry(id) && entry(id).s) return {ok: true, already: true};
    const left = lockLeft(); if (left) return {ok: false, locked: true, left};
    code = String(code || '').replace(/\D/g, '');
    if (code.length !== 4) return {ok: false, error: 'format'};
    if (!(window.crypto && crypto.subtle)) return {ok: false, error: 'insecure'};
    busy = true;
    try {
      if (!(await codeOk(t, code))) {
        st.fails = (st.fails || 0) + 1;
        let res = {ok: false, error: 'wrong', fails: st.fails};
        if (st.fails >= 5) { st.lockUntil = Date.now() + 30000; st.fails = 0; res = {ok: false, locked: true, left: 30}; }
        store.write(); return res;
      }
      if (entry(id) && entry(id).s) return {ok: true, already: true};
      const before = rank().r, k = String(+id), cur = st.e[k] || {};
      st.e[k] = clean({...cur, s: Date.now(), k: code, d: cur.d || Date.now()});
      st.fails = 0; touch(); store.write();
      const after = rank().r;
      return {ok: true, rankUp: after !== before, rank: after, first: stamped() === 1};
    } catch (e) { return {ok: false, error: 'crypto'}; }
    finally { busy = false; }
  }

  // ---------- звания ----------
  const total = () => cfg.tinctures.length;
  const stamped = () => cfg.tinctures.filter(t => entry(t.id) && entry(t.id).s).length;
  const tasted = () => cfg.tinctures.filter(t => entry(t.id)).length;
  const need = r => r.at == null ? total() : r.at;
  function rank(n = stamped()) {
    let cur = cfg.ranks[0], next = null;
    for (const r of cfg.ranks) { if (n >= need(r)) cur = r; else { next = r; break; } }
    return {r: cur, next, left: next ? need(next) - n : 0, n, total: total()};
  }
  const stampList = () => cfg.tinctures.filter(t => entry(t.id) && entry(t.id).s).map(t => ({t, s: entry(t.id).s})).sort((a, b) => a.s - b.s);

  // ---------- топ и подсказки ----------
  function top(limit = 10) {
    return cfg.tinctures.map(t => ({t, e: entry(t.id)})).filter(x => x.e && x.e.r)
      .sort((a, b) => b.e.r - a.e.r || (b.e.f || 0) - (a.e.f || 0) || (b.e.d || 0) - (a.e.d || 0)).slice(0, limit);
  }
  function profile() {  // вес тега: оценка 5 = +2, 4 = +1, 3 = 0, 2 = -1, 1 = -2; «возьму ещё» +1; свои теги гостя считаются вдвое
    const w = {};
    for (const t of cfg.tinctures) {
      const e = entry(t.id); if (!e || (!e.r && !e.f)) continue;
      const k = (e.r ? e.r - 3 : 0) + (e.f ? 1 : 0);
      t.tags.forEach(g => w[g] = (w[g] || 0) + k);
      (e.t || []).forEach(g => w[g] = (w[g] || 0) + k * 2);
    }
    return w;
  }
  function suggest(limit = 3) {
    const w = profile(), fresh = cfg.tinctures.filter(t => !entry(t.id));
    const scored = fresh.map(t => ({t, score: t.tags.reduce((a, g) => a + (w[g] || 0), 0), why: t.tags.filter(g => (w[g] || 0) > 0)}))
      .filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.t.id - b.t.id);
    return {personal: scored.length > 0, list: (scored.length ? scored : fresh.map(t => ({t, score: 0, why: []}))).slice(0, limit)};
  }

  // ---------- бэкап-ссылкой: #b=<тег><base64url> ----------
  // v2: [2, bar, [[id, r, маска тегов, f, d мин36, s мин36, k, n], ...]]; тег z = deflate-raw, j = без сжатия
  const b64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  async function pipe(bytes, Stream) {
    const s = new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const toMin = ts => ts ? Math.round(ts / 60000).toString(36) : 0;
  const fromMin = s => s ? parseInt(s, 36) * 60000 : 0;
  function pack(withNotes) {
    const tk = tagKeys();
    return [2, cfg.bar, Object.entries(st.e).map(([id, e]) => {
      const row = [+id, e.r || 0, (e.t || []).reduce((m, g) => m | (1 << tk.indexOf(g)), 0), e.f ? 1 : 0, toMin(e.d), toMin(e.s), e.k || 0];
      if (withNotes && e.n) row.push(e.n);
      return row;
    })];
  }
  function unpack(o) {
    if (Array.isArray(o) && o[0] === 2) {
      const tk = tagKeys(), e = {};
      if (o[1] !== cfg.bar) return null;
      for (const row of o[2] || []) {
        if (!Array.isArray(row)) continue;
        const [id, r, mask, f, d, s, k, n] = row;
        e[id] = {r, t: tk.filter((g, i) => mask & (1 << i)), f, d: fromMin(d), s: fromMin(s), k: k ? String(k) : '', n};
      }
      return e;
    }
    if (o && typeof o.e === 'object' && (!o.bar || o.bar === cfg.bar)) return o.e;  // v1 от 14.10
    return null;
  }
  async function encode(data) {
    const raw = new TextEncoder().encode(JSON.stringify(data));
    if (typeof CompressionStream === 'function') {
      try { return 'z' + b64u(await pipe(raw, CompressionStream)); } catch (e) {}
    }
    return 'j' + b64u(raw);
  }
  async function backupLink(base) {  // -> {url, notes: заметки влезли?, lost: сколько заметок не влезло}
    base = base || location.origin + location.pathname + location.search;
    let url = base + '#b=' + await encode(pack(true)), notes = true;
    if (url.length > LINK_MAX) { url = base + '#b=' + await encode(pack(false)); notes = false; }
    st.bk = st.ch || 0; store.write();
    return {url, notes, lost: notes ? 0 : Object.values(st.e).filter(e => e.n).length};
  }
  const needBackup = () => (st.ch || 0) > (st.bk || 0) && stamped() > 0;
  async function readBackup(hash) {  // -> {e, count, fake} | {error: 'old'} | null
    hash = hash || '';
    if (hash.length > HASH_MAX) return null;
    const m = /[#&]b=([zj])([A-Za-z0-9_-]+)/.exec(hash); if (!m) return null;
    let bytes;
    try { bytes = unb64u(m[2]); } catch (err) { return null; }
    if (m[1] === 'z') {
      if (typeof DecompressionStream !== 'function') return {error: 'old'};
      try { bytes = await pipe(bytes, DecompressionStream); } catch (err) { return null; }
    }
    let raw;
    try { raw = unpack(JSON.parse(new TextDecoder().decode(bytes))); } catch (err) { return null; }
    if (!raw) return null;
    const e = {}; let fake = 0;
    for (const [id, v] of Object.entries(raw)) {
      const t = byId(id); if (!t || !v || typeof v !== 'object') continue;
      const c = clean(v);
      if (c.s && !(await codeOk(t, c.k))) { delete c.s; delete c.k; fake++; }  // печать без верного кода не переносим
      if (!empty(c)) e[String(+id)] = c;
    }
    return {e, count: Object.keys(e).length, fake};
  }
  function merge(e) {  // своё главнее, из бэкапа добираем то, чего нет; печать берём самую раннюю
    let added = 0, stamps = 0;
    const before = rank().r;
    for (const [id, inc] of Object.entries(e)) {
      const cur = st.e[id];
      if (!cur) { st.e[id] = inc; added++; if (inc.s) stamps++; continue; }
      const out = {...inc, ...cur};
      if (inc.s && (!cur.s || inc.s < cur.s)) { if (!cur.s) stamps++; out.s = inc.s; out.k = inc.k; }
      if (inc.d && (!cur.d || inc.d < cur.d)) out.d = inc.d;
      if (cur.t || inc.t) out.t = [...new Set([...(cur.t || []), ...(inc.t || [])])];
      if (cur.n && inc.n && cur.n !== inc.n && !cur.n.includes(inc.n)) out.n = (cur.n + ' / ' + inc.n).slice(0, NOTE_MAX);
      st.e[id] = clean(out);
    }
    touch(); store.write();
    return {added, stamps, rankUp: rank().r !== before, rank: rank().r};
  }

  const api = {init, reload: load, flags, setFlag, entry, save, toggleTag, stamp, lockLeft, rank, total, stamped, tasted, stampList, top, profile, suggest,
    backupLink, needBackup, readBackup, merge, byId, get cfg() { return cfg; }, get persistent() { return persistent; }, get key() { return key; }, NOTE_MAX};
  return api;
})();
if (typeof window !== 'undefined') window.NK = NK;
