// До отрисовки: какая заставка нужна (первый раз, короткая, никакой), чтобы не мигал пустой экран
(function () {
  var c = 'nk-first';
  try {
    var bar = (/[?&]bar=([a-z0-9_-]{1,32})/.exec(location.search) || [0, 'svoboda'])[1];
    var st = JSON.parse(localStorage.getItem('nastoechnaya_' + bar + '_v1') || '{}');
    if (st.adult && st.onboarded) c = sessionStorage.getItem('nk_cover') ? 'nk-seen' : 'nk-quick';
  } catch (e) {}
  document.documentElement.className += ' ' + c;
})();
