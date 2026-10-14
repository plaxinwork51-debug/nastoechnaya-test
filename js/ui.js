// Экраны книжки: список, лист настойки, топ, звания, бэкап. Логика вся в core.js (NK).
(() => {
const BAR = new URLSearchParams(location.search).get('bar') || 'svoboda';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const fmtDate = ts => new Date(ts).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'});
const fmtShort = ts => new Date(ts).toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'});
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c); };
const RATE_CAP = ['', 'не моё', 'так себе', 'норм', 'хорошо', 'огонь'];
const FALLBACK = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" stroke="#2B2117" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M38 30h44l-6 66a6 6 0 0 1-6 5H50a6 6 0 0 1-6-5z"/><path d="M41 52h38"/><path d="M46 60c8 3 20 3 28 0" opacity=".7"/>' +
  '<path d="M48 70l3 22M56 70l1 23M64 70l-1 23M72 70l-3 22" opacity=".35"/><path d="M54 22c2-4 10-4 12 0" opacity=".5"/></svg>');
const icon = t => t.icon ? 'assets/icons/ink/' + t.icon + '.webp' : FALLBACK;
const tagName = k => (NK.cfg.tags.find(t => t.k === k) || {}).name || k;
const tagLike = k => (NK.cfg.tags.find(t => t.k === k) || {}).like || tagName(k);
const andList = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1] : a.join('');
const SEAL_MINI = '<svg class="seal-mini" viewBox="0 0 32 32" aria-label="печать"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="1"/><path d="M11 16.5l3.2 3.2L21 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
const FAV_MINI = '<svg class="fav-mini" viewBox="0 0 24 24" fill="currentColor" aria-label="возьму ещё"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
const GLASS = '<svg viewBox="0 0 30 38" aria-hidden="true"><path class="fill" d="M6.6 12h16.8l-1.9 21.2a2 2 0 0 1-2 1.8h-9a2 2 0 0 1-2-1.8z"/><path class="glass" d="M3 3h24l-2.9 30.4A2.6 2.6 0 0 1 21.5 36h-13a2.6 2.6 0 0 1-2.6-2.6z"/></svg>';

function seal(ts, rot) {
  const d = new Date(ts), date = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getFullYear()).slice(2);
  return '<svg class="seal" viewBox="0 0 200 200" style="--r:' + rot + 'deg;transform:rotate(' + rot + 'deg)" role="img" aria-label="Печать бармена от ' + date + '">' +
    '<defs><path id="sp" d="M100 100m-72 0a72 72 0 1 1 144 0a72 72 0 1 1-144 0"/></defs>' +
    '<circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="100" cy="100" r="56" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<text font-family="PT Serif, Georgia, serif" font-size="15" fill="currentColor"><textPath href="#sp" textLength="446" lengthAdjust="spacing">СВОБОDА · ПЕЧАТЬ БАРМЕНА · ДРАНИЧНАЯ ·</textPath></text>' +
    '<text x="100" y="96" text-anchor="middle" font-family="Oranienbaum, serif" font-size="23" letter-spacing="1" fill="currentColor">ПРОБОВАЛ</text>' +
    '<text x="100" y="122" text-anchor="middle" font-family="PT Serif, serif" font-size="18" fill="currentColor">' + date + '</text></svg>';
}

let view = 'book', filter = 'all', query = '', openId = null;

