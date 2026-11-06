#!/usr/bin/env python3
"""Server-rendered page for one checked domain: /seo-check/<domain>

Reuses build.py's chrome (sidebar, topbar, footer, design tokens) so the page
looks like the rest of the site without a second template to maintain.

Rendering touches build.py globals (LANG, PATH, USED_ICONS), so every render
takes a lock — the HTTP server is threaded and two languages must not mix.
"""

import os
import threading
import time

import build as B
import reports

_RENDER_LOCK = threading.Lock()

CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "").strip()


def _d(ts):
    try:
        return time.strftime("%Y-%m-%d", time.localtime(int(ts)))
    except Exception:  # noqa: BLE001
        return ""


def verdict(score, zh):
    if score >= 85:
        return '技术底子已经很扎实' if zh else 'Technically solid'
    if score >= 60:
        return '能用，但有几处在拖后腿' if zh else 'Workable, with a few leaks'
    return '先修这几项，再谈排名' if zh else 'Fix these before chasing rankings'


def status_word(status, zh):
    return {'pass': ('通过' if zh else 'passed'),
            'warn': ('待改进' if zh else 'to improve'),
            'fail': ('不通过' if zh else 'failed')}.get(status, status)


def _ring(score, grade):
    return (f'<div class="audit__ring" data-grade="{B.esc(grade)}" style="--pct:{score}">'
            f'<div class="audit__ring-in"><b>{score}</b><span>/100</span></div></div>')


def _bars(groups, zh):
    out = ''
    for g in groups:
        pct = round(g['score'] / g['max'] * 100)
        label = g['label_zh'] if zh else g['label_en']
        out += (f'<div class="g-row"><span class="g-row__label">{B.esc(label)}</span>'
                f'<span class="g-row__bar"><i style="width:{pct}%"></i></span>'
                f'<span class="g-row__score">{g["score"]}<span>/{g["max"]}</span></span></div>')
    return f'<div class="audit__bars">{out}</div>'


def _fixes(checks, zh):
    fails = [c for c in checks if c['status'] == 'fail']
    warns = [c for c in checks if c['status'] == 'warn']
    picks = (fails + warns)[:5]
    if not picks:
        return ('<div class="audit__fixes is-clean"><h3>'
                + ('没有需要修的地方' if zh else 'Nothing to fix') + '</h3><p>'
                + ('这 20 项全部通过或接近通过。' if zh else 'All 20 checks pass or nearly pass.')
                + '</p></div>')
    head = ('先修这几项' if fails else '可以再优化这几项') if zh else \
           ('Fix these first' if fails else 'Worth improving')
    rows = ''
    for c in picks:
        tag = ('必改' if c['status'] == 'fail' else '建议') if zh else \
              ('Must fix' if c['status'] == 'fail' else 'Worth fixing')
        how = f'<p class="fix__how">{B.esc(c["fix"])}</p>' if c.get('fix') else ''
        rows += (f'<li class="fix fix--{c["status"]}"><span class="fix__tag">{tag}</span>'
                 f'<div><p class="fix__label">{B.esc(c["label"])}</p>'
                 f'<p class="fix__detail">{B.esc(c["detail"])}</p>{how}</div></li>')
    return (f'<div class="audit__fixes"><h3>{head} <span>{len(picks)}</span></h3>'
            f'<ol>{rows}</ol></div>')


def _all_checks(groups, checks, zh):
    body = ''
    for g in groups:
        items = [c for c in checks if c['group'] == g['key']]
        label = g['label_zh'] if zh else g['label_en']
        rows = ''
        for c in items:
            mark = {'pass': '&#10003;', 'warn': '!', 'fail': '&#215;'}[c['status']]
            how = (f'<p class="chk__how">' + ('怎么改：' if zh else 'How to fix: ')
                   + B.esc(c['fix']) + '</p>') if c.get('fix') else ''
            rows += (f'<li class="chk chk--{c["status"]}">'
                     f'<span class="chk__dot" aria-hidden="true">{mark}</span>'
                     f'<div class="chk__body"><p class="chk__label">{B.esc(c["label"])}</p>'
                     f'<p class="chk__detail">{B.esc(c["detail"])}</p>{how}</div></li>')
        body += (f'<section class="chk-group"><h4>{B.esc(label)}'
                 f'<span>{g["score"]}/{g["max"]}</span></h4><ul>{rows}</ul></section>')
    return (f'<details class="audit__all"><summary>'
            + ('全部检查明细' if zh else 'All checks')
            + f' <span>{len(checks)}</span></summary>'
            f'<div class="chk-groups">{body}</div></details>')


