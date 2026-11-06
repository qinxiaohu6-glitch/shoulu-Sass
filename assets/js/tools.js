/* SEO check + DR lookup.
   Every number on this page comes from the server (/api/audit, /api/dr).
   Nothing here estimates, rounds up or fills a gap: when a value is missing
   the UI says so instead of showing a plausible-looking number. */
(function () {
  'use strict';

  var body = document.body;
  var ZH = ((body && body.dataset.lang) || 'en') === 'zh';
  var ROOTDIR = (body && body.dataset.root) || '';
  var ASSETROOT = (body && body.dataset.assetroot) || ROOTDIR;
  var API = ASSETROOT + 'api/';

  var form = document.getElementById('audit-form');
  if (!form) return;

  var input = document.getElementById('audit-url');
  var goBtn = document.getElementById('audit-go');
  var goLabel = goBtn ? goBtn.querySelector('[data-label]') : null;
  var statusEl = document.getElementById('audit-status');
  var resultEl = document.getElementById('audit-result');

  var S = {
    checking: ZH ? '正在抓取页面，最多 30 秒…' : 'Fetching the page — up to 30 seconds…',
    still: ZH ? '这个站响应有点慢，再等等…' : 'That site is slow. Still waiting…',
    netErr: ZH ? '连不上诊断服务。如果是本地打开的文件，请用 serve.py 起服务后再试。'
               : 'Cannot reach the check service. If you opened the file directly, run it through serve.py.',
    badJson: ZH ? '服务返回了读不懂的内容。' : 'The service returned something we could not read.',
    timeout: ZH ? '超时了。这个站可能拦了爬虫，或响应太慢。' : 'Timed out. The site may block crawlers or be too slow.',
    again: ZH ? '再查一次' : 'Check again',
    fail: ZH ? '项不通过' : 'failed',
    warn: ZH ? '项待改进' : 'to improve',
    pass: ZH ? '项通过' : 'passed',
    fixFirst: ZH ? '先修这几项' : 'Fix these first',
    fixSoft: ZH ? '可以再优化这几项' : 'Worth improving',
    mustFix: ZH ? '必改' : 'Must fix',
    shouldFix: ZH ? '建议' : 'Worth fixing',
    allChecks: ZH ? '全部检查明细' : 'All checks',
    howTo: ZH ? '怎么改' : 'How to fix',
    ctaTitle: ZH ? '把这条链接直接提交，资料自动填好。' : 'Submit this URL and the listing is prefilled.',
    ctaBtn: ZH ? '提交这个产品' : 'Submit this product',
    ctaNote: ZH ? '免费收录，页面永久保留。' : 'Free to list. The page stays.',
    permalink: ZH ? '固定链接' : 'Permalink',
    notIndexed: ZH ? '未达收录门槛，搜索引擎不会收录这一页' : 'Below the indexing bar — search engines will skip this page',
    audited: ZH ? '检测对象' : 'Checked',
    drTitle: ZH ? 'DR 查询' : 'DR lookup',
    drChecking: ZH ? '正在查询…' : 'Looking up…',
    drInvalid: ZH ? '输入一个域名，比如 your-product.com' : 'Enter a domain, like your-product.com',
    drNotConf: ZH
      ? '我们还没有接通 DR 数据源，所以现在读不到真实数值。'
      : 'We have not wired up a DR data source yet, so we cannot read a real value.',
    drNotConfBody: ZH
      ? '我们不会给你一个估出来的数字——你十秒钟就能在 Ahrefs 上验证，编错了只会砸自己的招牌。先用官方的免费查询：'
      : 'We will not hand you an estimate. You can verify the real number in Ahrefs in ten seconds, and a wrong one only burns trust. Use the official free checkers:',
    drErr: ZH ? '数据源这次没有返回结果（可能限流或网络问题）。' : 'The data source returned nothing this time (rate limit or network).',
    drRetry: ZH ? '重试' : 'Retry',
    drSource: ZH ? '数据来源' : 'Source',
    drChecked: ZH ? '查询时间' : 'Checked',
    drCached: ZH ? '（缓存结果）' : '(cached)',
    drPrNote: ZH
      ? '注意：这是 Open PageRank 的 PR 值（0–10），不是 Ahrefs 的 DR（0–100）。两个不是一回事。'
      : 'Note: this is Open PageRank (PR, 0-10), not Ahrefs DR (0-100). They are different metrics.',
    official: ZH ? '官方免费查询' : 'Official free checkers'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function setStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.className = 'tool-status' + (kind ? ' is-' + kind : '');
  }

  function busy(on) {
    if (!goBtn) return;
    goBtn.disabled = on;
    goBtn.classList.toggle('is-busy', on);
    if (goLabel) goLabel.textContent = on
      ? (ZH ? '诊断中…' : 'Checking…')
      : (ZH ? '开始诊断' : 'Run the check');
  }

  function getJSON(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 30000);
    return fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data;
        try {
          data = JSON.parse(txt);
        } catch (e) {
          var err = new Error('bad_json');
          err.code = r.status === 404 ? 'no_endpoint' : 'bad_json';
          throw err;
        }
        return { status: r.status, data: data };
      });
    }).finally(function () { clearTimeout(timer); });
  }

  /* ---------------------------------------------------------------- audit */
  function verdict(score) {
    if (score >= 85) return ZH ? '技术底子已经很扎实' : 'Technically solid';
    if (score >= 60) return ZH ? '能用，但有几处在拖后腿' : 'Workable, with a few leaks';
    return ZH ? '先修这几项，再谈排名' : 'Fix these before chasing rankings';
  }

  function tally(data) {
    var s = data.summary || {};
    var out = [];
    if (s.fail) out.push('<li class="is-fail"><b>' + s.fail + '</b>' + S.fail + '</li>');
    if (s.warn) out.push('<li class="is-warn"><b>' + s.warn + '</b>' + S.warn + '</li>');
    if (s.pass) out.push('<li class="is-pass"><b>' + s.pass + '</b>' + S.pass + '</li>');
    return out.join('');
  }

  function groupLabel(g) {
    return esc(ZH ? g.label_zh : g.label_en);
  }

  function checkRow(c) {
    var ico = c.status === 'pass' ? '&#10003;' : (c.status === 'warn' ? '!' : '&#215;');
    var how = c.fix ? '<p class="chk__how">' + S.howTo + (ZH ? '：' : ': ') + esc(c.fix) + '</p>' : '';
    return '<li class="chk chk--' + c.status + '">' +
      '<span class="chk__dot" aria-hidden="true">' + ico + '</span>' +
      '<div class="chk__body"><p class="chk__label">' + esc(c.label) + '</p>' +
      '<p class="chk__detail">' + esc(c.detail) + '</p>' + how + '</div></li>';
  }

  function fixRow(c) {
    var tag = c.status === 'fail' ? S.mustFix : S.shouldFix;
    return '<li class="fix fix--' + c.status + '">' +
      '<span class="fix__tag">' + tag + '</span>' +
      '<div><p class="fix__label">' + esc(c.label) + '</p>' +
      '<p class="fix__detail">' + esc(c.detail) + '</p>' +
      (c.fix ? '<p class="fix__how">' + esc(c.fix) + '</p>' : '') +
      '</div></li>';
  }

  function renderAudit(data) {
    var score = data.score || 0;
    var grade = data.grade || 'E';
    var groups = data.groups || [];
    var checks = data.checks || [];
    var fails = checks.filter(function (c) { return c.status === 'fail'; });
    var warns = checks.filter(function (c) { return c.status === 'warn'; });
    var fixes = fails.concat(warns).slice(0, 5);
    var target = data.final_url || data.url || '';

    var bars = groups.map(function (g) {
      var pct = Math.round((g.score / g.max) * 100);
      return '<div class="g-row">' +
        '<span class="g-row__label">' + groupLabel(g) + '</span>' +
        '<span class="g-row__bar"><i style="width:' + pct + '%"></i></span>' +
        '<span class="g-row__score">' + g.score + '<span>/' + g.max + '</span></span>' +
        '</div>';
    }).join('');

    var detail = groups.map(function (g) {
      var items = checks.filter(function (c) { return c.group === g.key; });
      return '<section class="chk-group"><h4>' + groupLabel(g) +
        '<span>' + g.score + '/' + g.max + '</span></h4><ul>' +
        items.map(checkRow).join('') + '</ul></section>';
    }).join('');

    var fixBlock = fixes.length
      ? '<div class="audit__fixes"><h3>' + (fails.length ? S.fixFirst : S.fixSoft) +
        ' <span>' + fixes.length + '</span></h3>' +
        '<ol>' + fixes.map(fixRow).join('') + '</ol></div>'
      : '<div class="audit__fixes is-clean"><h3>' + (ZH ? '没有需要修的地方' : 'Nothing to fix') + '</h3>' +
        '<p>' + (ZH ? '这 20 项全部通过或接近通过。' : 'All 20 checks pass or nearly pass.') + '</p></div>';

    var linkLine = '';
    if (data.permalink) {
      var href = ROOTDIR + String(data.permalink).replace(/^\//, '');
      linkLine = '<p class="audit__link">' + S.permalink + ' · <a href="' + href + '">' +
        esc(data.permalink) + '</a>' +
        (data.indexed ? '' : ' <span>' + S.notIndexed + '</span>') + '</p>';
    }

    resultEl.innerHTML =
      '<div class="audit__head">' +
        '<div class="audit__ring" data-grade="' + esc(grade) + '" style="--pct:' + score + '">' +
          '<div class="audit__ring-in"><b>' + score + '</b><span>/100</span></div>' +
        '</div>' +
        '<div class="audit__verdict">' +
          '<p class="audit__kicker">' + S.audited + ' · <a href="' + esc(target) + '" target="_blank" rel="noopener nofollow">' + esc(target.replace(/^https?:\/\//, '')) + '</a></p>' +
          '<h2 class="audit__headline">' + verdict(score) + '</h2>' +
          '<ul class="audit__tally">' + tally(data) + '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="audit__bars">' + bars + '</div>' +
      fixBlock +
      '<details class="audit__all"><summary>' + S.allChecks + ' <span>' + checks.length + '</span></summary>' +
        '<div class="chk-groups">' + detail + '</div></details>' +
      '<div class="audit__cta">' +
        '<div><p class="audit__cta-title">' + S.ctaTitle + '</p>' +
        '<p class="audit__cta-note">' + S.ctaNote + '</p>' +
        linkLine + '</div>' +
        '<a class="btn btn--primary" href="' + ROOTDIR + 'submit.html?url=' +
          encodeURIComponent(target) + '">' + S.ctaBtn + '</a>' +
      '</div>';

    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = (input.value || '').trim();
    if (!raw) {
      setStatus(ZH ? '先填一个网址。' : 'Enter a URL first.', 'error');
      input.focus();
      return;
    }
    setStatus(S.checking);
    busy(true);
    resultEl.hidden = true;
    var slow = setTimeout(function () { setStatus(S.still); }, 9000);

    getJSON(API + 'audit?url=' + encodeURIComponent(raw) + '&lang=' + (ZH ? 'zh' : 'en'), 32000)
      .then(function (res) {
        clearTimeout(slow);
        var d = res.data || {};
        if (!d.ok) {
          setStatus(ZH ? (d.message_zh || d.message || '诊断失败。')
                       : (d.message_en || d.message || 'The check failed.'), 'error');
          return;
        }
        setStatus('');
        renderAudit(d);
      })
      .catch(function (err) {
        clearTimeout(slow);
        if (err && err.name === 'AbortError') setStatus(S.timeout, 'error');
        else if (err && err.code === 'no_endpoint') setStatus(S.netErr, 'error');
        else if (err && err.code === 'bad_json') setStatus(S.badJson, 'error');
        else setStatus(S.netErr, 'error');
      })
      .finally(function () { busy(false); });
  });

  /* ------------------------------------------------------------------- dr */
  var drForm = document.getElementById('dr-form');
  var drInput = document.getElementById('dr-domain');
  var drStatus = document.getElementById('dr-status');
  var drResult = document.getElementById('dr-result');

  function drSetStatus(msg, kind) {
    if (!drStatus) return;
    drStatus.textContent = msg || '';
    drStatus.className = 'tool-status' + (kind ? ' is-' + kind : '');
  }

  function officialLinks() {
    return '<div class="dr-links"><p>' + S.official + '</p><ul>' +
      '<li><a href="https://ahrefs.com/website-authority-checker" target="_blank" rel="noopener">' +
        'Ahrefs Website Authority Checker <span>DR 0–100</span></a></li>' +
      '<li><a href="https://www.domcop.com/openpagerank/what-is-openpagerank" target="_blank" rel="noopener">' +
        'Open PageRank <span>PR 0–10</span></a></li>' +
      '</ul></div>';
  }

  function renderDr(d) {
    if (!d.ok) {
      if (d.reason === 'invalid_domain') {
        drSetStatus(S.drInvalid, 'error');
        drResult.hidden = true;
        return;
      }
      drSetStatus('');
      var head = d.reason === 'not_configured' ? S.drNotConf : S.drErr;
      var lead = d.reason === 'not_configured' ? S.drNotConfBody
        : (ZH ? '稍后重试，或直接用官方查询核对：' : 'Try again later, or verify with the official checkers:');
      var retry = d.reason === 'not_configured' ? '' :
        '<button class="btn btn--outline btn--sm" type="button" id="dr-retry">' + S.drRetry + '</button>';
      drResult.innerHTML =
        '<div class="dr-empty">' +
          '<p class="dr-empty__head">' + head + '</p>' +
          '<p class="dr-empty__body">' + lead + '</p>' +
          officialLinks() + retry +
        '</div>';
      drResult.hidden = false;
      var rb = document.getElementById('dr-retry');
      if (rb) rb.addEventListener('click', function () { runDr(true); });
      return;
    }

    var metric = d.metric === 'PR' ? 'PR' : 'DR';
    var provider = d.provider === 'openpagerank' ? 'Open PageRank' : 'Ahrefs';
    var when = '';
    try {
      when = new Date((d.checked_at || 0) * 1000).toLocaleDateString(ZH ? 'zh-CN' : 'en-US');
    } catch (e) { when = ''; }

    drSetStatus('');
    drResult.innerHTML =
      '<div class="dr-value" data-metric="' + metric + '">' +
        '<b>' + esc(d.value) + '</b><span>' + metric + '</span>' +
      '</div>' +
      '<p class="dr-meta">' + esc(d.domain) + ' · ' + S.drSource + '：' + provider +
        (when ? ' · ' + S.drChecked + ' ' + esc(when) : '') +
        (d.cached ? ' ' + S.drCached : '') + '</p>' +
      (metric === 'PR' ? '<p class="dr-note">' + S.drPrNote + '</p>' : '');
    drResult.hidden = false;
  }

  function runDr(force) {
    if (!drForm) return;
    var raw = (drInput.value || '').trim();
    if (!raw) {
      drSetStatus(S.drInvalid, 'error');
      drInput.focus();
      return;
    }
    drSetStatus(S.drChecking);
    drResult.hidden = true;
    getJSON(API + 'dr?domain=' + encodeURIComponent(raw) + (force ? '&force=1' : ''), 20000)
      .then(function (res) { renderDr(res.data || {}); })
      .catch(function () {
        drSetStatus('');
        drResult.innerHTML = '<div class="dr-empty"><p class="dr-empty__head">' + S.drErr + '</p>' +
          officialLinks() + '</div>';
        drResult.hidden = false;
      });
  }

  if (drForm) {
    drForm.addEventListener('submit', function (e) {
      e.preventDefault();
      runDr(false);
    });
  }

  /* Prefill both inputs from ?url= so links can point straight at a check. */
  try {
    var q = new URLSearchParams(location.search).get('url');
    if (q) {
      if (input && !input.value) input.value = q;
      if (drInput && !drInput.value) {
        try { drInput.value = new URL(/^https?:\/\//i.test(q) ? q : 'https://' + q).hostname; }
        catch (e2) { drInput.value = q; }
      }
    }
  } catch (e) { /* no URLSearchParams: fine */ }
})();