// ---------- книжка ----------
function renderBook() {
  const n = NK.tasted(), s = NK.stamped(), rk = NK.rank();
  $('#bookStatus').innerHTML = n ? 'В книжке ' + plural(n, 'запись', 'записи', 'записей') + ', печатей <b>' + s + ' из ' + NK.total() + '</b> · ' + esc(rk.r.name)
    : 'Попробовал настойку? Найди её тут и запиши, как зашла';
  const q = query.trim().toLowerCase();
  const list = NK.cfg.tinctures.filter(t => {
    const e = NK.entry(t.id);
    if (filter === 'tasted' && !e) return false;
    if (filter === 'stamped' && !(e && e.s)) return false;
    if (filter === 'new' && e) return false;
    return !q || (t.name + ' ' + t.base + ' ' + t.taste).toLowerCase().includes(q);
  });
  $('#list').innerHTML = list.length ? list.map(t => {
    const e = NK.entry(t.id);
    const rate = e && e.r ? '<span class="minirate" aria-label="оценка ' + e.r + ' из 5">' + [1, 2, 3, 4, 5].map(i => '<i class="' + (i <= e.r ? 'on' : '') + '"></i>').join('') + '</span>' : '';
    return '<button class="row' + (e ? ' has' : '') + '" data-id="' + t.id + '">' +
      '<img class="ri" src="' + icon(t) + '" alt="" width="54" height="54" loading="lazy" decoding="async">' +
      '<span><span class="rn">' + esc(t.name) + '</span><span class="rm">' + esc(t.base) + ' · ' + esc(t.taste) + '</span></span>' +
      '<span class="rs">' + (e && e.s ? SEAL_MINI : '<span class="no">№ ' + String(t.id).padStart(2, '0') + '</span>') +
      (rate || (e && e.f ? FAV_MINI : '')) + '</span></button>';
  }).join('') : '<p class="empty">' + (q ? 'Такой настойки не нашли. Спроси у бармена, может, она под другим именем' :
    filter === 'stamped' ? 'Печатей пока нет. Попробуй настойку и попроси у бармена код' :
    filter === 'tasted' ? 'Пока пусто. Первая запись ждёт' : 'Ты попробовал всё. Легенда') + '</p>';
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === filter));
}

