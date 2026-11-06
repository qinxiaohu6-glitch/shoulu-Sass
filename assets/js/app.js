/* AI Directory MVP — interactions
   Votes, submit wizard (free / paid tracks), dashboard and admin run on
   localStorage so the whole flow works from a static build. */
(function () {
  'use strict';

  var root = document.documentElement;
  var LANG = (document.body && document.body.dataset.lang) || 'en';
  var ROOTDIR = (document.body && document.body.dataset.root) || '';
  var ASSETROOT = (document.body && document.body.dataset.assetroot) || ROOTDIR;
  var ZH = LANG === 'zh';

  /* Plan keys are the ones the pricing page links to. "paid" is kept as an
     alias because older submissions stored it before the ladder grew a
     Standard tier; everything new uses the tier name itself. */
  var PLAN_ALIAS = { free: 'free', standard: 'standard', featured: 'featured', pro: 'pro', ad: 'ad', paid: 'featured' };
  var PLAN_PRICE = { free: '$0', standard: '$19', featured: '$39', pro: '$69', ad: '$29' };

  function planPrice(plan) {
    return PLAN_PRICE[plan] || '$0';
  }

  var S = {
    theme: 'dir-theme',
    user: 'dir-user',
    votes: 'dir-votes',
    subs: 'dir-submissions',
    orders: 'dir-orders',
    tools: 'dir-tool-overrides'
  };

  function store(key, val) {
    try {
      if (val === undefined) {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      }
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
    return null;
  }

  var I18N = {
    signinFirst: ZH ? '请先登录再投票' : 'Sign in to vote',
    voted: ZH ? '本周已投票' : 'Already voted this week',
    voteSaved: ZH ? '投票成功，票数已更新' : 'Vote counted',
    goSignin: ZH ? '去登录' : 'Sign in',
    fetching: ZH ? '正在读取页面…' : 'Reading the page…',
    fetched: ZH ? '已根据页面内容生成草稿，请核对后继续' : 'Draft created from the page — review and continue',
    dup: ZH ? '这个产品已经在目录里了，可在其页面查看。' : 'This product is already listed — open its page instead.',
    needUrl: ZH ? '请先填写产品链接' : 'Enter a product URL first',
    needFields: ZH ? '请填写名称、链接和一句话描述' : 'Name, URL and description are required',
    submitted: ZH ? '已提交，正在打开我的提交…' : 'Submitted — opening My submissions…',
    submitFailed: ZH ? '提交失败，请稍后再试' : 'Could not submit — please try again',
    paid: ZH ? '已记录，付款确认后立即上线' : 'Recorded — goes live once payment clears',
    approved: ZH ? '已通过审核，等待 Badge 验证' : 'Approved — waiting for badge verification',
    rejected: ZH ? '已拒绝' : 'Rejected',
    badgeOk: ZH ? 'Badge 验证通过，已正式展示' : 'Badge verified — listing is live',
    badgeFail: ZH ? '未检测到 Badge，请先在网站上放置链接' : 'Badge not found — add the link to your site first',
    empty: ZH ? '还没有提交记录。' : 'No submissions yet.',
    emptyQueue: ZH ? '审核队列是空的。' : 'The review queue is empty.',
    emptyOrders: ZH ? '还没有订单。' : 'No orders yet.',
    live: ZH ? '已上线' : 'Live',
    pending: ZH ? '待审核' : 'Pending review',
    badgeWait: ZH ? '待验证 Badge' : 'Badge pending',
    edit: ZH ? '编辑' : 'Edit',
    del: ZH ? '删除' : 'Delete',
    verify: ZH ? '验证 Badge' : 'Verify badge',
    approve: ZH ? '通过' : 'Approve',
    reject: ZH ? '拒绝' : 'Reject',
    signout: ZH ? '退出' : 'Sign out',
    dashboard: ZH ? '我的提交' : 'My submissions',
    signin: ZH ? '登录' : 'Sign In',
    subscribed: ZH ? '付费置顶 · 14 天' : 'Paid placement · 14 days',
    free: ZH ? '免费收录' : 'Free listing',
    pinned: ZH ? '置顶至' : 'Pinned until',
    days: ZH ? '天' : 'days',
    confirmDel: ZH ? '确定删除这条提交？' : 'Delete this submission?',
    needLogin: ZH ? '请先登录' : 'Please sign in first'
  };

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(n) {
    return Number(n || 0).toLocaleString(ZH ? 'zh-CN' : 'en-US');
  }
  // Local calendar date, not toISOString(): that one is UTC, so anyone east of
  // Greenwich submitting before 08:00 local time got yesterday's date.
  function isoDay(d) {
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function today() {
    return isoDay(new Date());
  }
  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return isoDay(d);
  }
  function weekId(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y = t.getUTCFullYear();
    var w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
    return y + '-W' + String(w).padStart(2, '0');
  }

  /* ------------------------------- toast -------------------------------- */
  var toastBox = null;
  function toast(msg, action) {
    if (!toastBox) {
      toastBox = el('<div class="toast-box"></div>');
      document.body.appendChild(toastBox);
    }
    var node = el('<div class="toast"><span>' + esc(msg) + '</span></div>');
    if (action) {
      var a = el('<a class="toast__act" href="' + action.href + '">' + esc(action.label) + '</a>');
      node.appendChild(a);
    }
    toastBox.appendChild(node);
    setTimeout(function () {
      node.classList.add('is-out');
      setTimeout(function () {
        node.remove();
      }, 220);
    }, 3200);
  }

  /* ------------------------------- theme -------------------------------- */
  function applyTheme(t) {
    root.classList.toggle('dark', t === 'dark');
    root.classList.toggle('light', t !== 'dark');
    root.style.colorScheme = t === 'dark' ? 'dark' : 'light';
  }
  applyTheme(store(S.theme) === 'dark' ? 'dark' : 'light');

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    var next = root.classList.contains('dark') ? 'light' : 'dark';
    store(S.theme, next);
    applyTheme(next);
  });

  /* -------------------------------- auth -------------------------------- */
  function user() {
    return store(S.user);
  }
  function syncAuth() {
    var u = user();
    document.querySelectorAll('[data-auth-label]').forEach(function (a) {
      if (u) {
        a.textContent = ZH ? '我的账户' : 'My account';
        a.setAttribute('href', ROOTDIR + 'settings/index.html');
      } else {
        a.textContent = I18N.signin;
        a.setAttribute('href', ROOTDIR + 'sign-in.html');
      }
    });
  }
  syncAuth();
  hydrateSession();

  /* ------------------------------- sign in ------------------------------ */
  function apiPost(path, body) {
    // Absolute. ROOTDIR is "" on both language trees, so a relative
    // "api/submit" from /zh/ resolved to /zh/api/submit and 404'd — the
    // Chinese site could not submit a product at all.
    var url = path.charAt(0) === '/' ? path : '/' + path;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () {
        return {};
      }).then(function (d) {
        d.__status = r.status;
        return d;
      });
    });
  }

  /* The cookie is the session; this is only the synchronous mirror that the
     rest of this file reads. It is refreshed from /api/me on every page. */
  function setUser(u) {
    if (u) {
      /* Google sends `picture`; the rest of this file already reads `avatar`. */
      if (u.picture && !u.avatar) u.avatar = u.picture;
      store(S.user, u);
    } else try { localStorage.removeItem(S.user); } catch (e) {}
    syncAuth();
    /* Pages that paint the account (settings) listen for this, because the
       session arrives asynchronously and they would otherwise stay blank. */
    try { document.dispatchEvent(new CustomEvent('user:change')); } catch (e) {}
  }

  function hydrateSession() {
    return fetch('/api/me', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) { setUser(d && d.user ? d.user : null); return d && d.user; })
      .catch(function () { return user(); });
  }

  /* A path the browser can navigate to (may start with ../ on /zh/ pages)
     versus a path the server can validate as a landing target. OAuth needs the
     latter: absolute-site, no leading ../, no scheme. */
  function siteRelative(href) {
    try {
      var u = new URL(href, location.href);
      return u.pathname.replace(/^\//, '') + u.search;
    } catch (e) {
      return 'index.html';
    }
  }

  function goGoogle(dest) {
    var target = siteRelative(dest || nextTarget());
    location.href = '/auth/google/start?next=' + encodeURIComponent(target);
  }

  /* ?next= and ?url= survive the round trip: the hero box parks the product
     URL here so nobody types their address twice. */
  function nextTarget() {
    var qs = new URLSearchParams(window.location.search);
    var next = qs.get('next') || '';
    var url = qs.get('url') || '';
    var safe = /^[a-z0-9][a-z0-9._\-\/]*\.html$/i.test(next);
    var dest = ROOTDIR + (safe ? next : 'settings/index.html');
    if (url) dest += (dest.indexOf('?') === -1 ? '?' : '&') + 'url=' + encodeURIComponent(url);
    return dest;
  }

  var signinGoogle = document.querySelector('[data-signin-google]');
  if (signinGoogle) {
    signinGoogle.addEventListener('click', function () { goGoogle(); });
  }

  /* The OAuth round trip lands back here with ?auth=<reason>. Say what
     happened — a button that silently does nothing again is the worst answer. */
  var authErr = document.querySelector('[data-auth-error]');
  if (authErr) {
    var authCode = new URLSearchParams(location.search).get('auth');
    var AUTH_MSG = {
      unconfigured: ZH ? 'Google 登录还没配置好：站点缺少 OAuth 客户端凭据。'
        : 'Google sign-in is not configured yet: the site has no OAuth client.',
      denied: ZH ? '你取消了 Google 授权。想继续的话再点一次。'
        : 'You cancelled the Google consent screen. Try again if you changed your mind.',
      failed: ZH ? 'Google 授权没走完，请再试一次。'
        : 'Google sign-in did not complete. Please try again.',
      bad_code: ZH ? '登录链接已过期或被用过一次，请重新点一次 Google 登录。'
        : 'That sign-in link expired or was already used. Start again with Google.'
    };
    if (authCode && AUTH_MSG[authCode]) {
      var why = new URLSearchParams(location.search).get('why');
      /* A specific `why` beats the generic "failed": "your link expired" is
         actionable, "sign-in did not complete" is not. */
      var key = (why && AUTH_MSG[why]) ? why : authCode;
      authErr.textContent = AUTH_MSG[key];
      if (why && !AUTH_MSG[why]) {
        /* Kept visible on purpose: when the owner is wiring this up, the
           difference between "cannot reach Google" and "Google refused the
           code" is the whole diagnosis. */
        var tag = document.createElement('span');
        tag.className = 'auth-note__code';
        tag.textContent = ' (' + why + ')';
        authErr.appendChild(tag);
      }
      authErr.hidden = false;
    }
  }

  /* ---------------------------- hero URL box ---------------------------- */
  var heroForm = document.querySelector('[data-hero-submit]');
  if (heroForm) {
    heroForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = heroForm.querySelector('[data-hero-url]');
      var raw = ((input && input.value) || '').trim();
      if (!raw) {
        if (input) input.focus();
        return;
      }
      if (user()) {
        window.location.href = ROOTDIR + 'submit.html?url=' + encodeURIComponent(raw);
        return;
      }
      var modal = document.querySelector('[data-auth-modal]');
      if (!modal) {
        window.location.href = ROOTDIR + 'sign-in.html?next=submit.html&url=' +
          encodeURIComponent(raw);
        return;
      }
      modal.setAttribute('data-next-url', raw);
      modal.hidden = false;
      document.body.classList.add('is-locked');
      var first = modal.querySelector('[name=email]');
      if (first) setTimeout(function () { first.focus(); }, 40);
    });
  }

  /* ---------------------------- auth modal ------------------------------ */
  var authModal = document.querySelector('[data-auth-modal]');
  if (authModal) {
    function closeAuth() {
      authModal.hidden = true;
      document.body.classList.remove('is-locked');
    }
    authModal.querySelectorAll('[data-auth-close]').forEach(function (b) {
      b.addEventListener('click', closeAuth);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !authModal.hidden) closeAuth();
    });
    function finishAuth() {
      /* Google is a top-level redirect, so the destination travels in `next`
         and comes back as a signed cookie — the URL the user typed is not lost
         on the way through Google. */
      var u = authModal.getAttribute('data-next-url') || '';
      goGoogle(ROOTDIR + 'submit.html' + (u ? '?url=' + encodeURIComponent(u) : ''));
    }
    var googleBtn = authModal.querySelector('[data-auth-google]');
    if (googleBtn) {
      googleBtn.addEventListener('click', finishAuth);
    }
  }

  /* -------------------------------- votes -------------------------------
     Votes live on the server now, one per signed-in account per ISO week.
     The previous version only wrote localStorage: the button lit up, the
     number moved by one, and the leaderboard never changed for anyone else —
     the page claimed to be ranked by votes it was not counting. */
  function voteState() {
    return store(S.votes) || {};
  }
  function hasVoted(slug, wk) {
    var v = voteState();
    return !!(v[slug] && v[slug][wk]);
  }
  function markVoted(slug, wk) {
    var v = voteState();
    v[slug] = v[slug] || {};
    v[slug][wk] = 1;
    store(S.votes, v);
  }
  function paintVotes() {
    var wk = weekId(new Date());
    document.querySelectorAll('[data-vote]').forEach(function (b) {
      var slug = b.getAttribute('data-vote');
      var voted = hasVoted(slug, wk);
      b.classList.toggle('is-voted', voted);
      b.setAttribute('aria-pressed', voted ? 'true' : 'false');
      var c = b.querySelector('[data-vote-count]');
      if (c) c.textContent = fmt(parseInt(b.getAttribute('data-count'), 10) || 0);
    });
  }
  function setVoteCount(slug, n) {
    document.querySelectorAll('[data-vote="' + slug + '"]').forEach(function (b) {
      b.setAttribute('data-count', String(n));
      var c = b.querySelector('[data-vote-count]');
      if (c) c.textContent = fmt(n);
    });
  }
  paintVotes();

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-vote]');
    if (!b) return;
    e.preventDefault();
    if (!user()) {
      toast(I18N.signinFirst, { href: ROOTDIR + 'sign-in.html', label: I18N.goSignin });
      return;
    }
    var slug = b.getAttribute('data-vote');
    var wk = weekId(new Date());
    if (hasVoted(slug, wk)) {
      toast(I18N.voted);
      return;
    }
    b.disabled = true;
    apiPost('/api/vote', { slug: slug, week: wk }).then(function (res) {
      b.disabled = false;
      if (!res || !res.ok) {
        if (res && res.reason === 'signin_required') {
          toast(I18N.signinFirst, { href: ROOTDIR + 'sign-in.html', label: I18N.goSignin });
        } else {
          toast(ZH ? '投票失败，请稍后再试' : 'Vote failed — try again');
        }
        return;
      }
      markVoted(slug, wk);
      setVoteCount(slug, res.votes);
      paintVotes();
      toast(res.accepted ? I18N.voteSaved : I18N.voted);
      sortBoard();
    }).catch(function () {
      b.disabled = false;
      toast(ZH ? '投票失败，请稍后再试' : 'Vote failed — try again');
    });
  });

  /* ---- weekly board: real counts, real order -------------------------- */
  var weekRoot = document.querySelector('[data-week]');

  function rowVotes(tr) {
    return parseInt(tr.getAttribute('data-live') || tr.getAttribute('data-base') || '0', 10) || 0;
  }

  function sortBoard() {
    if (!weekRoot) return;
    var tbody = weekRoot.querySelector('.week-panel.is-active tbody');
    if (!tbody) return;
    var ad = tbody.querySelector('.board-ad');
    if (ad) ad.parentNode.removeChild(ad);
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr[data-slug]'));
    rows.sort(function (a, b) { return rowVotes(b) - rowVotes(a); });
    rows.forEach(function (tr, i) {
      tbody.appendChild(tr);
      var n = tr.querySelector('.rank-num');
      if (n) n.textContent = String(i + 1);
      // Keep the paid row where the pricing page says it is: after the third.
      if (i === 2 && ad) tbody.appendChild(ad);
    });
    if (ad && rows.length <= 2) tbody.appendChild(ad);
  }

  function mergeVotes() {
    if (!weekRoot) return;
    var wk = weekRoot.getAttribute('data-week') || weekId(new Date());
    fetch('/api/votes?week=' + encodeURIComponent(wk),
          { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) return;
        var counts = d.counts || {};
        weekRoot.querySelectorAll('tr[data-slug]').forEach(function (tr) {
          var slug = tr.getAttribute('data-slug');
          var base = parseInt(tr.getAttribute('data-base'), 10) || 0;
          var live = base + (counts[slug] || 0);
          tr.setAttribute('data-live', String(live));
          var btn = tr.querySelector('[data-vote]');
          if (btn) btn.setAttribute('data-count', String(live));
        });
        sortBoard();
        paintVotes();
      })
      .catch(function () {});
  }
  mergeVotes();

  /* ------------------------------ search -------------------------------- */
  var searchRoot = document.getElementById('search-root');
  var searchInput = document.getElementById('search-input');
  var searchList = document.getElementById('search-results');
  var searchData = [];
  var activeIdx = 0;
  var lastFocus = null;

  var dataEl = document.getElementById('search-data');
  if (dataEl) {
    try {
      searchData = JSON.parse(dataEl.textContent);
    } catch (e) {
      searchData = [];
    }
  }

  function renderSearch(q) {
    if (!searchList) return;
    var query = (q || '').trim().toLowerCase();
    var items = searchData.filter(function (t) {
      if (!query) return t.featured;
      return (
        (t.name + ' ' + (t.alt || '')).toLowerCase().indexOf(query) > -1 ||
        t.desc.toLowerCase().indexOf(query) > -1 ||
        t.category.toLowerCase().indexOf(query) > -1 ||
        (t.tags || []).join(' ').toLowerCase().indexOf(query) > -1
      );
    });
    if (!items.length) {
      searchList.innerHTML = '<div class="modal__empty">' + (ZH ? '没有找到「' + esc(q) + '」' : 'No products found for “' + esc(q) + '”') + '</div>';
      return;
    }
    activeIdx = 0;
    var label = query
      ? (ZH ? items.length + ' 个结果' : items.length + ' result' + (items.length === 1 ? '' : 's'))
      : (ZH ? '精选产品' : 'Featured products');
    var html = '<div class="modal__label">' + label + '</div>';
    items.forEach(function (t, i) {
      html +=
        '<a class="modal__item' + (i === 0 ? ' is-active' : '') + '" href="' + t.url + '" data-idx="' + i + '">' +
        '<span class="tool-icon" style="width:40px;height:40px"><img src="' + t.icon + '" alt="" width="40" height="40"></span>' +
        '<span class="modal__item-body"><p>' + esc(t.name) + '<em>' + esc(t.category) + '</em></p><p>' + esc(t.desc) + '</p></span>' +
        '<span class="modal__enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg></span>' +
        '</a>';
    });
    searchList.innerHTML = html;
  }

  function openSearch() {
    if (!searchRoot) return;
    lastFocus = document.activeElement;
    searchRoot.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (searchInput) {
      searchInput.value = '';
      renderSearch('');
      setTimeout(function () {
        searchInput.focus();
      }, 20);
    }
  }
  function closeSearch() {
    if (!searchRoot) return;
    searchRoot.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-search-open]')) {
      e.preventDefault();
      openSearch();
    }
    if (e.target.closest('[data-search-close]')) closeSearch();
  });

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      renderSearch(searchInput.value);
    });
    searchInput.addEventListener('keydown', function (e) {
      var items = searchList ? searchList.querySelectorAll('.modal__item') : [];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        items[activeIdx] && items[activeIdx].classList.remove('is-active');
        activeIdx = (activeIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[activeIdx].classList.add('is-active');
        items[activeIdx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (items[activeIdx]) window.location.href = items[activeIdx].getAttribute('href');
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchRoot && searchRoot.classList.contains('is-open')) closeSearch();
      else openSearch();
    }
    if (e.key === 'Escape') {
      if (searchRoot && searchRoot.classList.contains('is-open')) closeSearch();
      closeDrawer();
      closePay();
    }
    if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) {
      e.preventDefault();
      openSearch();
    }
  });

  /* ------------------------------ drawer -------------------------------- */
  var drawerRoot = document.getElementById('drawer-root');
  function openDrawer() {
    if (!drawerRoot) return;
    drawerRoot.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!drawerRoot) return;
    drawerRoot.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-drawer-open]')) openDrawer();
    if (e.target.closest('[data-drawer-close]')) closeDrawer();
  });

  /* ----------------------------- accordion ------------------------------ */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.acc-trigger');
    if (!trigger) return;
    var item = trigger.closest('.acc-item');
    var open = item.classList.contains('is-open');
    item.classList.toggle('is-open', !open);
    trigger.setAttribute('aria-expanded', String(!open));
  });

  /* ------------------------------ gallery ------------------------------- */
  var gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    var imgs = JSON.parse(gallery.getAttribute('data-gallery') || '[]');
    var mainImg = gallery.querySelector('[data-gallery-main]');
    var counter = gallery.querySelector('[data-gallery-count]');
    var thumbs = gallery.querySelectorAll('[data-gallery-thumb]');
    var gidx = 0;
    function show(i) {
      gidx = (i + imgs.length) % imgs.length;
      if (mainImg) mainImg.src = imgs[gidx];
      if (counter) counter.textContent = gidx + 1 + ' / ' + imgs.length;
      thumbs.forEach(function (t, n) {
        t.classList.toggle('is-active', n === gidx);
      });
    }
    gallery.addEventListener('click', function (e) {
      if (e.target.closest('[data-gallery-prev]')) show(gidx - 1);
      if (e.target.closest('[data-gallery-next]')) show(gidx + 1);
      var thumb = e.target.closest('[data-gallery-thumb]');
      if (thumb) show(parseInt(thumb.getAttribute('data-gallery-thumb'), 10));
      if (e.target.closest('[data-gallery-zoom]')) window.open(imgs[gidx], '_blank');
    });
  }

  /* --------------------------- tools filtering -------------------------- */
  var toolsRoot = document.querySelector('[data-tools-page]');
  if (toolsRoot) {
    var cards = Array.prototype.slice.call(toolsRoot.querySelectorAll('[data-tool]'));
    var countEl = document.querySelector('[data-tool-count]');
    var sortEl = document.querySelector('[data-sort]');
    var pagerEl = document.querySelector('[data-pager]');
    var PER = 24;

    function params() {
      return new URLSearchParams(window.location.search);
    }
    function currentCat() {
      return params().get('category') || 'all';
    }
    function currentSort() {
      return params().get('sort') || 'featured';
    }
    function currentPage() {
      return Math.max(1, parseInt(params().get('page') || '1', 10) || 1);
    }
    // ?q= is what the WebSite/SearchAction urlTemplate sends people to
    function currentQ() {
      return (params().get('q') || '').trim().toLowerCase();
    }

    // Visible reminder of the active keyword filter, with a one-click reset.
    function paintQueryBar(q) {
      var bar = document.getElementById('tools-qbar');
      if (!q) {
        if (bar) bar.parentNode.removeChild(bar);
        return;
      }
      var toolbar = document.querySelector('.tools-toolbar');
      if (!toolbar) return;
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'tools-qbar';
        bar.className = 'tools-qbar';
        toolbar.parentNode.insertBefore(bar, toolbar.nextSibling);
      }
      var label = document.createElement('span');
      label.textContent = ZH ? '搜索结果：' : 'Search results for ';
      var b = document.createElement('b');
      b.textContent = params().get('q') || '';
      label.appendChild(b);
      var clear = document.createElement('a');
      clear.className = 'tools-qbar__x';
      clear.href = 'tools.html';
      clear.textContent = ZH ? '清除' : 'Clear';
      bar.innerHTML = '';
      bar.appendChild(label);
      bar.appendChild(clear);
    }

    function apply() {
      var cat = currentCat();
      var sort = currentSort();
      var page = currentPage();
      var q = currentQ();
      var terms = q ? q.split(/\s+/) : [];

      var list = cards.filter(function (c) {
        if (cat !== 'all' && c.getAttribute('data-category') !== cat) return false;
        if (!terms.length) return true;
        var hay = ((c.getAttribute('data-name') || '') + ' ' +
                   (c.getAttribute('data-category') || '') + ' ' +
                   (c.getAttribute('data-slug') || '') + ' ' +
                   (c.textContent || '')).toLowerCase();
        return terms.every(function (w) { return hay.indexOf(w) >= 0; });
      });

      list.sort(function (a, b) {
        if (sort === 'newest') {
          return (b.getAttribute('data-created') || '').localeCompare(a.getAttribute('data-created') || '');
        }
        if (sort === 'votes') {
          return (parseInt(b.getAttribute('data-votes'), 10) || 0) - (parseInt(a.getAttribute('data-votes'), 10) || 0);
        }
        var fa = a.getAttribute('data-featured') === '1' ? 0 : 1;
        var fb = b.getAttribute('data-featured') === '1' ? 0 : 1;
        if (fa !== fb) return fa - fb;
        return parseInt(a.getAttribute('data-order'), 10) - parseInt(b.getAttribute('data-order'), 10);
      });

      var pages = Math.max(1, Math.ceil(list.length / PER));
      if (page > pages) page = pages;
      var slice = list.slice((page - 1) * PER, page * PER);

      cards.forEach(function (c) {
        c.classList.add('hidden');
      });
      slice.forEach(function (c) {
        c.classList.remove('hidden');
        // Sorting the array is not enough: the cards keep their DOM positions,
        // so "Featured first" only decided *which* cards showed, never their
        // order — a paid pin never actually moved up. Re-append to reorder.
        toolsRoot.appendChild(c);
      });

      paintQueryBar(q);

      if (countEl) {
        var raw = params().get('q') || '';
        if (q) {
          countEl.textContent = ZH
            ? '「' + raw + '」找到 ' + list.length + ' 个产品'
            : list.length + ' result' + (list.length === 1 ? '' : 's') + ' for “' + raw + '”';
        } else {
          countEl.textContent = ZH
            ? (cat === 'all' ? '共 ' : '') + list.length + ' 个产品'
            : (cat === 'all' ? 'All ' : '') + list.length + ' products';
        }
      }

      if (pagerEl) {
        var qs = function (p) {
          var q = params();
          q.set('page', String(p));
          return '?' + q.toString();
        };
        var html = '';
        html +=
          '<a class="page-btn' + (page === 1 ? ' is-disabled' : '') + '" href="' + qs(page - 1) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"></path></svg>' +
          '<span>' + (ZH ? '上一页' : 'Previous') + '</span></a>';
        for (var p = 1; p <= pages; p++) {
          html += '<a class="page-num' + (p === page ? ' is-active' : '') + '" href="' + qs(p) + '">' + p + '</a>';
        }
        html +=
          '<a class="page-btn' + (page === pages ? ' is-disabled' : '') + '" href="' + qs(page + 1) + '">' +
          '<span>' + (ZH ? '下一页' : 'Next') + '</span>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"></path></svg></a>';
        pagerEl.innerHTML = html;
      }
      if (sortEl) sortEl.value = sort;
    }

    if (sortEl) {
      sortEl.addEventListener('change', function () {
        var q = params();
        q.set('sort', sortEl.value);
        q.delete('page');
        window.location.search = q.toString();
      });
    }
    apply();
  }

  /* ---------------------------- weekly tabs ----------------------------- */
  var weekTabs = document.querySelectorAll('[data-week-tab]');
  var weeksData = [];
  var wdEl = document.getElementById('weeks-data');
  if (wdEl) {
    try {
      weeksData = JSON.parse(wdEl.textContent);
    } catch (e) {}
  }

  function renderWeekPanel(idx) {
    var panel = document.querySelector('[data-week-panel="' + idx + '"]');
    if (!panel || panel.innerHTML.trim()) return;
    var w = weeksData[idx - 1];
    if (!w) return;
    var head = '<tr><th>#</th><th>' + (ZH ? '产品' : 'Product') + '</th><th>' + (ZH ? '分类' : 'Categories') +
      '</th><th>' + (ZH ? '变化' : 'Change') + '</th><th>' + (ZH ? '本周票数' : 'Votes') + '</th></tr>';
    var rows = w.rows.map(function (r) {
      var mv = r.m === 'new' ? '<span class="rank-move is-new">NEW</span>'
        : r.m === 'up' ? '<span class="rank-move is-up">\u25b2' + r.x + '</span>'
        : r.m === 'down' ? '<span class="rank-move is-down">\u25bc' + r.x + '</span>'
        : '<span class="rank-move">\u2014</span>';
      return '<tr><td class="rank-num">' + r.r + '</td>' +
        '<td><a class="rank-tool" href="' + ROOTDIR + 'tools/' + r.s + '.html">' +
        '<span class="tool-icon" style="width:32px;height:32px"><img src="' + ASSETROOT +
        'assets/img/icons/' + r.s + '.png" alt="" width="32" height="32" loading="lazy"></span>' +
        '<span><strong>' + esc(r.n) + '</strong><em>' + esc(r.d) + '</em></span></a></td>' +
        '<td class="rank-cat"><span class="chip">' + esc(r.c) + '</span></td>' +
        '<td class="rank-move-cell">' + mv + '</td>' +
        '<td class="rank-votes"><span class="vote vote--sm is-static">' +
        '<svg class="ic"><use href="#i-arrow-up"/></svg><span>' + fmt(r.v) + '</span></span></td></tr>';
    }).join('');
    panel.innerHTML = '<table class="rank-table"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table>';
  }

  if (weekTabs.length) {
    weekTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var i = tab.getAttribute('data-week-tab');
        weekTabs.forEach(function (o) {
          o.classList.toggle('is-active', o === tab);
          o.setAttribute('aria-selected', o === tab ? 'true' : 'false');
        });
        document.querySelectorAll('[data-week-panel]').forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-week-panel') === i);
        });
        renderWeekPanel(i);
      });
    });
  }

  /* ---------------------------- submit wizard --------------------------- */
  var submitRoot = document.querySelector('[data-submit]');
  var catalog = [];
  var catEl = document.getElementById('catalog-data');
  if (catEl) {
    try {
      catalog = JSON.parse(catEl.textContent);
    } catch (e) {}
  }

  function openPay(which) {
    var m = document.getElementById('pay-root');
    if (!m) return;
    // The amount lives on the plan card, not in the markup: the modal used to
    // hard-code $19.00, so a $29 Featured and a $99 Pro both checked out at
    // the old price the moment we changed the pricing page.
    var card = document.querySelector('[data-plan="' + (which || 'paid') + '"]');
    if (card) {
      var amt = card.getAttribute('data-amount') || '0.00';
      var lab = card.getAttribute('data-label') || '';
      var set = function (sel, txt) {
        var n = m.querySelector(sel);
        if (n) n.textContent = txt;
      };
      set('[data-pay-plan]', lab);
      set('[data-pay-amount]', '$' + amt);
    }
    m.classList.add('is-open');
  }
  function closePay() {
    var m = document.getElementById('pay-root');
    if (m) m.classList.remove('is-open');
  }

  if (submitRoot) {
    var steps = submitRoot.querySelectorAll('.submit-step');
    var indicators = submitRoot.querySelectorAll('[data-step-indicator]');
    var urlInput = submitRoot.querySelector('[data-url-input]');
    var fetchBtn = submitRoot.querySelector('[data-fetch]');
    var noteEl = submitRoot.querySelector('[data-fetch-note]');
    var fields = {};
    submitRoot.querySelectorAll('[data-f]').forEach(function (i) {
      fields[i.getAttribute('data-f')] = i;
    });
    var plan = 'free';
    var currentStep = 1;
    var editingId = null;

    // ?plan=… — pricing hands the chosen tier straight to the form. Without
    // this, "Go live now" and "Book this spot" both landed on a form that had
    // quietly reset to Free, and the visitor never noticed they had been
    // downgraded until the listing showed up in the review queue.
    var planParam = '';
    try { planParam = new URLSearchParams(location.search).get('plan') || ''; } catch (e) { /* no URL API */ }
    plan = PLAN_ALIAS[planParam] || 'free';
    // Once the ad option is on screen it stays there, even if the visitor
    // changes their mind and then changes it back.
    var adMode = plan === 'ad';

    function paintPlans() {
      submitRoot.querySelectorAll('[data-plan]').forEach(function (o) {
        var v = o.getAttribute('data-plan');
        if (v === 'ad') o.hidden = !adMode;
        o.setAttribute('aria-pressed', v === plan ? 'true' : 'false');
      });
    }
    paintPlans();

    // ?url=… prefill — the SEO check and the hero URL box both hand a URL
    // straight to the form. When it arrives this way we run the prefill fetch
    // immediately: the visitor already told us the address, so asking them to
    // press "Fetch" would be asking twice.
    var handoffUrl = '';
    try {
      var pre = new URLSearchParams(location.search).get('url');
      if (pre && urlInput && !urlInput.value) {
        urlInput.value = pre;
        handoffUrl = pre;
      }
    } catch (e) { /* older browsers: no prefill, no harm */ }

    function gotoStep(n) {
      currentStep = n;
      steps.forEach(function (s) {
        s.classList.toggle('is-active', s.getAttribute('data-step') === String(n));
      });
      indicators.forEach(function (s, i) {
        s.classList.toggle('is-active', i + 1 === n);
        s.classList.toggle('is-done', i + 1 < n);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function slugify(s) {
      return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    function guessCategory(text) {
      var map = [
        ['chat|assistant|gpt|llm', 'chatbots'],
        ['code|developer|ide|repo|programming', 'coding'],
        ['image|photo|art|design|illustration', 'image'],
        ['video|film|clip|avatar', 'video'],
        ['voice|audio|music|speech|podcast', 'audio'],
        ['write|copy|blog|grammar', 'writing'],
        ['meeting|note|slide|presentation|productivity', 'productivity'],
        ['search|research|paper|cite', 'research']
      ];
      var low = (text || '').toLowerCase();
      for (var i = 0; i < map.length; i++) {
        if (new RegExp(map[i][0]).test(low)) return map[i][1];
      }
      return 'chatbots';
    }

    fetchBtn.addEventListener('click', function () {
      var raw = (urlInput.value || '').trim();
      if (!raw) {
        toast(I18N.needUrl);
        return;
      }
      if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
      urlInput.value = raw;

      var host = '';
      try {
        host = new URL(raw).hostname.replace(/^www\./, '');
      } catch (e) {
        host = raw;
      }
      var bare = host.split('.')[0];

      var hit = catalog.filter(function (c) {
        return c.domain === host || c.domain.split('.')[0] === bare;
      })[0];

      if (noteEl) {
        noteEl.hidden = false;
        noteEl.textContent = I18N.fetching;
      }
      fetchBtn.disabled = true;

      setTimeout(function () {
        fetchBtn.disabled = false;
        if (hit) {
          if (noteEl) noteEl.textContent = I18N.dup;
          fields.name.value = hit.name;
          fields.url.value = 'https://' + hit.domain;
          fields.short.value = hit.desc;
          fields.long.value = hit.long || '';
          fields.category.value = hit.category;
          fields.logo.value = hit.logo || '';
          submitRoot.querySelectorAll('.tag-check input').forEach(function (cb) {
            cb.checked = (hit.tags || []).indexOf(cb.value) > -1;
          });
          toast(I18N.dup, { href: ROOTDIR + 'tools/' + hit.slug + '.html', label: ZH ? '查看' : 'Open' });
        } else {
          var name = bare.replace(/[-_]/g, ' ').replace(/\b\w/g, function (m) {
            return m.toUpperCase();
          });
          fields.name.value = name;
          fields.url.value = raw;
          fields.short.value = ZH
            ? name + '：面向团队的产品（自动生成的草稿，请修改）。'
            : name + ' — a product for teams (auto-generated draft, please edit).';
          fields.long.value = ZH
            ? '我们从 ' + host + ' 的页面提取了以下信息作为草稿。请补充它解决什么问题、谁在用，以及与其他产品的区别。'
            : 'We pulled this draft from the page at ' + host + '. Add what it solves, who uses it, and how it differs from alternatives.';
          fields.category.value = guessCategory(host + ' ' + name);
          fields.logo.value = 'https://www.google.com/s2/favicons?domain=' + host + '&sz=128';
          if (noteEl) noteEl.textContent = I18N.fetched;
        }
        gotoStep(2);
      }, 900);
    });

    // A URL handed over from the hero box or the SEO check runs the fetch by
    // itself, so the visitor lands on step 2 with the fields already filled.
    if (handoffUrl && fetchBtn) {
      setTimeout(function () { fetchBtn.click(); }, 120);
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-next]')) {
        if (!fields.name.value.trim() || !fields.url.value.trim() || !fields.short.value.trim()) {
          toast(I18N.needFields);
          return;
        }
        gotoStep(3);
      }
      if (e.target.closest('[data-back]')) gotoStep(Math.max(1, currentStep - 1));

      var p = e.target.closest('[data-plan]');
      if (p) {
        plan = p.getAttribute('data-plan');
        paintPlans();
      }

      if (e.target.closest('[data-publish]')) {
        if (!user()) {
          toast(I18N.needLogin, { href: ROOTDIR + 'sign-in.html', label: I18N.goSignin });
          return;
        }
        if (plan !== 'free' && plan !== 'ad') {
          openPay(plan);
        } else {
          saveSubmission('pending');
        }
      }
      if (e.target.closest('[data-pay-close]')) closePay();
      if (e.target.closest('[data-pay-confirm]')) {
        closePay();
        // No payment gateway is wired up, so this records a paid *intent*:
        // the server stores it as awaiting payment and the listing goes live
        // when the owner confirms. Saying "published" here would be a lie.
        saveSubmission('pending');
      }
    });

    function saveSubmission(status) {
      var tags = [];
      submitRoot.querySelectorAll('.tag-check input:checked').forEach(function (cb) {
        tags.push(cb.value);
      });
      var payload = {
        name: fields.name.value.trim(),
        url: fields.url.value.trim(),
        short: fields.short.value.trim(),
        long: fields.long.value.trim(),
        category: fields.category.value,
        logo: fields.logo.value.trim(),
        tags: tags,
        plan: plan
      };
      var me = user();
      if (me && me.email) payload.email = me.email;

      // Editing has to reach the server too. The old version only rewrote the
      // local copy: the page said "saved", the listing on the site never
      // changed, and the next browser showed the old text.
      if (editingId) {
        var btnE = submitRoot.querySelector('[data-publish]');
        if (btnE) btnE.disabled = true;
        apiPost('/api/my/submissions/update', {
          id: editingId,
          name: payload.name,
          short: payload.short,
          long: payload.long,
          category: payload.category,
          logo: payload.logo,
          tags: payload.tags
        }).then(function (res) {
          if (btnE) btnE.disabled = false;
          if (!res || !res.ok) {
            var why = res && res.reason === 'signin_required'
              ? (ZH ? '登录后才能修改' : 'Sign in to edit')
              : (ZH ? '保存失败，请重试' : 'Save failed — try again');
            toast(why);
            return;
          }
          // Keep the local mirror in step so the list does not show stale text.
          var subs = store(S.subs) || [];
          subs = subs.map(function (s) {
            if (s.id !== editingId) return s;
            s.name = payload.name;
            s.short = payload.short;
            s.long = payload.long;
            s.category = payload.category;
            s.logo = payload.logo;
            s.tags = payload.tags;
            s.status = res.item && res.item.status ? res.item.status : s.status;
            return s;
          });
          store(S.subs, subs);
          toast(ZH ? '已保存，修改会重新审核' : 'Saved — edits go back through review');
          setTimeout(function () {
            window.location.href = ROOTDIR + 'settings/submissions.html';
          }, 700);
        }).catch(function () {
          if (btnE) btnE.disabled = false;
          toast(ZH ? '保存失败，请重试' : 'Save failed — try again');
        });
        return;
      }

      var publishBtn = submitRoot.querySelector('[data-publish]');
      if (publishBtn) publishBtn.disabled = true;

      apiPost('/api/submit', payload).then(function (res) {
        if (publishBtn) publishBtn.disabled = false;
        if (!res.ok) {
          var msg = (ZH ? res.message_zh : res.message_en) || I18N.submitFailed;
          if (res.reason === 'already_listed' || res.reason === 'duplicate') {
            toast(msg, { href: ROOTDIR + 'tools.html', label: ZH ? '看目录' : 'Browse' });
          } else {
            toast(msg);
          }
          if (res.field) {
            var el = submitRoot.querySelector('[data-f="' + res.field + '"]');
            if (el) {
              el.focus();
              el.classList.add('is-invalid');
              setTimeout(function () { el.classList.remove('is-invalid'); }, 2600);
            }
          }
          return;
        }
        // Mirror it locally so "My submissions" can show it without a login.
        var subs = store(S.subs) || [];
        subs.unshift({
          id: res.id,
          name: payload.name,
          url: payload.url,
          short: payload.short,
          long: payload.long,
          category: payload.category,
          logo: payload.logo,
          tags: payload.tags,
          plan: payload.plan,
          status: res.status === 'approved' ? 'live' : 'pending',
          badge: false,
          created: today(),
          server: true
        });
        store(S.subs, subs);

        var orderBit = res.id
          ? (ZH ? '订单号 ' + res.id + '。' : 'Order ' + res.id + '. ')
          : '';
        var nextBit = res.next === 'paid'
          ? (ZH
            ? '订单已提交。请在 7 天内按确认页的方式付款；付款确认后当天上线（人工确认收款）。'
            : 'Order received. Pay within 7 days the way the confirmation describes. It goes live the same day payment is confirmed (we confirm receipt by hand). ')
          : (ZH
            ? '已提交，进入人工审核，通常 7–14 天，不保证；高峰可能更长。'
            : 'Submitted for review — usually 7–14 days, not guaranteed; busy periods can take longer. ');
        var mailBit = ZH
          ? '邮件通知需站长开启；未开启时请在「我的提交」查看进度。'
          : 'Email notices are sent only after the site owner turns them on. Until then, check My submissions.';
        toast(orderBit + nextBit + mailBit);
        setTimeout(function () {
          window.location.href = ROOTDIR + 'settings/submissions.html';
        }, 2800);
      }).catch(function () {
        if (publishBtn) publishBtn.disabled = false;
        toast(I18N.submitFailed);
      });
    }

    /* prefill when editing */
    var editId = new URLSearchParams(window.location.search).get('edit');
    if (editId) {
      var found = (store(S.subs) || []).filter(function (s) {
        return s.id === editId;
      })[0];
      if (found) {
        editingId = found.id;
        plan = found.plan;
        fields.name.value = found.name;
        fields.url.value = found.url;
        fields.short.value = found.short;
        fields.long.value = found.long || '';
        fields.category.value = found.category;
        fields.logo.value = found.logo || '';
        submitRoot.querySelectorAll('.tag-check input').forEach(function (cb) {
          cb.checked = (found.tags || []).indexOf(cb.value) > -1;
        });
        submitRoot.querySelectorAll('[data-plan]').forEach(function (o) {
          o.setAttribute('aria-pressed', o.getAttribute('data-plan') === plan ? 'true' : 'false');
        });
        gotoStep(2);
      }
    }
  }

  /* ----------------------------- dashboard ------------------------------ */
  var dashList = document.querySelector('[data-dash-list]');
  if (dashList) {
    var STATUS = {
      pending: { cls: 'status--pending', label: I18N.pending },
      badge: { cls: 'status--pending', label: I18N.badgeWait },
      live: { cls: 'status--approved', label: I18N.live },
      rejected: { cls: 'status--rejected', label: I18N.rejected }
    };

    /* Once signed in, the server is the source of truth: submissions are tied
       to the Google account, so they follow the person to another browser.
       The local mirror stays as the fallback for anonymous submits. */
    var serverSubs = null;

    function fmtDay(ts) {
      if (!ts) return '';
      var d = new Date(ts * 1000);
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) +
        '-' + ('0' + d.getDate()).slice(-2);
    }

    function mapServer(rec) {
      return {
        id: rec.id,
        name: rec.name,
        url: rec.url,
        category: rec.category,
        plan: PLAN_ALIAS[rec.plan] || 'free',
        status: rec.status === 'approved' ? 'live'
          : (rec.status === 'rejected' ? 'rejected' : 'pending'),
        created: fmtDay(rec.created_at),
        server: true
      };
    }

    function renderDash() {
      var subs = serverSubs || store(S.subs) || [];
      var stats = document.querySelector('[data-dash-stats]');
      if (stats) {
        var counts = { total: subs.length, pending: 0, live: 0, rejected: 0 };
        subs.forEach(function (s) {
          if (s.status === 'pending' || s.status === 'badge') counts.pending++;
          else if (s.status === 'live') counts.live++;
          else counts.rejected++;
        });
        stats.innerHTML = [
          [ZH ? '全部提交' : 'Submissions', counts.total],
          [ZH ? '待处理' : 'In review', counts.pending],
          [ZH ? '已上线' : 'Live', counts.live],
          [ZH ? '未通过' : 'Rejected', counts.rejected]
        ].map(function (r) {
          return '<div class="stat-card"><span>' + r[0] + '</span><strong>' + r[1] + '</strong></div>';
        }).join('');
      }

      if (!subs.length) {
        dashList.innerHTML = '<div class="empty-state">' + I18N.empty +
          ' <a href="' + ROOTDIR + 'submit.html">' + (ZH ? '提交第一个产品' : 'Submit your first product') + '</a></div>';
        return;
      }

      var rows = subs.map(function (s) {
        var st = STATUS[s.status] || STATUS.pending;
        var extra = s.featuredUntil && s.status === 'live'
          ? '<em class="dash-cat">' + I18N.pinned + ' ' + s.featuredUntil + '</em>'
          : '';
        return '<tr data-id="' + s.id + '">' +
          '<td><span class="dash-name">' + esc(s.name) + '</span><em class="dash-cat">' + esc(s.category) +
          ' · ' + planPrice(s.plan) + '</em>' + extra + '</td>' +
          '<td><span class="status ' + st.cls + '">' + st.label + '</span></td>' +
          '<td class="dash-date">' + esc(s.created) + '</td>' +
          '<td class="dash-actions">' +
          (s.server ? '' :
            (s.status === 'badge' ? '<button class="btn btn--ghost btn--sm" type="button" data-act="badge">' + I18N.verify + '</button>' : '') +
            '<button class="btn btn--ghost btn--sm" type="button" data-act="edit">' + I18N.edit + '</button>' +
            '<button class="btn btn--ghost btn--sm" type="button" data-act="delete">' + I18N.del + '</button>') +
          '</td></tr>';
      }).join('');

      dashList.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>' +
        (ZH ? '产品' : 'Product') + '</th><th>' + (ZH ? '状态' : 'Status') + '</th><th>' +
        (ZH ? '提交时间' : 'Submitted') + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    dashList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var tr = btn.closest('tr');
      var id = tr.getAttribute('data-id');
      var subs = store(S.subs) || [];
      var act = btn.getAttribute('data-act');

      if (act === 'delete') {
        if (!window.confirm(I18N.confirmDel)) return;
        store(S.subs, subs.filter(function (s) {
          return s.id !== id;
        }));
        renderDash();
      }
      if (act === 'edit') {
        window.location.href = ROOTDIR + 'submit.html?edit=' + id;
      }
      if (act === 'badge') {
        var ok = Math.random() > 0.35;
        if (ok) {
          store(S.subs, subs.map(function (s) {
            if (s.id === id) {
              s.status = 'live';
              s.badge = true;
            }
            return s;
          }));
          toast(I18N.badgeOk);
        } else {
          toast(I18N.badgeFail);
        }
        renderDash();
      }
    });

    renderDash();
    if (user()) {
      fetch('/api/my/submissions', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok && d.items) {
            serverSubs = d.items.map(mapServer);
            renderDash();
          }
        })
        .catch(function () {});
    }
  }

  /* -------------------------------- admin ------------------------------- */
  var reviewBox = document.querySelector('[data-review-queue]');
  if (reviewBox) {
    var STATUS_A = {
      pending: { cls: 'status--pending', label: I18N.pending },
      badge: { cls: 'status--pending', label: I18N.badgeWait },
      live: { cls: 'status--approved', label: I18N.live },
      rejected: { cls: 'status--rejected', label: I18N.rejected }
    };

    function dayOf(ts) {
      if (!ts) return '';
      var d = new Date(ts * 1000);
      return d.getFullYear() + '-' +
        ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }

    // "How much do I invoice this one" is the only reason the number is on the
    // row at all — so it reads the same table the pricing page is built from.
    function planAmount(s) {
      return planPrice(PLAN_ALIAS[s.plan] || s.plan);
    }

    function table(headers, rows, empty) {
      if (!rows.length) return '<div class="empty-state">' + empty + '</div>';
      return '<div class="table-wrap"><table class="data-table"><thead><tr>' +
        headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
        '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
    }

    function renderAdmin() {
      var stats = document.querySelector('[data-admin-stats]');
      var ordersBox = document.querySelector('[data-orders]');
      reviewBox.innerHTML = '<div class="empty-state">' +
        (ZH ? '加载中…' : 'Loading…') + '</div>';

      fetch('/api/admin/submissions', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok) {
            reviewBox.innerHTML = '<div class="empty-state">' +
              (ZH ? '读不到提交记录，请重新用令牌打开后台。'
                  : 'Could not load submissions — reopen the console with your token.') +
              '</div>';
            if (ordersBox) ordersBox.innerHTML = '';
            return;
          }
          var items = d.items || [];
          var st = d.stats || {};

          if (stats) {
            stats.innerHTML = [
              [ZH ? '待审核' : 'In review', st.pending || 0],
              [ZH ? '已上线' : 'Live listings', st.approved || 0],
              [ZH ? '待付款' : 'Awaiting payment', st.awaiting_payment || 0],
              [ZH ? '累计提交' : 'Total', st.total || 0]
            ].map(function (r) {
              return '<div class="stat-card"><span>' + r[0] + '</span><strong>' + r[1] + '</strong></div>';
            }).join('');
          }

          var queue = items.filter(function (s) { return s.status === 'pending'; });
          reviewBox.innerHTML = table(
            [ZH ? '提交' : 'Submission', ZH ? '套餐' : 'Plan',
             ZH ? '提交时间' : 'Submitted', ''],
            queue.map(function (s) {
              return '<tr data-id="' + esc(s.id) + '">' +
                '<td><span class="dash-name">' + esc(s.name) + '</span>' +
                '<em class="dash-cat">' + esc(s.domain || s.url) + '</em></td>' +
                '<td>' + (s.plan && s.plan !== 'free'
                  ? planAmount(s) + (s.awaiting_payment ? ' · ' + (ZH ? '待付款' : 'unpaid') : '')
                  : '$0') + '</td>' +
                '<td>' + dayOf(s.created_at) + '</td>' +
                '<td class="dash-actions">' +
                (function () {
                  var unpaid = !s.paid_at && (s.awaiting_payment || (s.plan && s.plan !== 'free'));
                  if (!unpaid) {
                    return '<button class="btn btn--ghost btn--sm" type="button" data-r="approve">' + I18N.approve + '</button>';
                  }
                  var why = ZH ? '须先确认收款，不能直接通过' : 'Confirm payment before this can go live';
                  return '<button class="btn btn--ghost btn--sm" type="button" disabled title="' + esc(why) + '">' +
                    (ZH ? '须先确认收款' : 'Payment required') + '</button>';
                })() +
                '<button class="btn btn--ghost btn--sm" type="button" data-r="reject">' + I18N.reject + '</button>' +
                '</td></tr>';
            }),
            I18N.emptyQueue);

          if (ordersBox) {
            var unpaid = items.filter(function (s) {
              return s.awaiting_payment && !s.paid_at && s.status !== 'rejected';
            });
            ordersBox.innerHTML = table(
              [ZH ? '产品' : 'Product', ZH ? '金额' : 'Amount',
               ZH ? '提交时间' : 'Submitted', ''],
              unpaid.map(function (s) {
                return '<tr data-id="' + esc(s.id) + '">' +
                  '<td><span class="dash-name">' + esc(s.name) + '</span>' +
                  '<em class="dash-cat">' + esc(s.domain || s.url) + '</em></td>' +
                  '<td>' + planAmount(s) + '</td><td>' + dayOf(s.created_at) + '</td>' +
                  '<td class="dash-actions">' +
                  '<button class="btn btn--ghost btn--sm" type="button" data-r="payment">' +
                  (ZH ? '确认付款并上线' : 'Mark paid &amp; publish') + '</button>' +
                  '</td></tr>';
              }),
              ZH ? '没有待付款的提交。' : 'No unpaid placements.');
          }
        })
        .catch(function () {
          reviewBox.innerHTML = '<div class="empty-state">' +
            (ZH ? '读取失败。' : 'Failed to load.') + '</div>';
        });
    }

    function reviewAction(id, act) {
      var body = { id: id, action: act };
      if (act === 'reject') {
        var note = window.prompt(ZH ? '拒绝原因（可选）' : 'Reason (optional)', '');
        if (note === null) return;
        body.notes = note;
      }
      apiPost('/api/admin/review', body).then(function (res) {
        if (!res.ok) {
          toast((ZH ? res.message_zh : res.message_en) || (ZH ? '操作失败' : 'Action failed'));
          return;
        }
        if (act === 'approve') toast(I18N.approved);
        else if (act === 'reject') toast(I18N.rejected);
        else toast(ZH ? '已确认付款，条目已上线' : 'Payment confirmed — listing is live');
        renderAdmin();
      }).catch(function () {
        toast(ZH ? '操作失败' : 'Action failed');
      });
    }

    reviewBox.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-r]');
      if (!btn || btn.disabled) return;
      var tr = btn.closest('tr');
      reviewAction(tr.getAttribute('data-id'), btn.getAttribute('data-r'));
    });

    var ordersRoot = document.querySelector('[data-orders]');
    if (ordersRoot) {
      ordersRoot.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-r]');
        if (!btn) return;
        reviewAction(btn.closest('tr').getAttribute('data-id'), btn.getAttribute('data-r'));
      });
    }

    // Both of these used to be client-only: the switch wrote localStorage and
    // the unpublish button greyed out its own row. Now they hit the server,
    // and the copy says what actually happens (lists are static, so a pin
    // lands on the next build; a hidden page 410s immediately).
    function toolAction(slug, action, until) {
      return apiPost('/api/admin/tool',
                     { slug: slug, action: action, until: until || '' });
    }

    document.querySelectorAll('[data-toggle-featured]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var slug = cb.closest('tr').getAttribute('data-admin-tool');
        var want = cb.checked;
        toolAction(slug, want ? 'pin' : 'unpin').then(function (res) {
          if (!res || !res.ok) {
            cb.checked = !want;
            toast(ZH ? '操作失败' : 'Failed');
            return;
          }
          toast(want
            ? (ZH ? '已置顶，下次构建生效' : 'Pinned — applies on the next build')
            : (ZH ? '已取消置顶，下次构建生效' : 'Unpinned — applies on the next build'));
        }).catch(function () {
          cb.checked = !want;
          toast(ZH ? '操作失败' : 'Failed');
        });
      });
    });

    document.querySelectorAll('[data-unpublish]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var slug = tr.getAttribute('data-admin-tool');
        toolAction(slug, 'hide').then(function (res) {
          if (!res || !res.ok) {
            toast(ZH ? '操作失败' : 'Failed');
            return;
          }
          tr.style.opacity = '0.45';
          btn.disabled = true;
          btn.textContent = ZH ? '已下架' : 'Unpublished';
          toast(ZH ? '已下架，详情页现在返回 410' : 'Unpublished — the page now returns 410');
        }).catch(function () { toast(ZH ? '操作失败' : 'Failed'); });
      });
    });

    /* ---- weekly ad slots ------------------------------------------------
       Ads are the one thing on the site that must change without a rebuild:
       a booking taken this afternoon has to be live this afternoon. They are
       stored in data/ads.json and spliced into the page at request time, so
       this form writes the record and the site picks it up on the next hit. */
    var adForm = document.querySelector('[data-ad-form]');
    var adList = document.querySelector('[data-ad-list]');

    function renderAds() {
      if (!adList) return;
      adList.innerHTML = '<div class="empty-state">' +
        (ZH ? '加载中…' : 'Loading…') + '</div>';
      fetch('/api/admin/ads', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok) { adList.innerHTML = ''; return; }
          var items = d.items || [];
          adList.innerHTML = table(
            [ZH ? '位置' : 'Slot', ZH ? '广告' : 'Ad', ZH ? '起止' : 'Window',
             ZH ? '状态' : 'Status', ''],
            items.map(function (a) {
              var slot = a.slot === 'board'
                ? (ZH ? '榜单位' : 'Board') : (ZH ? '侧栏位' : 'Sidebar');
              var state = a.live
                ? '<span class="chip chip--paid">' + (ZH ? '展示中' : 'Live') + '</span>'
                : '<span class="chip">' + (a.active
                  ? (ZH ? '未开始 / 已过期' : 'Scheduled / ended')
                  : (ZH ? '已停止' : 'Stopped')) + '</span>';
              return '<tr data-ad="' + esc(a.id) + '">' +
                '<td>' + esc(slot) + '</td>' +
                '<td><span class="dash-name">' + esc(a.name) + '</span>' +
                '<em class="dash-cat">' + esc(a.headline) + '</em></td>' +
                '<td>' + esc(a.start) + ' → ' + esc(a.end) + '</td>' +
                '<td>' + state + '</td>' +
                '<td class="dash-actions">' + (a.live
                  ? '<button class="btn btn--ghost btn--sm" type="button" data-ad-stop>' +
                    (ZH ? '立即下架' : 'Stop') + '</button>'
                  : '') + '</td></tr>';
            }),
            ZH ? '还没有排期。' : 'No placements yet.');
        })
        .catch(function () { adList.innerHTML = ''; });
    }

    if (adList) {
      adList.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-ad-stop]');
        if (!btn) return;
        var id = btn.closest('tr').getAttribute('data-ad');
        apiPost('/api/admin/ads', { action: 'stop', id: id }).then(function (res) {
          toast(res && res.ok
            ? (ZH ? '已下架' : 'Stopped')
            : (ZH ? '操作失败' : 'Failed'));
          renderAds();
        }).catch(function () { toast(ZH ? '操作失败' : 'Failed'); });
      });
    }

    if (adForm) {
      adForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = {};
        new FormData(adForm).forEach(function (v, k) { data[k] = v; });
        apiPost('/api/admin/ads', data).then(function (res) {
          if (!res || !res.ok) {
            toast((ZH ? '添加失败：' : 'Failed: ') + ((res && res.reason) || ''));
            return;
          }
          toast(ZH ? '排期已添加，下一分钟生效' : 'Placement added');
          ['name', 'headline', 'url', 'logo'].forEach(function (k) {
            if (adForm.elements[k]) adForm.elements[k].value = '';
          });
          renderAds();
        }).catch(function () { toast(ZH ? '添加失败' : 'Failed'); });
      });
      renderAds();
    }

    renderAdmin();
  }

  /* --------------------------- user settings ---------------------------- */
  var setRoot = document.querySelector('[data-set-page]');
  if (setRoot) {
    var PAGE = setRoot.getAttribute('data-set-page');
    var K = { plan: 'dir-plan', credits: 'dir-credits', tickets: 'dir-tickets' };
    var TX = {
      free: ZH ? '免费版' : 'Free',
      pro: ZH ? '专业版' : 'Pro',
      noSub: ZH ? '暂无活跃订阅' : 'No active subscription',
      monthly: ZH ? '月度' : 'Monthly',
      yearly: ZH ? '年度' : 'Yearly',
      active: ZH ? '活跃' : 'Active',
      canceling: ZH ? '待取消' : 'Ending soon',
      canceled: ZH ? '已取消' : 'Canceled',
      paid: ZH ? '已支付' : 'Paid',
      refunded: ZH ? '已退款' : 'Refunded',
      oneTime: ZH ? '单次购买' : 'One-time',
      subscription: ZH ? '订阅' : 'Subscription',
      renewal: ZH ? '续订' : 'Renewal',
      card: 'Visa •••• 4242',
      earn: ZH ? '获得' : 'Earned',
      spend: ZH ? '消耗' : 'Spent',
      scene: ZH ? '购买' : 'Purchase',
      noPay: ZH ? '暂无付款记录' : 'No payments yet',
      noCredit: ZH ? '暂无积分记录' : 'No credit activity yet',
      noAd: ZH ? '你还没有预订广告。' : "You haven't booked an ad yet.",
      noTicket: ZH ? '暂无工单' : 'No tickets yet',
      open: ZH ? '处理中' : 'Open',
      pending: ZH ? '待回复' : 'Pending',
      closed: ZH ? '已关闭' : 'Closed',
      view: ZH ? '查看' : 'View',
      cancelSub: ZH ? '取消订阅' : 'Cancel',
      invoice: ZH ? '发票' : 'Invoice',
      total: ZH ? '共 ' : 'Total ',
      records: ZH ? ' 条记录' : ' records',
      saved: ZH ? '已保存' : 'Saved',
      invoiceSent: ZH ? '发票请向站长索取。邮件通知需站长开启。' : 'Ask the site owner for an invoice. Email notices need to be turned on first.',
      subscribedOk: ZH ? '订阅已开通' : 'Subscription active',
      creditsAdded: ZH ? '积分已到账' : 'Credits added',
      ticketSent: ZH ? '工单已创建' : 'Ticket created',
      canceledOk: ZH ? '订阅将在本期结束后停止' : 'Subscription ends at the period end',
      needTitle: ZH ? '请填写工单标题' : 'Enter a subject',
      bigImg: ZH ? '图片不能超过 2MB' : 'Image must be under 2MB',
      signout: ZH ? '退出登录' : 'Sign out',
      confirmSignout: ZH ? '确定退出登录？' : 'Sign out of this demo account?',
      profile: ZH ? '个人资料' : 'Profile',
      adItem: ZH ? '置顶广告位' : 'Pinned placement'
    };

    function getPlan() { return store(K.plan); }
    function getOrders() {
      return (store(S.orders) || []).map(function (o) {
        if (!o.type) o.type = 'one_time';
        if (!o.method) o.method = TX.card;
        return o;
      });
    }
    function getCredits() { return store(K.credits) || []; }
    function getTickets() { return store(K.tickets) || []; }
    function creditsBalance() {
      return getCredits().reduce(function (a, c) {
        return a + (c.type === 'spend' ? -c.amount : c.amount);
      }, 0);
    }
    function planLabel() {
      var p = getPlan();
      if (!p || p.status === 'canceled') return TX.free;
      return TX.pro;
    }
    function currentSub() {
      var p = getPlan();
      return (p && p.status !== 'canceled') ? p : null;
    }
    function dayOf(ts) {
      if (!ts) return '';
      var d = new Date(ts * 1000);
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) +
        '-' + ('0' + d.getDate()).slice(-2);
    }

    /* paint the sidebar chip + any inline user name */
    function paintUser() {
      var u = user() || {};
      document.querySelectorAll('[data-user-name]').forEach(function (n) {
        n.textContent = u.name || (ZH ? '用户' : 'User');
      });
      document.querySelectorAll('[data-user-email]').forEach(function (n) {
        n.textContent = u.email || '—';
      });
      document.querySelectorAll('[data-user-avatar]').forEach(function (n) {
        /* Keep the initial visible until the picture actually loads: a Google
           avatar URL that 404s would otherwise leave an empty circle. */
        n.textContent = (u.name || 'U').trim().charAt(0).toUpperCase();
        n.style.backgroundImage = '';
        if (!u.avatar) return;
        var probe = new Image();
        probe.onload = function () {
          n.style.backgroundImage = 'url("' + u.avatar + '")';
          n.textContent = '';
        };
        probe.src = u.avatar;
      });
    }
    paintUser();
    document.addEventListener('user:change', paintUser);

    /* modals */
    function openModal(id) {
      var m = document.getElementById(id);
      if (m) m.classList.add('is-open');
    }
    function closeModals() {
      document.querySelectorAll('.modal-root.is-open').forEach(function (m) {
        m.classList.remove('is-open');
      });
    }
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-modal]')) {
        openModal(e.target.closest('[data-open-modal]').getAttribute('data-open-modal'));
        return;
      }
      if (e.target.closest('[data-close-modal]')) { closeModals(); return; }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModals();
    });

    /* user menu */
    var moreBtn = document.querySelector('[data-user-menu]');
    if (moreBtn) {
      moreBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var menu = document.querySelector('.user-menu');
        if (menu) { menu.remove(); return; }
        menu = el('<div class="user-menu">' +
          '<a href="' + ROOTDIR + 'settings/profile.html">' + esc(TX.profile) + '</a>' +
          '<button type="button" data-signout>' + esc(TX.signout) + '</button></div>');
        moreBtn.parentNode.appendChild(menu);
      });
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.user-menu') && !e.target.closest('[data-user-menu]')) {
          var m = document.querySelector('.user-menu');
          if (m) m.remove();
        }
      });
    }
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-signout]')) return;
      if (!window.confirm(TX.confirmSignout)) return;
      /* Clearing the mirror is not signing out: the cookie is the session, so
         the server has to drop it too. */
      try { localStorage.removeItem(S.user); } catch (err) {}
      location.href = '/auth/logout?next=' +
        encodeURIComponent(siteRelative(ROOTDIR + 'index.html'));
    });

    /* generic table painter */
    function paintTable(cfg, rows) {
      cfg.tbody.innerHTML = rows.map(cfg.render).join('');
      if (cfg.empty) cfg.empty.classList.toggle('is-on', rows.length === 0);
      if (cfg.count) cfg.count.textContent = TX.total + rows.length + TX.records;
    }
    function statusChip(label, cls) {
      return '<span class="status ' + (cls || 'status--pending') + '">' + esc(label) + '</span>';
    }

    /* ------------------------------- overview --------------------------- */
    if (PAGE === 'overview') {
      // Plan comes from what the account actually owns, not from a localStorage
      // flag that anybody could set by opening the console.
      document.querySelectorAll('[data-stat=plan]').forEach(function (n) {
        n.textContent = TX.free;
      });

      var payBox = document.querySelector('[data-overview-payments]');
      if (payBox) {
        var po = getOrders().slice(0, 3);
        payBox.innerHTML = po.length ? po.map(function (o) {
          return '<div class="set-mini__row"><b>' + esc(o.tool || o.item || '—') +
            '</b><span>$' + fmt(o.amount) + ' · ' + esc(o.created) + '</span></div>';
        }).join('') : '<p class="set-mini__empty">' + esc(TX.noPay) + '</p>';
      }
      var crBox = document.querySelector('[data-overview-credits]');
      if (crBox) {
        var co = getCredits().slice(0, 3);
        crBox.innerHTML = co.length ? co.map(function (c) {
          return '<div class="set-mini__row"><b>' + esc(c.desc) + '</b><span>' +
            (c.type === 'spend' ? '-' : '+') + fmt(c.amount) + ' · ' + esc(c.date) + '</span></div>';
        }).join('') : '<p class="set-mini__empty">' + esc(TX.noCredit) + '</p>';
      }

      /* The submission counts are built as zeroes, because the build has no
         idea who is looking. Replace them with the account's real numbers. */
      if (user()) {
        fetch('/api/my/submissions', { credentials: 'same-origin' })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d || !d.ok) return;
            var items = d.items || [];
            var live = items.filter(function (s) { return s.status === 'approved'; }).length;
            var pending = items.filter(function (s) { return s.status === 'pending'; }).length;
            document.querySelectorAll('[data-stat=subs]').forEach(function (n) {
              n.textContent = String(items.length);
            });
            document.querySelectorAll('[data-subs-note]').forEach(function (n) {
              n.textContent = ZH ? ('审核中 ' + pending + ' · 已上线 ' + live)
                : (pending + ' in review · ' + live + ' live');
            });
            // The plan shown here is the best plan this account actually paid
            // for. Before, it was a localStorage string, so the page could
            // claim "Pro" for an account that had never bought anything.
            var rank = { free: 0, standard: 1, featured: 2, pro: 3 };
            var best = 'free';
            items.forEach(function (s) {
              var p = PLAN_ALIAS[s.plan] || 'free';
              if (s.status === 'approved' && (rank[p] || 0) > (rank[best] || 0)) best = p;
            });
            document.querySelectorAll('[data-stat=plan]').forEach(function (n) {
              n.textContent = best === 'free' ? TX.free
                : (best === 'pro' ? (ZH ? '专业版' : 'Pro')
                  : (best === 'featured' ? 'Featured' : 'Standard'));
            });
            var box = document.querySelector('[data-overview-subs]');
            var empty = document.querySelector('[data-overview-subs-empty]');
            if (box && items.length) {
              box.innerHTML = items.slice(0, 3).map(function (s) {
                var when = dayOf(s.created_at);
                return '<div class="set-mini__row"><b>' + esc(s.name || '') +
                  '</b><span>' + esc(s.status === 'approved' ? (ZH ? '已上线' : 'Live')
                    : (s.status === 'rejected' ? (ZH ? '未通过' : 'Rejected')
                      : (ZH ? '审核中' : 'In review'))) + ' · ' + esc(when) + '</span></div>';
              }).join('');
              if (empty) {
                empty.hidden = true;
                empty.style.display = 'none';   /* the class sets display:block */
              }
            }
          })
          .catch(function () {});
      }
    }

    /* --------------------------------- ads ------------------------------ */
    if (PAGE === 'ads') {
      var adCard = document.querySelector('.set-card--table');
      var adCfg = {
        tbody: adCard.querySelector('tbody'),
        empty: adCard.querySelector('[data-set-empty]'),
        count: adCard.querySelector('[data-set-count]'),
        render: function (s) {
          return '<tr><td><b>' + esc(s.name) + '</b></td>' +
            '<td>' + statusChip(TX.active, 'status--approved') + '</td>' +
            '<td class="num">' + esc(s.featuredUntil || '—') + '</td>' +
            '<td><div class="row-actions"><a class="linkish" href="' +
            ROOTDIR + 'tools/' + esc(s.slug || '') + '.html">' + esc(TX.view) + '</a></div></td></tr>';
        }
      };
      var ads = (store(S.subs) || []).filter(function (s) {
        return s.plan === 'paid' && s.status === 'live';
      });
      paintTable(adCfg, ads);
      if (!ads.length) adCfg.empty.textContent = TX.noAd;
    }

    /* ------------------------------- credits ---------------------------- */
    if (PAGE === 'credits') {
      var cCard = document.querySelector('.set-card--table');
      var cCfg = {
        tbody: cCard.querySelector('tbody'),
        empty: cCard.querySelector('[data-set-empty]'),
        count: cCard.querySelector('[data-set-count]'),
        render: function (c) {
          return '<tr><td>' + esc(c.id) + '</td><td>' + esc(c.desc) + '</td>' +
            '<td>' + esc(c.type === 'spend' ? TX.spend : TX.earn) + '</td>' +
            '<td>' + esc(c.scene || TX.scene) + '</td>' +
            '<td class="num">' + (c.type === 'spend' ? '-' : '+') + fmt(c.amount) + '</td>' +
            '<td class="num">' + fmt(c.balance) + '</td>' +
            '<td class="num">' + esc(c.expires || '—') + '</td>' +
            '<td class="num">' + esc(c.date) + '</td></tr>';
        }
      };
      var cState = { tab: 'all' };
      function drawCredits() {
        var all = getCredits();
        paintTable(cCfg, all.filter(function (c) {
          return cState.tab === 'all' || c.type === cState.tab;
        }));
        document.querySelectorAll('[data-stat=credits]').forEach(function (n) {
          n.textContent = fmt(creditsBalance());
        });
      }
      document.querySelectorAll('[data-set-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          document.querySelectorAll('[data-set-tab]').forEach(function (x) {
            x.classList.toggle('is-active', x === b);
          });
          cState.tab = b.getAttribute('data-set-tab');
          drawCredits();
        });
      });
      var cConfirm = document.querySelector('[data-credits-confirm]');
      if (cConfirm) {
        cConfirm.addEventListener('click', function () {
          var pick = document.querySelector('#credits-modal input[name=pack]:checked');
          var amt = parseInt(pick ? pick.value : '1000', 10);
          var price = amt === 12000 ? 80 : (amt === 5000 ? 40 : 10);
          var ledger = getCredits();
          ledger.unshift({
            id: 'cr_' + Date.now().toString(36),
            desc: (ZH ? '购买 ' : 'Purchased ') + fmt(amt) + (ZH ? ' 积分' : ' credits'),
            type: 'earn', scene: TX.scene, amount: amt,
            balance: creditsBalance() + amt,
            expires: addDays(today(), 365), date: today()
          });
          store(K.credits, ledger);
          var orders = getOrders();
          orders.unshift({
            id: 'ord_' + Date.now(), tool: fmt(amt) + (ZH ? ' 积分' : ' credits'),
            amount: price, status: 'paid', type: 'one_time',
            method: TX.card, created: today(), invoice: false
          });
          store(S.orders, orders);
          closeModals();
          drawCredits();
          toast(TX.creditsAdded);
        });
      }
      drawCredits();
    }

    /* ------------------------------- billing ---------------------------- */
    if (PAGE === 'billing') {
      var bCard = document.querySelector('.set-card--table');
      var bCfg = {
        tbody: bCard.querySelector('tbody'),
        empty: bCard.querySelector('[data-set-empty]'),
        count: bCard.querySelector('[data-set-count]'),
        render: function (s) {
          var st = s.status === 'active' ? [TX.active, 'status--approved']
            : (s.status === 'canceling' ? [TX.canceling, 'status--pending'] : [TX.canceled, 'status--rejected']);
          return '<tr><td>' + esc(s.id) + '</td><td>' + esc(TX.pro) + '</td>' +
            '<td>' + esc(s.cycle === 'yearly' ? TX.yearly : TX.monthly) + '</td>' +
            '<td>' + statusChip(st[0], st[1]) + '</td>' +
            '<td class="num">$' + fmt(s.amount) + '</td>' +
            '<td class="num">' + esc(s.currentStart) + ' → ' + esc(s.currentEnd) + '</td>' +
            '<td class="num">' + esc(s.currentEnd) + '</td>' +
            '<td class="num">' + esc(s.created) + '</td>' +
            '<td><div class="row-actions">' +
            (s.status === 'active'
              ? '<button class="linkish" type="button" data-cancel-sub="' + esc(s.id) + '">' + esc(TX.cancelSub) + '</button>'
              : '—') +
            '</div></td></tr>';
        }
      };
      var bState = { tab: 'all' };
      function drawBilling() {
        var s = currentSub();
        var planEl = document.querySelector('[data-current-plan]');
        if (planEl) {
          planEl.textContent = s
            ? TX.pro + ' · ' + (s.cycle === 'yearly' ? TX.yearly : TX.monthly) +
              ' · $' + fmt(s.amount) + (ZH ? ' / ' : ' / ') +
              (s.cycle === 'yearly' ? (ZH ? '年' : 'yr') : (ZH ? '月' : 'mo'))
            : TX.noSub;
        }
        var list = getPlan() ? [getPlan()] : [];
        paintTable(bCfg, list.filter(function (x) {
          return bState.tab === 'all' || x.status === bState.tab;
        }));
        document.querySelectorAll('[data-stat=plan]').forEach(function (n) { n.textContent = planLabel(); });
      }
      document.querySelectorAll('[data-set-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          document.querySelectorAll('[data-set-tab]').forEach(function (x) {
            x.classList.toggle('is-active', x === b);
          });
          bState.tab = b.getAttribute('data-set-tab');
          drawBilling();
        });
      });
      var sConfirm = document.querySelector('[data-sub-confirm]');
      if (sConfirm) {
        sConfirm.addEventListener('click', function () {
          var pick = document.querySelector('#sub-modal input[name=cycle]:checked');
          var cycle = pick ? pick.value : 'monthly';
          var amount = cycle === 'yearly' ? 190 : 19;
          var start = today();
          var end = addDays(start, cycle === 'yearly' ? 365 : 30);
          store(K.plan, {
            id: 'sub_' + Date.now().toString(36),
            plan: 'pro', cycle: cycle, amount: amount, status: 'active',
            currentStart: start, currentEnd: end, created: start
          });
          var orders = getOrders();
          orders.unshift({
            id: 'ord_' + Date.now(), tool: TX.pro + ' · ' + (cycle === 'yearly' ? TX.yearly : TX.monthly),
            amount: amount, status: 'paid', type: 'subscription',
            method: TX.card, created: start, invoice: false
          });
          store(S.orders, orders);
          closeModals();
          drawBilling();
          toast(TX.subscribedOk);
        });
      }
      bCard.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cancel-sub]');
        if (!b) return;
        var p = getPlan();
        if (!p) return;
        p.status = 'canceling';
        store(K.plan, p);
        drawBilling();
        toast(TX.canceledOk);
      });
      drawBilling();
    }

    /* ------------------------------ payments ---------------------------- */
    if (PAGE === 'payments') {
      var pCard = document.querySelector('.set-card--table');
      var pCfg = {
        tbody: pCard.querySelector('tbody'),
        empty: pCard.querySelector('[data-set-empty]'),
        count: pCard.querySelector('[data-set-count]'),
        render: function (o) {
          var typeLabel = o.type === 'subscription' ? TX.subscription
            : (o.type === 'renewal' ? TX.renewal : TX.oneTime);
          var st = o.status === 'refunded' ? [TX.refunded, 'status--rejected'] : [TX.paid, 'status--approved'];
          return '<tr><td>' + esc(o.id) + '</td><td>' + esc(o.tool || '—') + '</td>' +
            '<td class="num">$' + fmt(o.amount) + '</td>' +
            '<td>' + statusChip(st[0], st[1]) + '</td>' +
            '<td>' + esc(typeLabel) + '</td><td>' + esc(o.method || TX.card) + '</td>' +
            '<td class="num">' + esc(o.created) + '</td>' +
            '<td><button class="linkish" type="button" data-invoice="' + esc(o.id) + '">' + esc(TX.invoice) + '</button></td></tr>';
        }
      };
      var pState = { tab: 'all', q: '', status: '' };
      function drawPayments() {
        var rows = getOrders().filter(function (o) {
          if (pState.tab !== 'all' && o.type !== pState.tab) return false;
          if (pState.status && o.status !== pState.status) return false;
          if (pState.q) {
            var hay = (o.id + ' ' + (o.tool || '') + ' ' + o.amount).toLowerCase();
            if (hay.indexOf(pState.q.toLowerCase()) < 0) return false;
          }
          return true;
        });
        paintTable(pCfg, rows);
      }
      document.querySelectorAll('[data-set-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          document.querySelectorAll('[data-set-tab]').forEach(function (x) {
            x.classList.toggle('is-active', x === b);
          });
          pState.tab = b.getAttribute('data-set-tab');
          drawPayments();
        });
      });
      var pSearch = pCard.querySelector('[data-set-search]');
      if (pSearch) pSearch.addEventListener('input', function () { pState.q = pSearch.value; drawPayments(); });
      var pStatus = pCard.querySelector('[data-set-status]');
      if (pStatus) pStatus.addEventListener('change', function () { pState.status = pStatus.value; drawPayments(); });
      pCard.addEventListener('click', function (e) {
        var b = e.target.closest('[data-invoice]');
        if (b) toast(TX.invoiceSent);
      });
      var pRefresh = pCard.querySelector('[data-set-refresh]');
      if (pRefresh) pRefresh.addEventListener('click', drawPayments);
      drawPayments();
    }

    /* ------------------------------- profile ---------------------------- */
    var pf = document.querySelector('[data-profile-form]');
    if (pf) {
      var u0 = user() || {};
      var nameEl = pf.querySelector('[name=name]');
      var mailEl = pf.querySelector('[name=email]');
      if (nameEl) nameEl.value = u0.name || '';
      if (mailEl) mailEl.value = u0.email || '';
      var drop = document.querySelector('[data-avatar-pick]');
      var fileEl = document.querySelector('[data-avatar-input]');
      if (u0.avatar && drop) {
        drop.style.backgroundImage = 'url(' + u0.avatar + ')';
        drop.classList.add('has-img');
      }
      if (drop && fileEl) {
        drop.addEventListener('click', function () { fileEl.click(); });
        fileEl.addEventListener('change', function () {
          var f = fileEl.files && fileEl.files[0];
          if (!f) return;
          if (f.size > 2 * 1024 * 1024) { toast(TX.bigImg); return; }
          var reader = new FileReader();
          reader.onload = function () {
            var u1 = user() || {};
            u1.avatar = reader.result;
            store(S.user, u1);
            drop.style.backgroundImage = 'url(' + reader.result + ')';
            drop.classList.add('has-img');
            paintUser();
          };
          reader.readAsDataURL(f);
        });
      }
      pf.addEventListener('submit', function (e) {
        e.preventDefault();
        var u1 = user() || {};
        u1.name = (nameEl && nameEl.value.trim()) || u1.name;
        if (!u1.email && mailEl) u1.email = mailEl.value;
        store(S.user, u1);
        paintUser();
        toast(TX.saved);
      });
    }
  }
})();
