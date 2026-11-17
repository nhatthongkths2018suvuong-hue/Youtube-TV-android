(function () {
  var W = window;

  // Đã cài rồi (ví dụ chèn lại sau onPageFinished) -> chỉ cập nhật cấu hình
  if (W.__yt480api) {
    try { W.__yt480api.setCfg(W.__YT480_CFG); } catch (e) {}
    return;
  }

  // ===== CẤU HÌNH (được MainActivity truyền vào qua window.__YT480_CFG, chỉnh trong menu Cài đặt) =====
  var C = {
    q: 'hd1080',       // 'medium'=360p, 'large'=480p, 'hd720'=720p, 'hd1080'=1080p
    shorts: true,      // ẩn Shorts
    comments: true,    // ẩn bình luận
    home: false,       // ẩn danh sách đề xuất ở trang chủ
    autoNext: false    // true: cho phép tự phát video kế tiếp
  };
  function merge(o) {
    if (!o) return;
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) C[k] = o[k];
  }
  merge(W.__YT480_CFG);
  // =====================================================================================================

  function bridge(fn, a) {
    try { if (W.YT480 && W.YT480[fn]) W.YT480[fn](a); } catch (e) {}
  }

  // ---------- 1) Báo máy KHÔNG hỗ trợ VP9/AV1/WebM -> YouTube chọn H.264 (mp4) + AAC ----------
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

  // ---------- 2) Chất lượng ----------
  function saveQuality() {
    try {
      var tc = Date.now(), te = tc + 2592000000;
      localStorage.setItem('yt-player-quality', JSON.stringify({ data: C.q, expiration: te, creation: tc }));
    } catch (e) {}
  }
  saveQuality();

  // ---------- 3) CSS ----------
  var CSS = [
    // tắt hiệu ứng cho nhẹ máy
    '*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;animation-iteration-count:1!important;',
    'transition-duration:.001s!important;transition-delay:0s!important;scroll-behavior:auto!important;',
    'box-shadow:none!important;text-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;will-change:auto!important}',
    // tắt phụ đề
    '.ytp-caption-window-container,.caption-window,.ytp-caption-segment{display:none!important}',
    // ẩn thành phần (kiểu Unhook), bật/tắt bằng class trên <html>
    'html.__ncm ytm-comment-section-renderer,html.__ncm ytm-comments-entry-point-header-renderer{display:none!important}',
    'html.__nsh ytm-reel-shelf-renderer,html.__nsh ytm-shorts-lockup-view-model{display:none!important}',
    'html.__nhm.__home ytm-rich-grid-renderer{display:none!important}',
    // viền chọn bằng remote
    '.__yf{outline:5px solid #ffd400!important;outline-offset:-5px!important}',
    // toàn màn hình "giả" cho trang xem video
    '.__fsh{display:none!important}',
    'html.__fs,html.__fs body{overflow:hidden!important;background:#000!important}',
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
    // thanh thông tin khi xem
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
    f('__ncm', C.comments);
    f('__nhm', C.home);
    f('__home', location.pathname === '/');
  }

  // Ẩn các thẻ video Shorts lẫn trong danh sách (CSS thuần không chọn được theo đường dẫn)
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

  // ---------- 4) Ngăn tự phát video kế + thông báo khi xem xong ----------
  document.addEventListener('ended', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'VIDEO') return;
    var pl = document.getElementById('movie_player');
    if (pl && pl.classList && pl.classList.contains('ad-showing')) return; // video quảng cáo: để trang tự xử lý
    if (fs.on) showOsd('Đã xem xong. OK: xem lại, Back: quay lại');
    if (!C.autoNext) e.stopImmediatePropagation();
  }, true);

  // ---------- 5) Báo cho phần native biết khi đang gõ chữ trong ô nhập của trang ----------
  function isEditable(t) {
    if (!t || !t.tagName) return false;
    var n = t.tagName;
    return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT' || !!t.isContentEditable;
  }
  document.addEventListener('focus', function (e) { bridge('typing', isEditable(e.target)); }, true);
  document.addEventListener('blur', function (e) { if (isEditable(e.target)) bridge('typing', false); }, true);

  // ---------- 6) Điều hướng bằng remote (chọn theo hướng) ----------
  var SEL = 'a[href],button,[role="button"],[role="tab"],[role="link"],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  var SKIP = 'ytm-menu,.media-item-menu';
  var cur = null, lastHref = null;

  var matchFn = Element.prototype.matches || Element.prototype.webkitMatchesSelector;
  function closest(el, sel) {
    while (el && el.nodeType === 1) {
      if (matchFn.call(el, sel)) return el;
      el = el.parentElement;
    }
    return null;
  }
  function area(r) { return (r.right - r.left) * (r.bottom - r.top); }

  function collect() {
    var list = document.querySelectorAll(SEL), out = [], byHref = {};
    var vh = W.innerHeight, vw = W.innerWidth;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.disabled || el.id === '__ytosd') continue;
      var r = el.getBoundingClientRect();
      if (r.width < 12 || r.height < 12) continue;
      if (r.bottom < -vh || r.top > vh * 2 || r.right < 0 || r.left > vw) continue;
      if (closest(el, SKIP)) continue;
      var cs = W.getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      var href = el.tagName === 'A' ? el.getAttribute('href') : null;
      var item = { el: el, href: href, r: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } };
      if (href && href.charAt(0) === '/') {
        var o = byHref[href];
        if (o) {
          if (area(item.r) > area(o.r)) { out[out.indexOf(o)] = item; byHref[href] = item; }
          continue;
        }
        byHref[href] = item;
      }
      out.push(item);
    }
    return out;
  }

  // Chọn phần tử gần nhất theo hướng. cr: hình chữ nhật hiện tại; trả về item hoặc null
  function pick(cr, cands, dir, curEl) {
    var best = null, bs = 1e12;
    var cx = (cr.left + cr.right) / 2, cy = (cr.top + cr.bottom) / 2;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c.el === curEl) continue;
      var r = c.r;
      var x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
      var dx = x - cx, dy = y - cy, prim, gap, cen;
      if (dir === 'right' || dir === 'left') {
        if (dir === 'right' ? dx <= 4 : dx >= -4) continue;
        prim = Math.abs(dx);
        gap = Math.max(0, Math.max(cr.top, r.top) - Math.min(cr.bottom, r.bottom));
        cen = Math.abs(dy);
      } else {
        if (dir === 'down' ? dy <= 4 : dy >= -4) continue;
        prim = Math.abs(dy);
        gap = Math.max(0, Math.max(cr.left, r.left) - Math.min(cr.right, r.right));
        cen = Math.abs(dx);
      }
      var s = prim + gap * 3 + cen * 0.5;
      if (s < bs) { bs = s; best = c; }
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

  function setCur(el) {
    if (cur && cur.classList) cur.classList.remove('__yf');
    cur = el;
    if (el) {
      el.classList.add('__yf');
      var r = el.getBoundingClientRect(), vh = W.innerHeight, m = Math.min(120, vh * 0.15);
      if (r.top < m || r.bottom > vh - m) W.scrollBy(0, (r.top + r.bottom) / 2 - vh / 2);
    }
  }

  function inList(el, cands) {
    for (var i = 0; i < cands.length; i++) if (cands[i].el === el) return true;
    return false;
  }

  function move(dir, retried) {
    var cands = collect();
    if (!cur || !document.documentElement.contains(cur) || !inList(cur, cands)) {
      var f = firstOf(cands);
      if (f) setCur(f.el);
      return;
    }
    var best = pick(cur.getBoundingClientRect(), cands, dir, cur);
    if (best) { setCur(best.el); return; }
    if (dir === 'down' || dir === 'up') {
      var before = W.pageYOffset;
      W.scrollBy(0, (dir === 'down' ? 1 : -1) * W.innerHeight * 0.7);
      if (W.pageYOffset === before) {
        if (dir === 'up') bridge('focusBar');
        return;
      }
      if (!retried) setTimeout(function () { move(dir, true); }, 150);
    }
  }

  function ok() {
    var cands = collect();
    if (!cur || !document.documentElement.contains(cur) || !inList(cur, cands)) {
      var f = firstOf(cands);
      if (f) setCur(f.el);
      return;
    }
    var t = cur;
    if (t.tagName === 'A') lastHref = t.getAttribute('href');
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') { t.focus(); return; }
    if (t.click) t.click();
    else t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  // Chọn lại phần tử (theo href nếu có) khi trang vừa tải xong hoặc vừa quay lại từ trang xem
  function restoreSoon(href) {
    var n = 0;
    (function t() {
      var c = collect(), m = null, i;
      if (href) for (i = 0; i < c.length; i++) if (c[i].href === href) { m = c[i]; break; }
      if (m) { setCur(m.el); return; }
      if (c.length === 0 || href) {
        if (++n < 12) { setTimeout(t, 250); return; }
      }
      var f = firstOf(c);
      if (f) setCur(f.el);
    })();
  }

  // ---------- 7) Xem video toàn màn hình + điều khiển bằng remote ----------
  var fs = { on: false, v: null, key: '', tagged: [], hidden: [] };

  function enterFs(v, key) {
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
  function $(id) { return document.getElementById(id); }
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
  // Nút "Bỏ qua" quảng cáo của YouTube (bấm giúp người dùng, không chặn gì)
  function clickSkip() {
    var bs = document.querySelectorAll('.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,[class*="skip-button"]');
    for (var i = 0; i < bs.length; i++) {
      var r = bs[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { bs[i].click(); return true; }
    }
    return false;
  }
  function step(rc) { return rc < 3 ? 10 : (rc < 10 ? 30 : 60); }

  function watchKey(n, rc) {
    switch (n) {
      case 'ok': if (!clickSkip()) toggle(); break;
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

  // ---------- 8) Vòng lặp nền ----------
  function tick() {
    try {
      addCss();
      applyClasses();
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

  var lastVid = null, qTries = 0, capVid = null;
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
      if (qTries >= 4) return;
      var curQ = null;
      try { curQ = p.getPlaybackQuality && p.getPlaybackQuality(); } catch (e) {}
      if (curQ === C.q) { qTries = 4; return; }
      if (p.setPlaybackQualityRange) p.setPlaybackQualityRange(C.q);
      if (p.setPlaybackQuality) p.setPlaybackQuality(C.q);
      qTries++;
    } catch (e) {}
  }
  setInterval(applyQuality, 1200);

  // ---------- 9) API cho phần native ----------
  W.__yt480api = {
    key: function (name, rc) {
      try {
        if (fs.on) watchKey(name, rc || 0);
        else navKey(name);
      } catch (e) {}
    },
    setCfg: function (o) {
      merge(o);
      saveQuality();
      qTries = 0;
      try { applyClasses(); } catch (e) {}
    },
    // chọn phần tử đầu tiên nếu chưa có phần tử nào được chọn
    enter: function () {
      if (fs.on) return;
      try { if (isEditable(document.activeElement)) document.activeElement.blur(); } catch (e) {}
      var c = collect();
      if (!cur || !document.documentElement.contains(cur) || !inList(cur, c)) {
        var f = firstOf(c);
        if (f) setCur(f.el);
      }
    },
    autoFocus: function () {
      try { if (isEditable(document.activeElement)) document.activeElement.blur(); } catch (e) {}
      if (!fs.on) restoreSoon(null);
    },
    _t: { pick: pick, firstOf: firstOf, fmt: fmt }
  };
})();