// ---------- лист настойки ----------
function openLeaf(id, push = true) {
  const t = NK.byId(id); if (!t) return;
  openId = id;
  if (push) history.pushState({leaf: id}, '');
  renderLeaf();
  $('#leaf').classList.add('on'); $('#leaf').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  setTimeout(() => { const b = $('#leaf .back'); if (b) b.focus({preventScroll: true}); }, 340);
}
function closeLeaf() {
  if (!openId) return;
  const id = openId; openId = null;
  $('#leaf').classList.remove('on'); document.body.style.overflow = '';
  render();
  const row = document.querySelector('.row[data-id="' + id + '"]'); if (row) row.focus({preventScroll: true});
}
function renderLeaf() {
  const t = NK.byId(openId), e = NK.entry(openId) || {};
  const rot = ((t.id * 37) % 20) - 12;
  $('#leafIn').innerHTML =
    '<div class="leaf-top"><button class="back" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>Книжка</button>' +
    '<span class="leaf-no">№ ' + String(t.id).padStart(2, '0') + '</span></div>' +
    '<img class="leaf-ic" src="' + icon(t) + '" alt="" width="150" height="150">' +
    '<div class="leaf-base">' + esc(t.base) + '</div><h2 id="leafName">' + esc(t.name) + '</h2><p class="leaf-taste">' + esc(t.taste) + '</p>' +

    '<div class="blk"><div class="blk-h" id="rateH">Как тебе?</div><div class="rate" role="radiogroup" aria-labelledby="rateH">' +
    [1, 2, 3, 4, 5].map(i => '<button role="radio" aria-checked="' + (e.r === i) + '" aria-label="' + i + ' из 5, ' + RATE_CAP[i] + '" data-rate="' + i + '" class="' + (e.r >= i ? 'on' : '') + '">' + GLASS + '</button>').join('') +
    '</div><div class="rate-cap" id="rateCap">' + (RATE_CAP[e.r || 0]) + '</div></div>' +

    '<div class="blk"><div class="blk-h">На мой вкус</div><div class="tags">' +
    NK.cfg.tags.map(g => '<button data-tag="' + g.k + '" aria-pressed="' + !!(e.t && e.t.includes(g.k)) + '">' + esc(g.name) + '</button>').join('') + '</div>' +
    '<button class="fav" data-fav aria-pressed="' + !!e.f + '">' + HEART + 'Возьму ещё</button></div>' +

    '<div class="blk"><label class="blk-h" for="note">Заметки</label>' +
    '<textarea class="note" id="note" maxlength="' + NK.NOTE_MAX + '" placeholder="с чем пил, что почувствовал, с кем бы повторил">' + esc(e.n || '') + '</textarea>' +
    '<div class="note-meta"><span id="noteDate">' + (e.d ? 'записано ' + fmtDate(e.d) : '') + '</span><span id="noteLeft"></span></div></div>' +

    '<div class="stamp-box" id="stampBox">' + (e.s
      ? seal(e.s, rot) + '<p class="seal-cap">Печать бармена · ' + fmtDate(e.s) + '</p>'
      : '<p><b style="font-weight:400;color:var(--ink)">Печать бармена.</b> Без неё запись остаётся заметкой, с ней настойка идёт в звания. Попроси у бармена код</p>' +
        '<form id="codeForm" autocomplete="off"><label class="sr" for="code">Код от бармена</label>' +
        '<input class="code" id="code" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="····" autocomplete="off" enterkeyhint="done">' +
        '<div class="msg" id="msg" role="alert"></div><button class="btn btn-ink" type="submit">Поставить печать</button></form>') + '</div>';
  wireLeaf(t);
}
function touchDate() { const e = NK.entry(openId); $('#noteDate').textContent = e && e.d ? 'записано ' + fmtDate(e.d) : ''; }
function wireLeaf(t) {
  const L = $('#leafIn');
  L.querySelector('[data-back]').addEventListener('click', () => history.back());
  L.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
    const cur = (NK.entry(openId) || {}).r || 0, v = +b.dataset.rate, next = cur === v ? 0 : v;
    NK.save(openId, {r: next});
    L.querySelectorAll('[data-rate]').forEach(x => { x.classList.toggle('on', +x.dataset.rate <= next); x.setAttribute('aria-checked', +x.dataset.rate === next); });
    $('#rateCap').textContent = RATE_CAP[next]; touchDate();
    if (navigator.vibrate) navigator.vibrate(8);
  }));
  L.querySelectorAll('[data-tag]').forEach(b => b.addEventListener('click', () => {
    const e = NK.toggleTag(openId, b.dataset.tag); b.setAttribute('aria-pressed', !!(e && e.t && e.t.includes(b.dataset.tag))); touchDate();
  }));
  const fav = L.querySelector('[data-fav]');
  fav.addEventListener('click', () => { const e = NK.save(openId, {f: (NK.entry(openId) || {}).f ? 0 : 1}); fav.setAttribute('aria-pressed', !!(e && e.f)); touchDate(); });
  const note = $('#note'); let tm;
  const left = () => { const l = NK.NOTE_MAX - note.value.length; $('#noteLeft').textContent = l < 60 ? 'осталось ' + l : ''; };
  note.addEventListener('input', () => { left(); clearTimeout(tm); tm = setTimeout(() => { NK.save(openId, {n: note.value}); touchDate(); }, 350); });
  note.addEventListener('blur', () => { clearTimeout(tm); NK.save(openId, {n: note.value}); touchDate(); });
  left();
  const form = $('#codeForm'); if (!form) return;
  const input = $('#code'), msg = $('#msg');
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 4); input.classList.remove('bad'); msg.textContent = ''; if (input.value.length === 4) form.requestSubmit(); });
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const r = await NK.stamp(openId, input.value);
    if (r.ok) {
      if (navigator.vibrate) navigator.vibrate([18, 40, 28]);
      const e = NK.entry(openId), rot = ((t.id * 37) % 20) - 12;
      $('#stampBox').innerHTML = seal(e.s, rot) + '<p class="seal-cap">Печать бармена · ' + fmtDate(e.s) + '</p>';
      $('#stampBox .seal').classList.add('thud'); touchDate();
      if (r.rankUp) setTimeout(() => rankUp(r.rank), 650); else toast('Печать стоит. ' + plural(NK.stamped(), 'печать', 'печати', 'печатей') + ' в книжке');
      return;
    }
    if (r.locked) msg.textContent = 'Много промахов подряд, подожди ' + r.left + ' сек';
    else if (r.error === 'format') msg.textContent = 'Код из четырёх цифр';
    else msg.textContent = 'Не тот код. Уточни у бармена';
    input.classList.remove('bad'); void input.offsetWidth; input.classList.add('bad'); input.select();
  });
}

