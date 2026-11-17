(function () {
  var W = window;

  // Đã cài rồi (ví dụ chèn lại sau onPageFinished) -> chỉ cập nhật cấu hình
  if (W.__yt480api) {
    try { W.__yt480api.setCfg(W.__YT480_CFG); } catch (e) {}
    return;
  }

  // ===== Cấu hình (MainActivity truyền vào qua window.__YT480_CFG; chỉnh trong menu Cài đặt) =====
  var C = {
    q: 'hd1080',      // 'medium'=360p, 'large'=480p, 'hd720'=720p, 'hd1080'=1080p
    shorts: true,     // ẩn Shorts
    home: false,      // ẩn danh sách đề xuất ở trang chủ
    autoNext: false,  // true: cho phép tự phát video kế tiếp
    ads: true         // tự bỏ qua / ẩn quảng cáo
  };
  function merge(o) {
    if (!o) return;
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) C[k] = o[k];
  }
  merge(W.__YT480_CFG);
  // ===========================================================================================

  function bridge(fn, a) {
    try {
      if (!W.YT480 || !W.YT480[fn]) return;
      // Cầu nối Java so khớp theo số tham số: không được truyền thừa tham số
      if (a === undefined) W.YT480[fn](); else W.YT480[fn](a);
    } catch (e) {}
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

  // ---------- 1) Quảng cáo: gỡ dữ liệu quảng cáo khỏi phản hồi của YouTube ----------
  var AD_KEYS = ['adPlacements', 'playerAds', 'adSlots'];
  function stripAds(o, d) {
    d = d || 0;
    if (!o || typeof o !== 'object' || d > 3) return;
    if (Array.isArray(o)) {
      for (var i = 0; i < o.length && i < 8; i++) stripAds(o[i], d + 1);
      return;
    }
    for (var j = 0; j < AD_KEYS.length; j++) if (o[AD_KEYS[j]] !== undefined) delete o[AD_KEYS[j]];
    if (o.playerResponse) stripAds(o.playerResponse, d + 1);
  }
  try {
    var origParse = JSON.parse;
    JSON.parse = function () {
      var r = origParse.apply(this, arguments);
      if (C.ads) { try { stripAds(r); } catch (e) {} }
      return r;
    };
  } catch (e) {}
  try {
    if (W.Response && Response.prototype.json) {
      var origJson = Response.prototype.json;
      Response.prototype.json = function () {
        return origJson.apply(this, arguments).then(function (r) {
          if (C.ads) { try { stripAds(r); } catch (e) {} }
          return r;
        });
      };
    }
  } catch (e) {}
  try {
    var ipr;
    Object.defineProperty(W, 'ytInitialPlayerResponse', {
      configurable: true, enumerable: true,
      get: function () { return ipr; },
      set: function (v) { if (C.ads) { try { stripAds(v); } catch (e) {} } ipr = v; }
    });
  } catch (e) {}

  // ---------- 2) Báo máy KHÔNG hỗ trợ VP9/AV1/WebM -> YouTube chọn H.264 (mp4) + AAC ----------
  var BAD = ['webm', 'vp8', 'vp9', 'vp09', 'av01', 'opus'];
  function bad(t) {
    if (typeof t !== 'string') return false;
    t = t.toLowerCase();
    for (var i = 0; i < BAD.length; i++) if (t.indexOf(BAD[i]) !== -1) return true;
    return false;
  }
  try {
    var vp = W.HTMLVideoElement && HTMLVideoElement.prototype;
    if (vp && vp.canPlayType) {
      var origCan = vp.canPlayType;
      vp.canPlayType = function (t) { return bad(t) ? '' : origCan.apply(this, arguments); };
    }
    var ms = W.MediaSource;
    if (ms && ms.isTypeSupported) {
      var origIs = ms.isTypeSupported.bind(ms);
      ms.isTypeSupported = function (t) { return bad(t) ? false : origIs(t); };
    }
  } catch (e) {}

  // ---------- 3) Chất lượng ----------
  function saveQuality() {
    try {
      var tc = Date.now(), te = tc + 2592000000;
      localStorage.setItem('yt-player-quality', JSON.stringify({ data: C.q, expiration: te, creation: tc }));
    } catch (e) {}
  }
  saveQuality();

  // ---------- 4) CSS ----------
  var TB_H = 64; // chiều cao thanh công cụ (px)
  var CSS = [
    // Bỏ hiệu ứng: hoạt ảnh, chuyển động, đổ bóng, làm mờ nền
    '*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;animation-iteration-count:1!important;',
    'transition-duration:.001s!important;transition-delay:0s!important;scroll-behavior:auto!important;',
    'box-shadow:none!important;text-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;will-change:auto!important}',
    // Bỏ phụ đề, bình luận, lời mời mở app
    '.ytp-caption-window-container,.caption-window,.ytp-caption-segment,.ytp-subtitles-button{display:none!important}',
    'ytm-comment-section-renderer,ytm-comments-entry-point-header-renderer,ytm-mealbar-promo-renderer,ytm-app-promo-renderer{display:none!important}',
    // Ẩn thành phần (kiểu Unhook), bật/tắt bằng class trên <html>
    'html.__nsh ytm-reel-shelf-renderer,html.__nsh ytm-shorts-lockup-view-model{display:none!important}',
    'html.__nhm.__home ytm-rich-grid-renderer{display:none!important}',
    // Quảng cáo trong danh sách
    'html.__noads ytm-promoted-sparkles-web-renderer,html.__noads ytm-promoted-video-renderer,html.__noads ytm-ad-slot-renderer,',
    'html.__noads ytm-in-feed-ad-layout-renderer,html.__noads ytm-companion-slot,html.__noads ytm-brand-video-singleton-renderer,',
    'html.__noads ytm-display-ad-renderer,html.__noads .ad-container,html.__noads #masthead-ad{display:none!important}',
    // Viền chọn bằng remote
    '.__yf{outline:5px solid #ffd400!important;outline-offset:-5px!important}',
    // Thanh công cụ + bàn phím
    '#__yttb{position:fixed;top:0;left:0;right:0;height:' + TB_H + 'px;display:flex;align-items:center;padding:0 24px;',
    'box-sizing:border-box;background:#181818;z-index:2147482000;font-family:Roboto,Arial,sans-serif}',
    '.__tbb{height:44px;margin-left:12px;padding:0 22px;border:1px solid #555;border-radius:8px;background:#333;color:#fff;',
    'font-size:20px;white-space:nowrap}',
    '#__ytsf{flex:1;margin-left:0;text-align:left;overflow:hidden;text-overflow:ellipsis;color:#fff}',
    '#__ytsf.__ph{color:#9e9e9e}',
    '.__tbb.__yf,.__k.__yf{background:#ffd400!important;color:#000!important;outline:none!important;border-color:#ffd400!important}',
    '#__ytkb{display:none;position:fixed;top:' + (TB_H + 4) + 'px;left:24px;width:660px;box-sizing:border-box;padding:6px;',
    'background:#222;border:1px solid #555;border-radius:10px;z-index:2147482100;font-family:Roboto,Arial,sans-serif}',
    '.__kr{display:flex}',
    '.__k{flex:1;height:50px;margin:3px;padding:0;border:1px solid #555;border-radius:6px;background:#3a3a3a;color:#fff;font-size:24px}',
    '.__k.sp{font-size:17px}',
    // Toàn màn hình "giả" cho trang xem video
    '.__fsh{display:none!important}',
    'html.__fs,html.__fs body{overflow:hidden!important;background:#000!important}',
    'html.__fs #__yttb,html.__fs #__ytkb{display:none!important}',
    '.__fsa{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;',
    'width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;',
    'min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;',
    'transform:none!important;contain:none!important;filter:none!important;background:#000!important;',
    'overflow:hidden!important;z-index:2147483000!important}',
    'html.__fs video{position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;',
    'max-width:none!important;max-height:none!important;object-fit:contain!important;transform:none!important}',
    'html.__fs .ytp-chrome-top,html.__fs .ytp-chrome-bottom,html.__fs .ytp-gradient-top,html.__fs .ytp-gradient-bottom,',
    'html.__fs .ytp-pause-overlay,html.__fs .ytp-endscreen-content,html.__fs .ytp-ce-element,html.__fs .ytp-cards-teaser,',
    'html.__fs .ytp-watermark,html.__fs .ytp-paid-content-overlay{display:none!important}',
    // Thanh thông tin khi xem
    '#__ytosd{position:fixed;left:0;top:0;right:0;bottom:0;display:none;pointer-events:none;z-index:2147483647;',
    'font-family:Roboto,Arial,sans-serif;color:#fff}',
    '#__ytosd-c{display:none;position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.65);',
    'padding:14px 34px;border-radius:12px;font-size:34px;white-space:nowrap}',
    '#__ytosd-b{position:absolute;left:0;right:0;bottom:0;padding:70px 5% 4%;',
    'background:linear-gradient(to top,rgba(0,0,0,.85),rgba(0,0,0,0))}',
    '#__ytosd-t{font-size:30px;margin-bottom:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#__ytosd-bar{height:8px;background:rgba(255,255,255,.3);border-radius:4px;overflow:hidden}',
    '#__ytosd-fill{height:100%;width:0;background:#f33}',
    '#__ytosd-time{margin-top:10px;font-size:24px}'
  ].join('');

  function addCss() {
    try {
      if (document.getElementById('__yt480css')) return true;
      var host = document.head || document.documentElement;
      if (!host) return false;
      var st = document.createElement('style');
      st.id = '__yt480css';
      st.textContent = CSS;
      host.appendChild(st);
      return true;
    } catch (e) { return false; }
  }
  addCss();
  document.addEventListener('DOMContentLoaded', addCss, false);

  function applyClasses() {
    var h = document.documentElement;
    if (!h) return;
    var cl = h.classList;
    function f(n, on) { if (on) cl.add(n); else cl.remove(n); }
    f('__nsh', C.shorts);
    f('__nhm', C.home);
    f('__noads', C.ads);
    f('__home', location.pathname === '/');
  }

  // Ẩn thẻ video Shorts lẫn trong danh sách (CSS thuần không chọn được theo đường dẫn)
  var KEEP = { 'YTM-ITEM-SECTION-RENDERER': 1, 'YTM-SECTION-LIST-RENDERER': 1, 'YTM-BROWSE': 1, 'YTM-SEARCH': 1, 'YTM-APP': 1 };
  function hideShorts() {
    var as = document.querySelectorAll('a[href^="/shorts"]');
    for (var i = 0; i < as.length; i++) {
      var el = as[i].parentElement, n = 0;
      while (el && n < 8) {
        var t = el.tagName || '';
        if (t.indexOf('YTM-') === 0 && !KEEP[t] && /(RENDERER|VIEW-MODEL)$/.test(t)) {
          el.style.display = 'none';
          break;
        }
        el = el.parentElement; n++;
      }
    }
  }

  // ---------- 5) Ngăn tự phát video kế + thông báo khi xem xong ----------
  document.addEventListener('ended', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'VIDEO') return;
    var pl = document.getElementById('movie_player');
    if (pl && pl.classList && pl.classList.contains('ad-showing')) return; // video quảng cáo: để trang tự xử lý
    if (fs.on) showOsd('Đã xem xong. OK: xem lại, Back: quay lại');
    if (!C.autoNext) e.stopImmediatePropagation();
  }, true);

  // ---------- 6) Báo cho phần native khi đang gõ chữ trong ô nhập thật của trang ----------
  function isEditable(t) {
    if (!t || !t.tagName) return false;
    var n = t.tagName;
    return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT' || !!t.isContentEditable;
  }
  document.addEventListener('focus', function (e) { bridge('typing', isEditable(e.target)); }, true);
  document.addEventListener('blur', function (e) { if (isEditable(e.target)) bridge('typing', false); }, true);

  // ---------- 7) Gõ tiếng Việt kiểu Telex ----------
  var TONES = { s: '\u0301', f: '\u0300', r: '\u0309', x: '\u0303', j: '\u0323' };
  var HORN = '\u031B', CIRC = '\u0302', BREVE = '\u0306';
  var VOW = 'aeiouy';
  function isV(x) { return VOW.indexOf(x.c) >= 0; }

  function parseWord(w) {
    var d = w.normalize('NFD'), u = [], tone = '';
    for (var i = 0; i < d.length; i++) {
      var ch = d.charAt(i), code = d.charCodeAt(i);
      if ((code >= 0x300 && code <= 0x36F) || code === 0x31B) {
        if (code === 0x302 || code === 0x306 || code === 0x31B) { if (u.length) u[u.length - 1].m = ch; }
        else tone = ch;
      } else if (ch === '\u0111') {
        u.push({ c: 'd', m: '-' });
      } else {
        u.push({ c: ch, m: '' });
      }
    }
    return { u: u, tone: tone };
  }

  // Vị trí đặt dấu thanh (kiểu mới: hoà, thuý)
  function placeTone(p) {
    var u = p.u, idx = [], i;
    for (i = 0; i < u.length; i++) {
      if (!isV(u[i])) continue;
      if (u[i].c === 'u' && i > 0 && u[i - 1].c === 'q') continue;
      if (u[i].c === 'i' && i > 0 && u[i - 1].c === 'g' && i + 1 < u.length && isV(u[i + 1])) continue;
      idx.push(i);
    }
    if (!idx.length) return -1;
    var last = -1;
    for (i = 0; i < idx.length; i++) if (u[idx[i]].m && u[idx[i]].m !== '-') last = idx[i];
    if (last >= 0) return last;
    if (idx.length === 1) return idx[0];
    if (idx.length === 2) {
      var trailing = idx[1] < u.length - 1;
      var pair = u[idx[0]].c + u[idx[1]].c;
      return (trailing || pair === 'oa' || pair === 'oe' || pair === 'uy') ? idx[1] : idx[0];
    }
    return idx[1];
  }

  function renderWord(p) {
    var ti = p.tone ? placeTone(p) : -1, out = '';
    for (var i = 0; i < p.u.length; i++) {
      var x = p.u[i];
      if (x.c === 'd' && x.m === '-') { out += '\u0111'; continue; }
      var s = x.c + (x.m && x.m !== '-' ? x.m : '');
      if (i === ti) s += p.tone;
      out += s.normalize('NFC');
    }
    return out;
  }

  // Thêm một chữ vào cuối văn bản, áp dụng quy tắc Telex lên từ cuối cùng
  function telexAdd(text, ch) {
    if (!''.normalize || ch.length !== 1) return text + ch;
    var m = /[^ ]*$/.exec(text)[0], head = text.slice(0, text.length - m.length);
    var p = parseWord(m), u = p.u, n = u.length, last = u[n - 1], i;

    // dấu thanh: s f r x j (z: xóa dấu)
    if (TONES.hasOwnProperty(ch) || ch === 'z') {
      var hasV = false;
      for (i = 0; i < n; i++) if (isV(u[i])) hasV = true;
      if (!hasV) return text + ch;
      if (ch === 'z') {
        if (p.tone) { p.tone = ''; return head + renderWord(p); }
        return text + ch;
      }
      if (p.tone === TONES[ch]) { p.tone = ''; return head + renderWord(p) + ch; } // bấm lần nữa: hủy dấu
      p.tone = TONES[ch];
      return head + renderWord(p);
    }
    // aa -> â, ee -> ê, oo -> ô
    if ((ch === 'a' || ch === 'e' || ch === 'o') && last && last.c === ch) {
      if (!last.m) { last.m = CIRC; return head + renderWord(p); }
      if (last.m === CIRC) { last.m = ''; return head + renderWord(p) + ch; }
    }
    // dd -> đ
    if (ch === 'd' && last && last.c === 'd') {
      if (!last.m) { last.m = '-'; return head + renderWord(p); }
      if (last.m === '-') { last.m = ''; return head + renderWord(p) + ch; }
    }
    // w: aw -> ă, ow -> ơ, uw -> ư, uow -> ươ, w đứng riêng -> ư
    if (ch === 'w') {
      if (last) {
        if (last.c === 'o' && !last.m) {
          var prev = u[n - 2];
          if (prev && prev.c === 'u' && !prev.m) prev.m = HORN;
          last.m = HORN;
          return head + renderWord(p);
        }
        if (last.c === 'a' && !last.m) { last.m = BREVE; return head + renderWord(p); }
        if (last.c === 'u' && !last.m) { last.m = HORN; return head + renderWord(p); }
        if (last.c === 'u' && last.m === HORN && n === 1) return head + 'w'; // ww -> w
        if (last.m === HORN || last.m === BREVE) { last.m = ''; return head + renderWord(p) + ch; }
      }
      u.push({ c: 'u', m: HORN });
      return head + renderWord(p);
    }
    u.push({ c: ch, m: '' });
    return head + renderWord(p);
  }

  // ---------- 8) Thanh công cụ + bàn phím nhỏ (nằm trong trang, cùng hệ thống điều hướng remote) ----------
  var kb = { open: false, text: store('yt480q') || '', telex: store('yt480telex') === '1' };
  var tbEl = null, kbEl = null;
  var KROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'bs'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '-', 'clear']
  ];
  var KLABEL = { bs: 'Xóa', clear: 'Hết', space: 'Dấu cách', go: 'Tìm', telex: '' };

  function $(id) { return document.getElementById(id); }

  function updateSearchField() {
    var f = $('__ytsf');
    if (!f) return;
    f.textContent = kb.text || 'Tìm video trên YouTube... (bấm OK để gõ)';
    f.className = kb.text ? '__tbb' : '__tbb __ph';
    if (cur === f) f.classList.add('__yf');
  }
  function updateTelexKey() {
    var k = kbEl && kbEl.querySelector('[data-k="telex"]');
    if (k) k.textContent = 'Telex: ' + (kb.telex ? 'Bật' : 'Tắt');
  }

  function ensureUi() {
    if (!document.documentElement) return;
    if (tbEl && document.documentElement.contains(tbEl)) return;
    tbEl = document.createElement('div');
    tbEl.id = '__yttb';
    tbEl.innerHTML = '<button id="__ytsf" class="__tbb"></button>' +
      '<button id="__ytgo" class="__tbb">Tìm</button>' +
      '<button id="__ythome" class="__tbb">Trang chủ</button>' +
      '<button id="__ytset" class="__tbb">Cài đặt</button>';
    document.documentElement.appendChild(tbEl);

    kbEl = document.createElement('div');
    kbEl.id = '__ytkb';
    var html = '', r, c;
    for (r = 0; r < KROWS.length; r++) {
      html += '<div class="__kr">';
      for (c = 0; c < KROWS[r].length; c++) {
        var k = KROWS[r][c], sp = KLABEL[k] !== undefined;
        html += '<button class="__k' + (sp ? ' sp' : '') + '" data-k="' + k + '">' + (sp ? KLABEL[k] : k) + '</button>';
      }
      html += '</div>';
    }
    html += '<div class="__kr">' +
      '<button class="__k sp" data-k="telex" style="flex:3"></button>' +
      '<button class="__k sp" data-k="space" style="flex:5">Dấu cách</button>' +
      '<button class="__k sp" data-k="go" style="flex:2">Tìm</button></div>';
    kbEl.innerHTML = html;
    document.documentElement.appendChild(kbEl);

    tbEl.addEventListener('click', function (e) {
      var b = closest(e.target, '.__tbb');
      if (!b) return;
      if (b.id === '__ytsf') openKb();
      else if (b.id === '__ytgo') doSearch();
      else if (b.id === '__ythome') { closeKb(); location.href = '/'; }
      else if (b.id === '__ytset') bridge('openSettings');
    }, false);
    kbEl.addEventListener('click', function (e) {
      var b = closest(e.target, '.__k');
      if (b) kbKey(b.getAttribute('data-k'));
    }, false);
    updateSearchField();
    updateTelexKey();
  }

  function openKb() {
    ensureUi();
    kb.open = true;
    kbEl.style.display = 'block';
    var g = kbEl.querySelector('[data-k="g"]');
    if (g) setCur(g);
  }
  function closeKb() {
    if (!kb.open) return;
    kb.open = false;
    if (kbEl) kbEl.style.display = 'none';
    var f = $('__ytsf');
    if (f) setCur(f);
  }
  function doSearch() {
    var q = (kb.text || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    if (!q) { openKb(); return; }
    store('yt480q', q);
    kb.open = false;
    if (kbEl) kbEl.style.display = 'none';
    location.href = '/results?search_query=' + encodeURIComponent(q);
  }
  function kbKey(k) {
    switch (k) {
      case 'bs': kb.text = kb.text.slice(0, -1); break;
      case 'clear': kb.text = ''; break;
      case 'space': if (kb.text && kb.text.slice(-1) !== ' ') kb.text += ' '; break;
      case 'telex':
        kb.telex = !kb.telex;
        store('yt480telex', kb.telex ? '1' : '0');
        updateTelexKey();
        return;
      case 'go': doSearch(); return;
      default:
        kb.text = kb.telex ? telexAdd(kb.text, k) : kb.text + k;
    }
    if (kb.text.length > 120) kb.text = kb.text.slice(0, 120);
    updateSearchField();
  }
  // Bàn phím vật lý (remote có bàn phím nhỏ): gõ thẳng khi bàn phím ảo đang mở
  document.addEventListener('keydown', function (e) {
    if (!kb.open || e.ctrlKey || e.altKey || e.metaKey) return;
    var c = e.keyCode, ch = null;
    if (c === 8) { kbKey('bs'); e.preventDefault(); return; }
    if (e.key && e.key.length === 1) ch = e.key.toLowerCase();
    else if (c >= 65 && c <= 90) ch = String.fromCharCode(c + 32);
    else if (c >= 48 && c <= 57) ch = String.fromCharCode(c);
    if (ch === null) return;
    kbKey(ch === ' ' ? 'space' : ch);
    e.preventDefault();
  }, true);

  // ---------- 9) Điều hướng bằng remote (chọn theo hướng) ----------
  var SEL = 'a[href],button,[role="button"],[role="tab"],[role="link"],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  var VSEL = 'a[href*="/watch"],a[href*="/shorts/"],a[href*="/playlist"]';
  var SKIP = 'ytm-menu,.media-item-menu,#__ytosd';
  var cur = null, curAct = null, lastHref = null, navSeq = 0;

  var matchFn = Element.prototype.matches || Element.prototype.webkitMatchesSelector;
  function closest(el, sel) {
    while (el && el.nodeType === 1) {
      if (matchFn.call(el, sel)) return el;
      el = el.parentElement;
    }
    return null;
  }
  function isUi(el) { return !!closest(el, '#__yttb,#__ytkb'); }
  function area(r) { return (r.right - r.left) * (r.bottom - r.top); }

  // Khóa nhận diện một video (các liên kết trong cùng một thẻ có thể khác tham số nhưng cùng video)
  function vkey(h) {
    h = h || '';
    var m = /[?&]v=([\w-]{6,})/.exec(h) || /\/shorts\/([\w-]+)/.exec(h);
    if (m) return m[1];
    m = /[?&]list=([\w-]+)/.exec(h);
    return m ? 'L' + m[1] : h;
  }

  // Tìm khung của cả thẻ video: leo lên cha chừng nào cha còn chỉ chứa đúng video đó
  function cardBox(a, vh) {
    var key = vkey(a.getAttribute('href')), box = a, p = a.parentElement, n = 0;
    while (p && n < 8 && p !== document.body && p !== document.documentElement) {
      if (KEEP[p.tagName]) break;
      var as = p.querySelectorAll(VSEL), same = true;
      for (var i = 0; i < as.length; i++) {
        if (vkey(as[i].getAttribute('href')) !== key) { same = false; break; }
      }
      if (!same) break;
      if (p.getBoundingClientRect().height > vh * 0.85) break;
      box = p; p = p.parentElement; n++;
    }
    return box;
  }

  function visibleRect(el, vw, vh) {
    var r = el.getBoundingClientRect();
    if (r.width < 12 || r.height < 12) return null;
    if (r.bottom < -vh || r.top > vh * 2 || r.right < 0 || r.left > vw) return null;
    var cs = W.getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return null;
    return r;
  }

  // Danh sách các "điểm dừng": mỗi thẻ video là MỘT điểm dừng (không tách ảnh / mô tả / kênh)
  function collect() {
    var out = [], vh = W.innerHeight, vw = W.innerWidth, onlyKb = kb.open;
    var boxes = [], i, j, el, r;

    if (!onlyKb) {
      var vas = document.querySelectorAll(VSEL);
      for (i = 0; i < vas.length; i++) {
        var a = vas[i], inside = false;
        for (j = 0; j < boxes.length; j++) if (boxes[j].contains(a)) { inside = true; break; }
        if (inside) continue;
        if (a.getBoundingClientRect().width < 8) continue;
        var box = cardBox(a, vh);
        boxes.push(box);
        // Liên kết dùng để mở video: liên kết lớn nhất trong thẻ (thường là ảnh bìa)
        var act = a, best = 0, ins = box.querySelectorAll(VSEL);
        for (j = 0; j < ins.length; j++) {
          var br = ins[j].getBoundingClientRect(), ar = br.width * br.height;
          if (ar > best) { best = ar; act = ins[j]; }
        }
        r = visibleRect(box, vw, vh);
        if (!r || r.bottom <= TB_H + 2) continue; // nằm hẳn dưới thanh công cụ
        out.push({ el: box, act: act, href: act.getAttribute('href'),
          r: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
      }
    }

    var list = document.querySelectorAll(SEL);
    for (i = 0; i < list.length; i++) {
      el = list[i];
      if (el.disabled) continue;
      var inKb = !!closest(el, '#__ytkb');
      if (onlyKb && !inKb) continue;
      var skip = false;
      for (j = 0; j < boxes.length; j++) if (boxes[j].contains(el)) { skip = true; break; }
      if (skip) continue; // thành phần nằm trong thẻ video (kênh, menu...) đã gộp vào thẻ
      r = visibleRect(el, vw, vh);
      if (!r) continue;
      var ui = inKb || !!closest(el, '#__yttb');
      if (!ui && r.bottom <= TB_H + 2) continue;
      if (closest(el, SKIP)) continue;
      out.push({ el: el, act: el, href: el.tagName === 'A' ? el.getAttribute('href') : null,
        r: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
    }
    return out;
  }

  // Chọn phần tử kế tiếp theo hướng.
  // Lượt 1: chỉ nhận phần tử NẰM THẲNG HÀNG (chồng lấn theo trục vuông góc), chọn cái gần nhất.
  // Lượt 2 (chỉ khi đi lên/xuống): nếu không có phần tử thẳng hàng thì lấy cái gần nhất lệch sang bên.
  function pick(cr, cands, dir, curEl) {
    var horiz = (dir === 'left' || dir === 'right'), fwd = (dir === 'right' || dir === 'down');
    var ccx = (cr.left + cr.right) / 2, ccy = (cr.top + cr.bottom) / 2;
    var best = null, bs = 1e12, pass, i;
    for (pass = 0; pass < (horiz ? 1 : 2) && !best; pass++) {
      for (i = 0; i < cands.length; i++) {
        var c = cands[i], r = c.r;
        if (c.el === curEl) continue;
        var cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
        var ctr, edge, ov, ext, cen;
        if (horiz) {
          ctr = fwd ? cx - ccx : ccx - cx;
          edge = fwd ? r.left - cr.right : cr.left - r.right;
          ov = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top);
          ext = Math.min(cr.bottom - cr.top, r.bottom - r.top);
          cen = Math.abs(cy - ccy);
        } else {
          ctr = fwd ? cy - ccy : ccy - cy;
          edge = fwd ? r.top - cr.bottom : cr.top - r.bottom;
          ov = Math.min(cr.right, r.right) - Math.max(cr.left, r.left);
          ext = Math.min(cr.right - cr.left, r.right - r.left);
          cen = Math.abs(cx - ccx);
        }
        if (ctr <= 4) continue;
        var s;
        if (pass === 0) {
          if (edge < -4 || ov <= ext * 0.3) continue;
          s = Math.max(0, edge) * 4 + cen * 0.3;
        } else {
          s = ctr + Math.max(0, -ov) * 3 + cen * 0.5;
        }
        if (s < bs) { bs = s; best = c; }
      }
      // lượt 1 không có kết quả -> sang lượt 2 (best vẫn null và bs giữ nguyên)
    }
    return best;
  }

  function isVideoHref(h) {
    return !!h && /^\/(watch|playlist|shorts)/.test(h.replace(/^https?:\/\/[^\/]+/, ''));
  }
  // Phần tử đầu tiên nên chọn: ưu tiên thẻ video, gần góc trên-trái màn hình
  function firstOf(cands) {
    var best = null, bs = 1e12, vh = W.innerHeight, any = null, as = 1e12;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i], r = c.r;
      var s = Math.max(0, r.top) + r.left * 0.3;
      if (s < as) { as = s; any = c; }
      if (r.bottom <= 0 || r.top >= vh) continue;
      s += isVideoHref(c.href) ? 0 : 100000;
      if (s < bs) { bs = s; best = c; }
    }
    return best || any;
  }

  function setCur(el, act) {
    if (cur && cur.classList) cur.classList.remove('__yf');
    cur = el;
    curAct = act || el;
    navSeq++;
    if (el) {
      el.classList.add('__yf');
      if (!isUi(el)) {
        var r = el.getBoundingClientRect(), vh = W.innerHeight, m = Math.max(TB_H + 40, Math.min(140, vh * 0.15));
        if (r.top < m || r.bottom > vh - 40) W.scrollBy(0, (r.top + r.bottom) / 2 - (vh + TB_H) / 2);
      }
    }
  }
  function setItem(it) { setCur(it.el, it.act); }

  function inList(el, cands) {
    for (var i = 0; i < cands.length; i++) if (cands[i].el === el) return true;
    return false;
  }
  function curValid(cands) {
    return cur && document.documentElement.contains(cur) && inList(cur, cands);
  }

  function move(dir, retried) {
    var cands = collect();
    if (!curValid(cands)) {
      var f = firstOf(cands);
      if (f) setItem(f);
      return;
    }
    var best = pick(cur.getBoundingClientRect(), cands, dir, cur);
    // Còn nội dung phía trên (đã cuộn xuống): cuộn lên trước, chưa nhảy lên thanh công cụ
    if (best && dir === 'up' && !isUi(cur) && isUi(best.el) && W.pageYOffset > 4) best = null;
    if (best) { setItem(best); return; }
    if (kb.open) return;
    if (dir === 'down' || dir === 'up') {
      var before = W.pageYOffset;
      W.scrollBy(0, (dir === 'down' ? 1 : -1) * W.innerHeight * 0.7);
      if (W.pageYOffset === before) return;
      if (!retried) setTimeout(function () { move(dir, true); }, 150);
    }
  }

  function ok() {
    var cands = collect();
    if (!curValid(cands)) {
      var f = firstOf(cands);
      if (f) setItem(f);
      return;
    }
    var t = curAct || cur;
    if (t.tagName === 'A') lastHref = t.getAttribute('href');
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') { t.focus(); return; }
    if (t.click) t.click();
    else t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  // Chọn lại phần tử (theo video) khi trang vừa tải xong hoặc vừa quay lại từ trang xem
  function restoreSoon(href) {
    var n = 0, seq0 = navSeq, want = href ? vkey(href) : null;
    (function t() {
      if (navSeq !== seq0) return; // người dùng đã tự di chuyển
      var c = collect(), m = null, vids = [], i;
      for (i = 0; i < c.length; i++) {
        if (want && c[i].href && vkey(c[i].href) === want) { m = c[i]; break; }
        if (isVideoHref(c[i].href) && !isUi(c[i].el)) vids.push(c[i]);
      }
      if (!m && !want && vids.length) m = firstOf(vids);
      if (m) { setItem(m); return; }
      if (++n < 12) { setTimeout(t, 250); return; }
      var f = firstOf(vids.length ? vids : c);
      if (f) setItem(f);
    })();
  }

  // ---------- 10) Xem video toàn màn hình + điều khiển bằng remote ----------
  var fs = { on: false, v: null, key: '', tagged: [], hidden: [] };

  function enterFs(v, key) {
    closeKb();
    setCur(null);
    var pl = document.getElementById('movie_player') || closest(v, '.html5-video-player');
    var el = v, inside = !!pl;
    while ((el = el.parentElement) && el !== document.body && el !== document.documentElement) {
      if (el === pl) inside = false;
      el.classList.add('__fsa');
      fs.tagged.push(el);
      if (!inside && el.parentElement) {
        var kids = el.parentElement.children;
        for (var i = 0; i < kids.length; i++) {
          var s = kids[i];
          if (s !== el && s.nodeType === 1 && s.id !== '__ytosd') {
            s.classList.add('__fsh');
            fs.hidden.push(s);
          }
        }
      }
    }
    document.documentElement.classList.add('__fs');
    fs.on = true; fs.v = v; fs.key = key;
    qTries = 0;
    showOsd();
  }

  function exitFs(restore) {
    var i;
    for (i = 0; i < fs.tagged.length; i++) fs.tagged[i].classList.remove('__fsa');
    for (i = 0; i < fs.hidden.length; i++) fs.hidden[i].classList.remove('__fsh');
    fs.tagged = []; fs.hidden = []; fs.on = false; fs.v = null; fs.key = '';
    document.documentElement.classList.remove('__fs');
    hideOsd();
    if (restore) restoreSoon(lastHref);
  }

  // --- thanh thông tin ---
  var osd = null, osdT = 0, osdI = 0, flashT = 0;
  function ensureOsd() {
    if (osd && document.documentElement.contains(osd)) return;
    osd = document.createElement('div');
    osd.id = '__ytosd';
    osd.innerHTML = '<div id="__ytosd-c"></div><div id="__ytosd-b"><div id="__ytosd-t"></div>' +
      '<div id="__ytosd-bar"><div id="__ytosd-fill"></div></div><div id="__ytosd-time"></div></div>';
    document.documentElement.appendChild(osd);
  }
  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (x < 10 ? '0' : '') + x;
  }
  function updateOsd() {
    var v = fs.v;
    if (!v || !osd) return;
    var d = v.duration, t = v.currentTime;
    var title = (document.title || '').replace(/\s*-\s*YouTube\s*$/, '');
    $('__ytosd-t').textContent = title;
    $('__ytosd-fill').style.width = (isFinite(d) && d > 0 ? Math.min(100, t / d * 100) : 0) + '%';
    $('__ytosd-time').textContent = fmt(t) + ' / ' + (isFinite(d) ? fmt(d) : 'trực tiếp');
  }
  function showOsd(msg) {
    ensureOsd();
    osd.style.display = 'block';
    var c = $('__ytosd-c');
    clearTimeout(flashT);
    if (msg) {
      c.textContent = msg;
      c.style.display = 'block';
      flashT = setTimeout(function () { c.style.display = 'none'; }, 1500);
    } else {
      c.style.display = 'none';
    }
    updateOsd();
    clearTimeout(osdT);
    osdT = setTimeout(hideOsd, 3500);
    if (!osdI) osdI = setInterval(updateOsd, 500);
  }
  function hideOsd() {
    if (osd) osd.style.display = 'none';
    clearInterval(osdI); osdI = 0;
    clearTimeout(osdT);
  }

  // --- điều khiển phát ---
  function player() { return document.getElementById('movie_player'); }
  function doPlay() {
    var p = player(), v = fs.v;
    try { if (p && p.playVideo) { p.playVideo(); return; } } catch (e) {}
    if (v) v.play();
  }
  function doPause() {
    var p = player(), v = fs.v;
    try { if (p && p.pauseVideo) { p.pauseVideo(); return; } } catch (e) {}
    if (v) v.pause();
  }
  function seekTo(t) {
    var p = player(), v = fs.v;
    try { if (p && p.seekTo) { p.seekTo(t, true); return; } } catch (e) {}
    if (v) v.currentTime = t;
  }
  function seekBy(d) {
    var v = fs.v;
    if (!v) return;
    var max = isFinite(v.duration) ? v.duration - 0.5 : 1e9;
    seekTo(Math.max(0, Math.min(max, v.currentTime + d)));
    showOsd((d > 0 ? '+' : '-') + Math.abs(d) + ' giây');
  }
  function toggle() {
    var v = fs.v;
    if (!v) return;
    if (v.ended) { seekTo(0); doPlay(); showOsd('Phát lại'); return; }
    if (v.paused) { doPlay(); showOsd('Phát'); }
    else { doPause(); showOsd('Tạm dừng'); }
  }
  // Bấm nút "Bỏ qua" quảng cáo của YouTube. force=true: bấm cả khi nút đang ẩn
  function clickSkip(force) {
    var bs = document.querySelectorAll('.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,[class*="skip-button"]');
    for (var i = 0; i < bs.length; i++) {
      var r = bs[i].getBoundingClientRect();
      if (force || (r.width > 0 && r.height > 0)) { bs[i].click(); return true; }
    }
    return false;
  }
  function step(rc) { return rc < 3 ? 10 : (rc < 10 ? 30 : 60); }

  function watchKey(n, rc) {
    switch (n) {
      case 'ok': if (!clickSkip(false)) toggle(); break;
      case 'playpause': toggle(); break;
      case 'play': doPlay(); showOsd('Phát'); break;
      case 'pause': doPause(); showOsd('Tạm dừng'); break;
      case 'left': case 'rw': seekBy(-step(rc)); break;
      case 'right': case 'ff': seekBy(step(rc)); break;
      case 'up': case 'down': showOsd(); break;
    }
  }
  function navKey(n) {
    if (n === 'up' || n === 'down' || n === 'left' || n === 'right') move(n, false);
    else if (n === 'ok') ok();
  }

  // ---------- 11) Vòng lặp nền ----------
  function tick() {
    try {
      addCss();
      applyClasses();
      ensureUi();
      if (/^\/watch/.test(location.pathname)) {
        var v = document.querySelector('video');
        var key = location.pathname + location.search;
        if (v && (!fs.on || fs.v !== v || fs.key !== key)) {
          if (fs.on) exitFs(false);
          enterFs(v, key);
        }
      } else {
        if (fs.on) exitFs(true);
        if (C.shorts) hideShorts();
      }
    } catch (e) {}
  }
  setInterval(tick, 500);

  // Dự phòng khi quảng cáo vẫn phát: tắt tiếng, bấm "Bỏ qua", tua tới cuối rồi khôi phục
  var adState = { on: false, muted: false, rate: 1 };
  function adTick() {
    try {
      if (!C.ads) return;
      var pl = player(), v = document.querySelector('video');
      if (!pl || !v) return;
      var cl = pl.classList;
      var ad = cl.contains('ad-showing') || cl.contains('ad-interrupting');
      if (ad) {
        if (!adState.on) { adState.on = true; adState.muted = v.muted; adState.rate = v.playbackRate || 1; }
        v.muted = true;
        if (clickSkip(true)) return;
        if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.3) {
          v.playbackRate = 16;
          v.currentTime = v.duration;
        }
      } else if (adState.on) {
        adState.on = false;
        v.muted = adState.muted;
        v.playbackRate = adState.rate;
      }
    } catch (e) {}
  }
  setInterval(adTick, 400);

  var lastVid = null, qTries = 0, capVid = null;
  var QORDER = ['hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
  // Mức chất lượng thực sự đặt được: mức muốn chọn, hoặc mức gần nhất bên dưới nếu video không có
  function targetQ(p) {
    var av = null;
    try { av = p.getAvailableQualityLevels && p.getAvailableQualityLevels(); } catch (e) {}
    if (!av || !av.length) return { q: C.q, known: false };
    var i = QORDER.indexOf(C.q);
    if (i < 0) return { q: C.q, known: false };
    for (; i < QORDER.length; i++) if (av.indexOf(QORDER[i]) >= 0) return { q: QORDER[i], known: true };
    return { q: C.q, known: false };
  }
  // Tải lại trang xem tại đúng giây đang xem (khi player giữ mức chất lượng cũ)
  function reloadAtTime() {
    var v = fs.v, t = v ? Math.floor(v.currentTime) : 0;
    var h = location.href.replace(/([?&])t=[^&#]*&?/, '$1').replace(/[?&]$/, '');
    h += (h.indexOf('?') < 0 ? '?' : '&') + 't=' + t + 's';
    location.href = h;
  }
  function applyQuality() {
    try {
      if (document.hidden) return;
      if (!/^\/(watch|shorts)/.test(location.pathname)) return;
      var p = player() || document.getElementsByClassName('html5-video-player')[0];
      if (!p) return;
      var vid = null;
      try { vid = p.getVideoData && p.getVideoData().video_id; } catch (e) {}
      if (vid !== lastVid) { lastVid = vid; qTries = 0; }
      if (vid !== capVid) {
        capVid = vid;
        try { if (p.unloadModule) p.unloadModule('captions'); } catch (e) {}
      }
      if (qTries >= 6) return;
      var tg = targetQ(p), curQ = null;
      try { curQ = p.getPlaybackQuality && p.getPlaybackQuality(); } catch (e) {}
      if (curQ === tg.q) { qTries = 6; return; }
      // Đặt cả mức thấp nhất lẫn cao nhất = mức muốn chọn (truyền một giá trị thì player vẫn tự nâng/hạ)
      if (p.setPlaybackQualityRange) p.setPlaybackQualityRange(tg.q, tg.q);
      if (p.setPlaybackQuality) p.setPlaybackQuality(tg.q);
      qTries++;
      // Đặt nhiều lần vẫn không đổi: player đã khóa mức cũ -> tải lại một lần để đọc mức mới
      if (qTries >= 6 && tg.known && fs.on) {
        var flag = (vid || '') + '|' + C.q;
        if (store('yt480rl') !== flag) { store('yt480rl', flag); reloadAtTime(); }
      }
    } catch (e) {}
  }
  setInterval(applyQuality, 1200);

  // ---------- 12) API cho phần native ----------
  W.__yt480api = {
    key: function (name, rc) {
      try {
        if (fs.on) watchKey(name, rc || 0);
        else navKey(name);
      } catch (e) {}
    },
    // Nút Back: true nếu đã xử lý (đóng bàn phím), false để native tự quay lại trang trước
    back: function () {
      try { if (kb.open) { closeKb(); return true; } } catch (e) {}
      return false;
    },
    setCfg: function (o) {
      var oldQ = C.q;
      merge(o);
      saveQuality();
      qTries = 0;
      if (C.q !== oldQ) store('yt480rl', '');
      try { applyClasses(); } catch (e) {}
    },
    autoFocus: function () {
      try { if (isEditable(document.activeElement)) document.activeElement.blur(); } catch (e) {}
      if (!fs.on) restoreSoon(null);
    },
    _t: { pick: pick, firstOf: firstOf, fmt: fmt, telexAdd: telexAdd, stripAds: stripAds, collect: collect, vkey: vkey, targetQ: targetQ }
  };
})();