def render(domain, lang='en', report=None):
    """Full HTML for one report page. Caller has already loaded/created it.

    The whole build runs under the render lock: build.py keeps LANG / PATH /
    USED_ICONS in module globals, and this server is threaded, so an English
    and a Chinese request must never interleave.
    """
    with _RENDER_LOCK:
        zh = str(lang).lower().startswith('zh')
        B.LANG = 'zh' if zh else 'en'
        path = f'seo-check/{domain}'
        B.at(path)
        return _render_locked(domain, zh, path, report)


def _render_locked(domain, zh, path, rep):
    score = int(rep.get('score') or 0)
    grade = rep.get('grade') or 'E'
    groups = rep.get('groups') or []
    checks = rep.get('checks') or []
    summary = rep.get('summary') or {}
    facts = rep.get('facts') or {}
    checked = _d(rep.get('checked_at'))
    indexable = reports.indexable(rep)
    url = B.abs_url(path)

    title = (f'{domain} SEO 检查：{score}/100（{checked}）| {B.SITE_NAME}' if zh
             else f'{domain} SEO check: {score}/100 (checked {checked}) | {B.SITE_NAME}')
    desc = (f'{domain} 的公开技术 SEO 检测结果：20 项检查得 {score}/100（{grade} 级），'
            f'{summary.get("fail", 0)} 项不通过、{summary.get("warn", 0)} 项待改进，'
            f'检测时间 {checked}。' if zh else
            f'Public technical SEO check of {domain}: {score}/100 ({grade}) across 20 checks, '
            f'{summary.get("fail", 0)} failed and {summary.get("warn", 0)} to improve, '
            f'checked {checked}.')

    tally = ''
    if summary.get('fail'):
        tally += (f'<li class="is-fail"><b>{summary["fail"]}</b>'
                  + ('项不通过' if zh else 'failed') + '</li>')
    if summary.get('warn'):
        tally += (f'<li class="is-warn"><b>{summary["warn"]}</b>'
                  + ('项待改进' if zh else 'to improve') + '</li>')
    if summary.get('pass'):
        tally += (f'<li class="is-pass"><b>{summary["pass"]}</b>'
                  + ('项通过' if zh else 'passed') + '</li>')

    # ---- recently checked: real internal links for crawlers and readers ----
    others = [r for r in reports.recent(9) if r['domain'] != domain][:8]
    recent_html = ''
    if others:
        chips = ''.join(
            f'<li><a href="{B.u("seo-check/" + r["domain"])}"><span>{B.esc(r["domain"])}</span>'
            f'<b>{r["score"]}</b></a></li>' for r in others)
        recent_html = f'''<section class="tool-section">
  {B.section_head('最近检测' if zh else 'Recently checked',
                  '每个域名一页，同一个站不会因为不同路径重复建页。' if zh
                  else 'One page per domain — the same site never gets a page per path.')}
  <ul class="recent-list">{chips}</ul>
</section>'''

    contact = ''
    if CONTACT_EMAIL:
        contact = (f'<a href="mailto:{B.esc(CONTACT_EMAIL)}?subject='
                   f'{B.esc("Remove " + domain)}">{B.esc(CONTACT_EMAIL)}</a>')

    method = f'''<section class="tool-section" id="method">
  {B.section_head('这个页面是怎么来的' if zh else 'How this page was made')}
  <div class="method">
    <p>{'这不是评价，也不是排名。它是一次公开的技术检测结果。' if zh else 'This is not a review and not a ranking. It is the result of one public technical check.'}</p>
    <ul>
      <li><b>{'抓的是什么' if zh else 'What was fetched'}</b>{'我们服务器对你的首页发了一次普通 HTTP 请求，拿到原始 HTML，不执行 JavaScript——和大多数爬虫、以及 AI 搜索看到的内容一致。' if zh else 'Our server made one plain HTTP request to your homepage and read the raw HTML without executing JavaScript — the same thing most crawlers and AI search see.'}</li>
      <li><b>{'什么时候抓的' if zh else 'When'}</b>{checked}{'。这个页面超过 14 天没人访问会重新抓一次，分数随之更新；每次打开显示的日期就是那次抓取的时间。' if zh else '. If nobody opens it for 14 days it is re-fetched on the next visit and the score updates; the date shown is always the date of the fetch behind the numbers.'}</li>
      <li><b>{'不是什么' if zh else 'What it is not'}</b>{'不是 Google 排名，不是流量数据，不包含任何需要登录才能看到的内容。这 20 项只说明机器能不能读懂、能不能收录你的页面。' if zh else 'Not a Google ranking, not traffic data, and nothing behind a login. These 20 checks only say whether a machine can read and index the page.'}</li>
      <li><b>{'收录政策' if zh else 'Indexing policy'}</b>{'只有能抓到、有真实正文和标题的站点才会被搜索引擎收录；抓不到、空壳页、停放域名一律不进索引，但仍然可以打开查看。' if zh else 'Only sites we can actually fetch, with real text and a real title, are allowed into search. Unreachable pages, empty shells and parked domains stay out of the index but can still be opened.'}</li>
      <li><b>{'如果这是你的域名' if zh else 'If this is your domain'}</b>{('希望这个页面不被收录，发邮件到 ' + contact + ' 把域名加入排除名单。') if contact else ('希望这个页面不被搜索引擎收录，可以要求我们把它加入排除名单。' if zh else 'If you would rather this page were not indexed, you can ask us to add the domain to the exclusion list.')}</li>
    </ul>
  </div>
</section>'''

    body = f'''<div class="container container--narrow">
  {B.breadcrumb([(B.t('discover'), B.u('index.html')),
                 (B.t('seo_check'), B.u('seo-check.html')),
                 (B.esc(domain), None)])}

  <header class="page-head tool-head">
    <p class="tool-eyebrow">{B.icon('gauge')}{'公开检测记录' if zh else 'Public check record'}</p>
    <h1 class="page-title page-title--lg">{B.esc(domain)}{' — SEO 检查 ' if zh else ' — SEO check: '}{score}/100</h1>
    <p class="page-sub page-sub--lg">{'20 项技术检查，5 个维度各 20 分。检测时间 ' if zh else '20 technical checks, 20 points per area. Checked '}{checked}{'，抓取地址 ' if zh else ', fetched '}<a href="{B.esc(facts.get("final_url") or "")}" rel="nofollow noopener" target="_blank">{B.esc(facts.get("final_url") or domain)}</a></p>
  </header>

  <section class="tool-panel">
    <div class="audit__head">
      {_ring(score, grade)}
      <div class="audit__verdict">
        <p class="audit__kicker">{'检测对象' if zh else 'Checked'} · {B.esc(domain)}</p>
        <h2 class="audit__headline">{verdict(score, zh)}</h2>
        <ul class="audit__tally">{tally}</ul>
      </div>
    </div>
    {_bars(groups, zh)}
    {_fixes(checks, zh)}
    {_all_checks(groups, checks, zh)}
    <div class="audit__cta">
      <div><p class="audit__cta-title">{'这是你的产品？提交到目录，页面永久保留。' if zh else 'Is this your product? List it — the page stays.'}</p>
      <p class="audit__cta-note">{'免费收录，付费置顶拿 dofollow 反链。' if zh else 'Free to list; a paid placement adds a dofollow backlink.'}</p></div>
      <a class="btn btn--primary" href="{B.u('submit.html')}?url={B.esc(facts.get('final_url') or '')}">{'提交这个产品' if zh else 'Submit this product'}</a>
    </div>
  </section>

  {method}
  {recent_html}

  <section class="tool-cta">
    <div class="tool-cta__body">
      <h2>{'查另一个站' if zh else 'Check another site'}</h2>
      <p>{'输入任意网址，10 秒拿到同样的 20 项检查。不需要注册。' if zh else 'Paste any URL and get the same 20 checks in about 10 seconds. No signup.'}</p>
    </div>
    <a class="btn btn--primary btn--lg" href="{B.u('seo-check.html')}">{'开始检测' if zh else 'Run a check'}{B.icon('arrow-right')}</a>
  </section>
</div>'''

    ld = B.ld_graph(
        B.ld_breadcrumb_obj([(B.t('discover'), 'index.html'),
                             (B.t('seo_check'), 'seo-check.html'),
                             (domain, path)]),
        B.ld_webpage_obj(title.split(' | ')[0], desc, path),
        {
            '@type': 'Dataset',
            'name': (f'{domain} SEO 检查数据' if zh else f'{domain} SEO check data'),
            'description': desc,
            'url': url,
            'temporalCoverage': checked,
            'creator': {'@type': 'Organization', 'name': B.SITE_NAME, 'url': B.SITE + '/index.html'},
            'variableMeasured': [
                {'@type': 'PropertyValue', 'name': g['label_en'], 'value': g['score']}
                for g in groups
            ],
        },
    )

    return B.page(title, desc, body, 'seo-check', path, ld,
                  robots='index,follow' if indexable else 'noindex,follow')