// ---------- топ ----------
function renderTop() {
  const top = NK.top(10).filter(x => x.e.r >= 3);
  $('#topList').innerHTML = top.length ? '<div class="toplist">' + top.map((x, i) =>
    '<button class="toprow" data-id="' + x.t.id + '"><span class="pos">' + (i + 1) + '</span><img src="' + icon(x.t) + '" alt="" width="44" height="44" loading="lazy">' +
    '<span><span class="rn">' + esc(x.t.name) + '</span><span class="rm">' + esc(x.t.base) + ' · ' + RATE_CAP[x.e.r] + '</span></span>' +
    '<span class="minirate" aria-label="оценка ' + x.e.r + ' из 5">' + [1, 2, 3, 4, 5].map(k => '<i class="' + (k <= x.e.r ? 'on' : '') + '"></i>').join('') + '</span></button>').join('') + '</div>'
    : '<p class="empty">Оцени настойки рюмками: всё, что на тройку и выше, соберётся тут</p>';
  const w = NK.profile(), pos = Object.entries(w).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = pos.length ? pos[0][1] : 1;
  $('#profBlock').innerHTML = pos.length ? '<h2 class="mt">Мой вкус</h2><div class="prof">' + pos.map(([k, v]) =>
    '<div class="prof-row"><span>' + esc(tagName(k)) + '</span><span class="prof-bar"><i style="width:' + Math.max(8, v / max * 100) + '%"></i></span></div>').join('') + '</div>' : '';
  const sg = NK.suggest(3);
  $('#sugLead').textContent = sg.personal ? 'Похоже на то, что тебе зашло' : 'Пока оценок мало, вот с чего начать';
  $('#sugList').innerHTML = sg.list.length ? '<div class="toplist">' + sg.list.map(x =>
    '<button class="toprow" data-id="' + x.t.id + '" style="grid-template-columns:44px 1fr auto"><img src="' + icon(x.t) + '" alt="" width="44" height="44" loading="lazy">' +
    '<span><span class="rn">' + esc(x.t.name) + '</span>' + (x.why.length ? '<span class="why">тебе заходит ' + esc(andList(x.why.slice(0, 2).map(tagLike))) + '</span>' : '<span class="rm">' + esc(x.t.base) + ' · ' + esc(x.t.taste) + '</span>') + '</span>' +
    '<span class="no">№ ' + String(x.t.id).padStart(2, '0') + '</span></button>').join('') + '</div>' : '<p class="empty">Ты попробовал всё, что есть</p>';
}

// ---------- звания ----------
function renderRanks() {
  const rk = NK.rank(), ranks = NK.cfg.ranks;
  $('#rkName').textContent = rk.r.name; $('#rkLine').textContent = rk.r.line;
  $('#rkMedal').src = 'assets/medals/' + rk.r.medal + '.webp';
  $('#rkBar').style.width = (rk.n / rk.total * 100) + '%';
  $('#rkCount').textContent = plural(rk.n, 'печать', 'печати', 'печатей') + ' из ' + rk.total;
  $('#rkNext').textContent = rk.next ? 'до следующего ещё ' + rk.left : 'всё собрано';
  $('#ladder').innerHTML = ranks.slice(1).map(r => {
    const need = r.at == null ? rk.total : r.at, done = rk.n >= need;
    return '<div class="step' + (done ? ' done' : '') + (r === rk.r ? ' cur' : '') + '"><span class="medal"><img src="assets/medals/' + r.medal + '.webp" alt="" width="56" height="56" loading="lazy"></span>' +
      '<span><span class="sn">' + esc(r.name) + '</span><br><span class="sl">' + (done ? esc(r.line) : r.at == null ? 'все ' + plural(need, 'печать', 'печати', 'печатей') : plural(need, 'печать', 'печати', 'печатей')) + '</span></span></div>';
  }).join('');
  const favs = NK.cfg.tinctures.filter(t => (NK.entry(t.id) || {}).f).length;
  $('#summary').innerHTML = NK.tasted() ? 'В книжке <b>' + plural(NK.tasted(), 'запись', 'записи', 'записей') + '</b>, из них с печатью <b>' + NK.stamped() + '</b>' +
    (favs ? ', а «возьму ещё» стоит у <b>' + plural(favs, 'настойки', 'настоек', 'настоек') + '</b>' : '') : 'Книжка пока пустая. Начни с любой настойки';
}

