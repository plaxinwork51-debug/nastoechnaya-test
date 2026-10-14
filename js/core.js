// Ядро «Настоечной книжки»: данные гостя, печати бармена, звания, топ, бэкап-ссылка. Без DOM.
// Запись о настойке: {r: оценка 0-5, t: [теги гостя], n: заметка, f: 1 = возьму ещё, d: когда записал, s: когда поставлена печать}
const NK = (() => {
  const NOTE_MAX = 280;
  let cfg = null, st = null, key = '', mem = null;

  const store = {
    read() { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return mem; } },
    write() { try { localStorage.setItem(key, JSON.stringify(st)); } catch (e) { mem = st; } }
  };
  const byId = id => cfg.tinctures.find(t => t.id === +id);
  const tagKeys = () => new Set(cfg.tags.map(t => t.k));
  const clean = e => {  // всё, что пришло извне (бэкап, старые версии), приводим к схеме
    const o = {}, tk = tagKeys();
    const r = Math.round(+e.r || 0); if (r >= 1 && r <= 5) o.r = r;
    const t = Array.isArray(e.t) ? [...new Set(e.t.filter(x => tk.has(x)))] : []; if (t.length) o.t = t;
    if (typeof e.n === 'string' && e.n.trim()) o.n = e.n.trim().slice(0, NOTE_MAX);
    if (e.f) o.f = 1;
    if (+e.d > 0) o.d = +e.d;
    if (+e.s > 0) o.s = +e.s;
    return o;
  };
  const empty = e => !e || !(e.r || e.t || e.n || e.f || e.s);

  async function sha(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }

  // ---------- старт ----------
  function init(config) {
    cfg = config; key = cfg.storageKey;
    st = store.read() || {};
    st.e = st.e || {};
    for (const id of Object.keys(st.e)) { if (!byId(id)) continue; st.e[id] = clean(st.e[id]); if (empty(st.e[id])) delete st.e[id]; }
    return api;
  }
  const flags = () => ({adult: !!st.adult, onboarded: !!st.onboarded});
  function setFlag(name) { st[name] = 1; store.write(); }

  // ---------- записи ----------
  const entry = id => st.e[id] || null;
  function save(id, patch) {  // patch: любые из r, t, n, f; дата ставится сама при первой записи
    if (!byId(id)) return null;
    const cur = st.e[id] || {};
    const next = clean({...cur, ...patch, s: cur.s, d: cur.d || Date.now()});
    if (empty(next)) delete st.e[id]; else st.e[id] = next;
    store.write();
    return st.e[id] || null;
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
    if (entry(id) && entry(id).s) return {ok: true, already: true};
    const left = lockLeft(); if (left) return {ok: false, locked: true, left};
    code = String(code || '').replace(/\D/g, '');
    if (code.length !== 4) return {ok: false, error: 'format'};
    if (await sha(cfg.salt + ':' + t.id + ':' + code) !== t.h) {
      st.fails = (st.fails || 0) + 1;
      let res = {ok: false, error: 'wrong', fails: st.fails};
      if (st.fails >= 5) { st.lockUntil = Date.now() + 30000; st.fails = 0; res = {ok: false, locked: true, left: 30}; }
      store.write(); return res;
    }
    const before = rank().r;
    st.e[id] = clean({...(st.e[id] || {}), s: Date.now(), d: (st.e[id] || {}).d || Date.now()});
    st.fails = 0; store.write();
    const after = rank().r;
    return {ok: true, rankUp: after !== before, rank: after};
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

  // ---------- бэкап-ссылкой: #b=<base64url(deflate(JSON))> ----------
  const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  async function pipe(bytes, Stream) {
    const s = new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function backupLink(base) {
    const data = new TextEncoder().encode(JSON.stringify({v: 1, bar: cfg.bar, e: st.e}));
    let tag = 'z', bytes = data;
    if (typeof CompressionStream === 'function') bytes = await pipe(data, CompressionStream); else tag = 'j';
    return (base || location.origin + location.pathname) + '#b=' + tag + b64u(bytes);
  }
  async function readBackup(hash) {  // -> {e: {...}, count} или null
    const m = /[#&]b=([zj])([A-Za-z0-9_-]+)/.exec(hash || ''); if (!m) return null;
    try {
      let bytes = unb64u(m[2]);
      if (m[1] === 'z') bytes = await pipe(bytes, DecompressionStream);
      const o = JSON.parse(new TextDecoder().decode(bytes));
      if (!o || typeof o.e !== 'object' || (o.bar && o.bar !== cfg.bar)) return null;
      const e = {};
      for (const [id, v] of Object.entries(o.e)) { if (!byId(id)) continue; const c = clean(v); if (!empty(c)) e[id] = c; }
      return {e, count: Object.keys(e).length};
    } catch (err) { return null; }
  }
  function merge(e) {  // своё главнее, из бэкапа добираем то, чего нет; печать берём самую раннюю
    let added = 0;
    const before = rank().r;
    for (const [id, inc] of Object.entries(e)) {
      const cur = st.e[id];
      if (!cur) { st.e[id] = inc; added++; continue; }
      const out = {...inc, ...cur};
      if (inc.s && (!cur.s || inc.s < cur.s)) out.s = inc.s;
      if (inc.d && (!cur.d || inc.d < cur.d)) out.d = inc.d;
      if (cur.t || inc.t) out.t = [...new Set([...(cur.t || []), ...(inc.t || [])])];
      if (cur.n && inc.n && cur.n !== inc.n && !cur.n.includes(inc.n)) out.n = (cur.n + ' / ' + inc.n).slice(0, NOTE_MAX);
      st.e[id] = clean(out);
    }
    store.write();
    return {added, rankUp: rank().r !== before, rank: rank().r};
  }

  const api = {init, flags, setFlag, entry, save, toggleTag, stamp, lockLeft, rank, total, stamped, tasted, top, profile, suggest,
    backupLink, readBackup, merge, byId, get cfg() { return cfg; }, NOTE_MAX};
  return api;
})();
if (typeof window !== 'undefined') window.NK = NK;