// ---------- диалоги ----------
function dialog(html, onOpen) {
  $('#dlgCard').innerHTML = html; $('#dlg').classList.add('on');
  const f = $('#dlgCard').querySelector('button'); if (f) setTimeout(() => f.focus(), 50);
  $('#dlgCard').querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeDialog));
  if (onOpen) onOpen($('#dlgCard'));
}
function closeDialog() { $('#dlg').classList.remove('on'); }
function rankUp(r) {
  if (navigator.vibrate) navigator.vibrate([30, 60, 30, 60, 80]);
  dialog('<div class="big-medal"><img src="assets/medals/' + r.medal + '.webp" alt="" width="120" height="120"></div><p style="margin:0;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)">Новое звание</p>' +
    '<h3>' + esc(r.name) + '</h3><p>' + esc(r.line) + '</p><button class="btn btn-gold" data-close>Ура</button>');
  render();
}
async function openBackup() {
  const link = await NK.backupLink();
  const canShare = !!navigator.share;
  dialog('<h3>Книжка ссылкой</h3><p>Книжка живёт в этом браузере. Отправь ссылку себе в Избранное: откроешь её на новом телефоне, и все записи с печатями вернутся</p>' +
    '<div class="link-box">' + esc(link) + '</div>' +
    (canShare ? '<button class="btn btn-ink" id="bkShare">Отправить себе</button>' : '') +
    '<button class="btn ' + (canShare ? 'btn-line' : 'btn-ink') + '" id="bkCopy">Скопировать ссылку</button><button class="btn btn-line" data-close>Закрыть</button>', card => {
    if (canShare) card.querySelector('#bkShare').addEventListener('click', () => navigator.share({title: 'Моя настоечная книжка', url: link}).catch(() => {}));
    card.querySelector('#bkCopy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована'); }
      catch (e) { const r = document.createRange(); r.selectNodeContents(card.querySelector('.link-box')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Выделил, скопируй вручную'); }
    });
  });
}
async function checkIncoming() {
  if (!/[#&]b=/.test(location.hash)) return;
  const bk = await NK.readBackup(location.hash);
  history.replaceState(null, '', location.pathname + location.search);
  if (!bk) { toast('Ссылка с книжкой битая, ничего не добавили'); return; }
  dialog('<h3>Нашли книжку</h3><p>В ссылке ' + plural(bk.count, 'запись', 'записи', 'записей') + '. Добавить к этой книжке? Твои записи останутся, недостающие доберутся</p>' +
    '<button class="btn btn-ink" id="bkYes">Добавить</button><button class="btn btn-line" data-close>Не надо</button>', card => {
    card.querySelector('#bkYes').addEventListener('click', () => {
      const m = NK.merge(bk.e); closeDialog(); render();
      if (m.rankUp) setTimeout(() => rankUp(m.rank), 300); else toast(m.added ? 'Добавили ' + plural(m.added, 'запись', 'записи', 'записей') : 'Всё уже было в книжке');
    });
  });
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }

// ---------- картинка «моя книжка» 1080x1920 ----------
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
function glassPath(g, x, y, w, h, on) {
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w * .86, y + h); g.lineTo(x + w * .14, y + h); g.closePath();
  if (on) { g.save(); g.clip(); g.fillStyle = '#F7A813'; g.fillRect(x, y + h * .3, w, h); g.restore(); }
  g.lineWidth = 4; g.strokeStyle = on ? '#9A5E00' : '#B9AC97'; g.stroke();
}
if (!CanvasRenderingContext2D.prototype.roundRect) {  // iOS 15 и старые Android
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}
async function makeCard() {
  await Promise.all(['84px Oranienbaum', '40px "PT Serif"', 'italic 40px "PT Serif"', '40px Caveat'].map(f => document.fonts.load(f, 'АБВабв')));
  const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const rk = NK.rank(), top = NK.top(3).filter(x => x.e.r >= 3);
  const [bg, neon, medal, ...icons] = await Promise.all(['assets/bg_clean.webp', 'assets/neon.webp', 'assets/medals/' + rk.r.medal + '.webp', ...top.map(x => icon(x.t))].map(loadImg));
  g.fillStyle = '#140e08'; g.fillRect(0, 0, W, H);
  const s = W / bg.width; g.drawImage(bg, 0, 0, W, bg.height * s);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(20,14,8,.1)'); gr.addColorStop(.28, 'rgba(20,14,8,.35)'); gr.addColorStop(.45, 'rgba(20,14,8,.8)'); gr.addColorStop(1, 'rgba(20,14,8,.96)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const nw = 820, nh = neon.height * nw / neon.width; g.drawImage(neon, (W - nw) / 2, 70, nw, nh);
  g.textAlign = 'center'; g.fillStyle = '#FFF4E2'; g.shadowColor = 'rgba(20,10,2,.9)'; g.shadowBlur = 24;
  g.font = '80px Oranienbaum'; g.fillText('НАСТОЕЧНАЯ КНИЖКА', W / 2, 440); g.shadowBlur = 0;
  g.font = 'italic 38px "PT Serif"'; g.fillStyle = 'rgba(255,244,226,.85)'; g.fillText(NK.cfg.venue, W / 2, 500);
  // бумажная страница
  const px = 60, py = 600, pw = W - 120, ph = H - 660;
  g.fillStyle = '#F6F1E7'; g.beginPath(); g.roundRect(px, py, pw, ph, 40); g.fill();
  g.fillStyle = '#1D1D1B'; g.beginPath(); g.arc(W / 2, py + 150, 112, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(W / 2, py + 150, 112, 0, Math.PI * 2); g.clip(); g.drawImage(medal, W / 2 - 132, py + 18, 264, 264); g.restore();
  g.font = 'italic 36px "PT Serif"'; g.fillStyle = '#73675A'; g.fillText('звание', W / 2, py + 320);
  g.font = (rk.r.name.length > 16 ? '62px' : '78px') + ' Oranienbaum'; g.fillStyle = '#9A5E00'; g.fillText(rk.r.name, W / 2, py + 400);
  g.font = '38px "PT Serif"'; g.fillStyle = '#4A4034';
  g.fillText('печатей ' + rk.n + ' из ' + rk.total + ' · ' + plural(NK.tasted(), 'запись', 'записи', 'записей'), W / 2, py + 462);
  g.fillStyle = '#EEE5D2'; g.beginPath(); g.roundRect(px + 90, py + 495, pw - 180, 16, 8); g.fill();
  g.fillStyle = '#F7A813'; g.beginPath(); g.roundRect(px + 90, py + 495, Math.max(16, (pw - 180) * rk.n / rk.total), 16, 8); g.fill();
  let y = py + 610;
  g.textAlign = 'left'; g.font = '54px Oranienbaum'; g.fillStyle = '#1D1D1B'; g.fillText('Мой топ', px + 70, y);
  y += 30;
  if (!top.length) { g.font = '52px Caveat'; g.fillStyle = '#2B2117'; g.fillText('книжка только начинается', px + 70, y + 90); }
  top.forEach((x, i) => {
    const ry = y + i * 170;
    g.strokeStyle = '#DCCFB6'; g.lineWidth = 2; g.beginPath(); g.moveTo(px + 70, ry + 160); g.lineTo(px + pw - 70, ry + 160); g.stroke();
    g.drawImage(icons[i], px + 60, ry + 20, 130, 130);
    g.fillStyle = '#1D1D1B'; g.font = '46px "PT Serif"';
    let nm = x.t.name; while (g.measureText(nm).width > pw - 330 && nm.length > 4) nm = nm.slice(0, -2) + '…';
    g.fillText(nm, px + 220, ry + 78);
    for (let k = 1; k <= 5; k++) glassPath(g, px + 222 + (k - 1) * 46, ry + 100, 30, 38, k <= x.e.r);
    if (x.e.f) { g.font = '40px Caveat'; g.fillStyle = '#A3242B'; g.fillText('возьму ещё', px + 470, ry + 132); }
  });
  g.textAlign = 'center'; g.font = '30px "PT Serif"'; g.fillStyle = '#73675A';
  g.fillText(NK.cfg.address + ' · 18+', W / 2, py + ph - 40);
  return new Promise(ok => c.toBlob(ok, 'image/png'));
}
async function openStory() {
  dialog('<h3>Моя книжка</h3><p>Собираю картинку…</p>');
  let blob;
  try { blob = await makeCard(); } catch (e) { dialog('<h3>Не вышло</h3><p>Обнови страницу и попробуй ещё раз</p><button class="btn btn-line" data-close>Закрыть</button>'); return; }
  const url = URL.createObjectURL(blob), file = new File([blob], 'nastoechnaya-knizhka.png', {type: 'image/png'});
  const canShare = !!(navigator.canShare && navigator.canShare({files: [file]}));
  dialog('<h3>Моя книжка</h3><p>Картинка под сторис</p><img class="story-prev" src="' + url + '" alt="Картинка с твоим званием и топом" width="216" height="384">' +
    (canShare ? '<button class="btn btn-ink" id="stShare">Поделиться</button>' : '') +
    '<a class="btn ' + (canShare ? 'btn-line' : 'btn-ink') + '" href="' + url + '" download="nastoechnaya-knizhka.png">Сохранить картинку</a>' +
    '<button class="btn btn-line" data-close>Закрыть</button>', card => {
    if (canShare) card.querySelector('#stShare').addEventListener('click', () => navigator.share({files: [file]}).catch(() => {}));
  });
}

// ---------- навигация ----------
const TITLES = {book: 'Настоечная книжка', top: 'Мой топ', ranks: 'Звания'};
function show(v) {
  view = v;
  document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== 'v-' + v);
  document.querySelectorAll('.tabs button').forEach(b => b.dataset.v === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#hdTitle').textContent = TITLES[v];
  render(); window.scrollTo(0, 0);
}
function render() { if (view === 'book') renderBook(); else if (view === 'top') renderTop(); else renderRanks(); }

document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.v)));
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; renderBook(); }));
$('#q').addEventListener('input', e => { query = e.target.value; renderBook(); });
document.addEventListener('click', e => { const r = e.target.closest('.row, .toprow'); if (r && r.dataset.id) openLeaf(+r.dataset.id); });
$('#dlg').addEventListener('click', e => { if (e.target.id === 'dlg') closeDialog(); });
$('#backupBtn').addEventListener('click', openBackup);
$('#storyBtn').addEventListener('click', openStory);
window.addEventListener('hashchange', () => { if (NK.cfg) checkIncoming(); });
window.addEventListener('popstate', e => { if (e.state && e.state.leaf) openLeaf(e.state.leaf, false); else closeLeaf(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#dlg').classList.contains('on')) closeDialog(); else if (openId) history.back(); } });

// ---------- заставка и знакомство ----------
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const ssSet = k => { try { sessionStorage.setItem(k, '1'); } catch (e) {} };
let coverTimer, onbFirst = false;
function openCover() {
  const sp = $('#splash'); if (sp.classList.contains('open') || sp.classList.contains('gone')) return;
  clearTimeout(coverTimer); ssSet('nk_cover');
  sp.classList.add('open');
  setTimeout(() => { sp.classList.add('gone'); afterCover(); }, 860);
}
function afterCover() {
  if (!NK.flags().onboarded || !NK.flags().adult) showOnb(true);
  else { document.body.classList.remove('no-scroll'); checkIncoming(); }
}
function onbIndex() { const t = $('#onbTrack'); return Math.round(t.scrollLeft / t.clientWidth); }
function onbSync() {
  const i = onbIndex(), last = i === 2;
  document.querySelectorAll('#onbDots i').forEach((d, k) => d.classList.toggle('on', k === i));
  $('#onbNext').textContent = last ? (onbFirst ? 'Мне есть 18, открыть книжку' : 'Понятно') : 'Дальше';
  $('#onbLegal').textContent = last && onbFirst ? 'Книжка про алкогольные настойки, она только для гостей старше 18' : '';
  $('#onbNo').hidden = !(last && onbFirst);
  $('#onbSkip').style.visibility = last ? 'hidden' : 'visible';
}
function showOnb(first) {
  onbFirst = first;
  const t = $('#onbTrack'); t.scrollLeft = 0;
  document.body.classList.add('no-scroll');
  $('#onb').classList.add('on'); onbSync();
}
function hideOnb() { $('#onb').classList.remove('on'); document.body.classList.remove('no-scroll'); }
function onbGo(i) { const t = $('#onbTrack'); t.scrollTo({left: i * t.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); setTimeout(onbSync, 420); }
$('#splash').addEventListener('click', openCover);
$('#onbTrack').addEventListener('scroll', () => { clearTimeout(onbSync.t); onbSync.t = setTimeout(onbSync, 60); }, {passive: true});
$('#onbSkip').addEventListener('click', () => onbFirst ? onbGo(2) : hideOnb());
$('#onbNext').addEventListener('click', () => {
  const i = onbIndex();
  if (i < 2) return onbGo(i + 1);
  if (onbFirst) { NK.setFlag('adult'); NK.setFlag('onboarded'); hideOnb(); checkIncoming(); } else hideOnb();
});
$('#onbNo').addEventListener('click', () => {
  $('#onbLegal').textContent = 'Тогда книжка подождёт. А драники у нас вкусные в любом возрасте';
  $('#onbNext').hidden = true; $('#onbNo').hidden = true;
});
$('#howto').addEventListener('click', () => showOnb(false));

function boot(cfg) {
  NK.init(cfg);
  $('#hdSub').textContent = cfg.venue;
  $('#onbP1').textContent = 'У нас ' + plural(cfg.tinctures.length, 'домашняя настойка', 'домашние настойки', 'домашних настоек') + '. Взял рюмку, нашёл её в книжке';
  $('#onbSeal').innerHTML = seal(Date.now(), -8);
  document.querySelector('.art-note .rate').innerHTML = [1, 2, 3, 4, 5].map(i => '<button tabindex="-1" class="' + (i <= 4 ? 'on' : '') + '">' + GLASS + '</button>').join('');
  if (history.state && history.state.leaf) history.replaceState(null, '');
  show('book');
  const fl = NK.flags(), sp = $('#splash');
  if (fl.onboarded && fl.adult && ssGet('nk_cover')) { sp.classList.add('gone'); checkIncoming(); }
  else {
    document.body.classList.add('no-scroll');
    if (fl.onboarded && fl.adult) { sp.classList.add('quick'); coverTimer = setTimeout(openCover, 900); }
    else { sp.classList.add('lit'); coverTimer = setTimeout(openCover, 3000); }
  }
  window.NK_READY = true;
}
fetch('config/' + BAR + '.json', {cache: 'no-cache'}).then(r => r.json()).then(boot)
  .catch(() => { $('#splash').classList.add('gone'); document.body.classList.remove('no-scroll'); $('#list').innerHTML = '<p class="empty">Не загрузилось. Проверь интернет и обнови страницу</p>'; });
})();
