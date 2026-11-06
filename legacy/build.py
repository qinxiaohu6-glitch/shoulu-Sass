#!/usr/bin/env python3
"""Static site generator — AI Directory MVP v1.0 (per PRD 2026-10-29).

Scope follows the PRD strictly:
  §3.1 browse/discover   §3.2 tool detail (SEO core)   §3.3 submit (two tracks)
  §3.4 votes + weekly    §3.5 monetisation (pinned)    §3.6 i18n (/ and /zh)
  §3.7 admin             §3.8 programmatic SEO
Out of scope per §8: rich content (pros/cons/use cases/FAQ), full ad system,
newsletter, extra languages, advanced ranking.
"""
import json
import os
import re
from datetime import date, datetime, timedelta
from urllib.parse import quote

import hashlib

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(ROOT, 'data', 'mvp.json'), encoding='utf-8'))
# Canonical origin for every absolute URL (canonical / hreflang / og:url / sitemap).
# Override without touching data: SITE_BASE=https://yourdomain.com python3 build.py
SITE = (os.environ.get('SITE_BASE') or DATA['site']['base']).rstrip('/')
SITE_NAME = DATA['site']['name']
# One address, used by the support page and the legal pages. Kept in the data
# file so changing it is a data edit, not a find-and-replace across templates.
SITE_EMAIL = DATA['site'].get('email') or ('hello@' + SITE.split('//')[-1].replace('www.', ''))
TODAY = date(2026, 10, 29)

CATS = DATA['categories']
TAGS = DATA['tags']
# schema.org Application sub-types — Google expects an enum here, not a free-form label.
APP_CATEGORY = {
    'chatbots': 'CommunicationApplication',
    'coding': 'DeveloperApplication',
    'image': 'MultimediaApplication',
    'video': 'MultimediaApplication',
    'audio': 'MultimediaApplication',
    'writing': 'BusinessApplication',
    'productivity': 'BusinessApplication',
    'research': 'UtilitiesApplication',
}
TOOLS = {t['slug']: t for t in DATA['tools']}
TOOL_LIST = DATA['tools']
WEEKS = DATA['weeks']

def _as_date(v):
    try:
        return datetime.strptime(str(v)[:10], '%Y-%m-%d').date()
    except Exception:
        return None


# Expiry is measured against the day the site is built, not against TODAY
# (which only pins the year printed on category pages). A static build cannot
# expire anything by itself, so the honest contract is: rebuild and the pin
# falls off. serve.py rebuilds nothing, which is why the build is meant to run
# on a schedule rather than once. BUILD_DATE=2026-12-01 lets you see what the
# site will look like once the current pins lapse.
BUILD_DATE = _as_date(os.environ.get('BUILD_DATE')) or date.today()

# --------------------------------------------------------------------------
# money  — one source, because three pages quote these numbers
# --------------------------------------------------------------------------
# Prices drifted between the pricing page, the submit form and the FAQ when
# each was typed by hand: the submit form was still selling a $19 Featured
# while the pricing page had moved on. Everything that prints a price reads
# this dict now.
PLANS = {
    'free':     {'usd': '$0',  'unit': ('永远', 'forever')},
    'standard': {'usd': '$19', 'unit': ('一次性', 'one-time')},
    'featured': {'usd': '$39', 'unit': ('一次性', 'one-time')},
    'pro':      {'usd': '$69', 'unit': ('一次性', 'one-time')},
    'board':    {'usd': '$29', 'unit': ('/ 周', '/ week')},
    'sidebar':  {'usd': '$19', 'unit': ('/ 周', '/ week')},
    # Buying a block is the second axis of choice: same slot, cheaper week.
    'board4':   {'usd': '$99', 'unit': ('/ 4 周', '/ 4 weeks')},
    'sidebar4': {'usd': '$65', 'unit': ('/ 4 周', '/ 4 weeks')},
}


def money(key, zh=None):
    """('$29', '一次性' | 'one-time') for the language being rendered."""
    p = PLANS[key]
    zh = (LANG == 'zh') if zh is None else zh
    return p['usd'], p['unit'][0 if zh else 1]


# SLA lines shared by the submit form, pricing page and FAQs. The paid line
# is the one a buyer checks against the order modal: same day only after a
# person confirms the money, never "no review, live the moment you click".
FREE_SLA = (
    'usually 7–14 days, not guaranteed; busy periods can take longer',
    '通常 7–14 天，不保证；高峰可能更长',
)
PAID_SLA = (
    'Live the same day payment is confirmed (we confirm receipt by hand)',
    '付款确认后当天上线（人工确认收款）',
)
MAIL_NOTE = (
    'Email notices are sent only after the site owner turns them on. Until then, check My submissions.',
    '邮件通知需站长开启；未开启时请在「我的提交」查看进度。',
)
# Pro's reply SLA is the same gate as MAIL_NOTE: no 24-hour promise until
# the owner has actually turned email on.
PRO_REPLY = (
    'a reply within 24 hours after the site owner turns email on',
    '站长开启邮件后 24h 内回复',
)


def sla(pair, zh=None):
    zh = (LANG == 'zh') if zh is None else zh
    return pair[1 if zh else 0]


def sla_stop(zh=None):
    """Sentence stop for the language being rendered. English pages use `.`."""
    zh = (LANG == 'zh') if zh is None else zh
    return '。' if zh else '.'


def pin_active(t, today=None):
    """True while this listing's placement has not expired.

    A paid pin is a *rented* placement — "7 days on the homepage" has to mean
    seven days. featured_until was already being written into the data and
    read by nobody, so every pin was permanent and the copy was a promise the
    build could not keep.
    """
    if not (t.get('is_paid') or t.get('is_featured')):
        return False
    until = _as_date(t.get('featured_until'))
    if until is None:
        # Rows created before the column existed carry no date. Leaving them
        # pinned is the safer error: pulling a placement someone paid for is
        # worse than showing it a few days too long.
        return True
    return until >= (today or BUILD_DATE)


# Expired pins stay listed and keep their link — only the *placement* ends.
for _t in TOOL_LIST:
    _t['pin'] = pin_active(_t)

# Operator overrides (data/tool-overrides.json) sit on top of the data: an
# unpublish here has to beat whatever mvp.json says, or the admin console's
# "unpublish" button would keep being decorative.
try:
    import overrides as _ov_mod
except Exception:  # noqa: BLE001 - a missing module must not stop a build
    _ov_mod = None
_OVERRIDES = _ov_mod.load() if _ov_mod else {}
for _t in TOOL_LIST:
    _o = _OVERRIDES.get(_t['slug']) or {}
    _t['hidden'] = bool(_o.get('hidden'))
    if _o.get('pin') and not _t['hidden']:
        _until = _as_date(_o.get('until'))
        _t['pin'] = (_until is None) or (_until >= BUILD_DATE)

VISIBLE = [t for t in TOOL_LIST if not t.get('hidden')]

LANGS = ('en', 'zh')
LANG = 'en'          # set per page
PATH = 'index.html'  # path inside the language tree


# --------------------------------------------------------------------------
# text
# --------------------------------------------------------------------------
T = {
    'browse': ('Browse', '浏览'),
    'more': ('More', '更多'),
    'discover': ('Discover', '发现'),
    'tools': ('Products', '产品'),
    'categories': ('Categories', '分类'),
    'makers': ('Makers', '开发者'),
    'pricing': ('Pricing', '定价'),
    'tags': ('Tags', '标签'),
    'seo_check': ('SEO check', 'SEO 诊断'),
    'weekly': ('Weekly', '周榜'),
    'just_added': ('Just added', '最新收录'),
    'submit': ('Submit a product', '提交产品'),
    'dashboard': ('My submissions', '我的提交'),
    'admin': ('Admin', '后台管理'),
    'signin': ('Sign In', '登录'),
    'signout': ('Sign out', '退出'),
    'search': ('Search products…', '搜索产品…'),
    'promo_title': ('Built something great?', '做了个好东西？'),
    'promo_body': ('Submit your product and reach people looking for it.',
                   '提交你的产品，触达正在寻找它的人。'),
    'promo_btn': ('Submit', '提交'),
    'footer_tag': ('Launch your product. Keep the backlink.',
                   '发布你的产品，反链永久保留。'),
    'directory': ('Directory', '目录'),
    'resources': ('Resources', '资源'),
    'popular_cats': ('Popular categories', '热门分类'),
    'popular_tools': ('Popular products', '热门产品'),
    'legal': ('Legal', '法律条款'),
    'more_cats': ('More categories →', '更多分类 →'),
    'more_tools': ('More products →', '更多产品 →'),
    'privacy': ('Privacy Policy', '隐私政策'),
    'terms': ('Terms of Service', '服务条款'),
    'view_all': ('View all', '查看全部'),
    'view_details': ('View details', '查看详情'),
    'view_details': ('View details', '查看详情'),
    'featured': ('Featured', '精选'),
    'sponsored': ('Sponsored', '赞助'),
    'vote': ('Vote', '投票'),
    'voted': ('Voted', '已投票'),
    'votes': ('votes', '票'),
    'visit': ('Visit website', '访问官网'),
    'all': ('All', '全部'),
    'top_picks': ('Top picks', '本周热门'),
    'top_picks_sub': ('Ranked by votes this week', '按本周票数排序'),
    'popular_tags': ('Popular tags', '热门标签'),
    'back_home': ('Back to home', '返回首页'),
    'lang_switch': ('中文', 'English'),
    'lang_label': ('Switch language', '切换语言'),
    'copy': ('© 2026 Product Atlas. All rights reserved.', '© 2026 Product Atlas 保留所有权利。'),
}

# user settings area -------------------------------------------------------
T.update({
    'set_overview': ('Overview', '概览'),
    'set_grp_activity': ('Activity', '活动'),
    'set_submissions': ('My submissions', '我的提交'),
    'set_ads': ('My ads', '我的广告'),
    'set_grp_account': ('Account', '账户'),
    'set_profile': ('Profile', '个人资料'),
    'set_credits': ('Credits', '积分'),
    'set_billing': ('Billing', '账单'),
    'set_payments': ('Payment history', '付款记录'),
    'set_grp_content': ('Content', '内容'),
    'set_tickets': ('Support', '支持'),
    'set_home': ('Home', '首页'),
    'set_welcome': ('Welcome back,', '欢迎回来，'),
    'set_plan': ('Plan', '套餐'),
    'set_free': ('Free', '免费版'),
    'set_pro': ('Pro', '专业版'),
    'set_plan_note': ('Upgrade for more credits and features', '升级以获得更多积分和功能'),
    'set_upgrade': ('Upgrade', '升级'),
    'set_balance': ('Balance', '余额'),
    'set_balance_note': ('Your available credits', '你的可用积分余额'),
    'set_buy_credits': ('Buy credits', '购买积分'),
    'set_support': ('Support', '工单支持'),
    'set_no_reply': ('No new replies', '暂无新回复'),
    'set_recent_payments': ('Recent payments', '最近付款'),
    'set_credit_log': ('Credit activity', '积分变动'),
    'set_no_payments': ('No payments yet', '暂无付款记录'),
    'set_no_credits': ('No credit activity yet', '暂无积分记录'),
    'set_subs_sub': ('Every tool you submitted. Edit it, preview it, or upgrade — paid tiers go live the day payment is confirmed.',
                     '你提交的所有工具。可以编辑和预览；付费档在确认收款当天上线。'),
    'set_become_sponsor': ('Become a sponsor', '成为赞助商'),
    'set_no_subs': ("You haven't submitted a tool yet.", '你还没有提交过工具。'),
    'set_submit_tool': ('Submit a tool', '提交工具'),
    'set_ads_sub': ('Sponsorship slots you booked and when they run.',
                    '你预订的赞助广告及投放时间。'),
    'set_manage_sub': ('Manage subscription', '管理订阅'),
    'set_book_ad': ('Book a slot', '预订广告'),
    'set_no_ads': ("You haven't booked an ad yet.", '你还没有预订广告。'),
    'set_ads_note': ('Ads renew with your monthly subscription. After cancelling in Billing, '
                     'your ad keeps running until the end of the paid month.',
                     '广告随月度订阅自动续期。在「账单」中取消订阅后，广告会展示到已付费月份结束。'),
    'set_profile_sub': ('Manage your account', '管理你的账户'),
    'set_avatar': ('Avatar', '头像'),
    'set_upload': ('Upload', '上传'),
    'set_avatar_hint': ('Drag an image, click to upload, or paste from clipboard',
                        '拖拽图片、点击上传，或从剪贴板粘贴'),
    'set_name': ('Name', '姓名'),
    'set_email': ('Email', '邮箱'),
    'set_save': ('Save', '保存'),
    'set_credits_sub': ('Your credit balance and activity', '你的积分余额和变动记录'),
    'set_earn': ('Earned', '获得'),
    'set_spend': ('Spent', '消耗'),
    'set_billing_sub': ('Manage your subscriptions', '管理你的订阅'),
    'set_current_sub': ('Current subscription', '当前订阅'),
    'set_subscribe_now': ('Subscribe', '立即订阅'),
    'set_no_active_sub': ('No active subscription', '暂无活跃订阅'),
    'set_active': ('Active', '活跃'),
    'set_trial': ('Trialing', '试用中'),
    'set_paused': ('Paused', '已暂停'),
    'set_expired': ('Expired', '已过期'),
    'set_canceling': ('Ending soon', '待取消'),
    'set_canceled': ('Canceled', '已取消'),
    'set_payments_sub': ('Your payment history', '你的付款历史'),
    'set_one_time': ('One-time', '单次购买'),
    'set_subscription': ('Subscription', '订阅'),
    'set_renewal': ('Renewal', '续订'),
    'set_all_status': ('All statuses', '全部状态'),
    'set_tickets_sub': ('Email us. After the site owner turns email on, paid listings get a reply within 24 hours.',
                        '有问题直接发邮件。站长开启邮件后，付费收录 24h 内回复。'),
    'set_new_ticket': ('New ticket', '提交工单'),
    'set_no_tickets': ('No tickets yet', '暂无工单'),
    'set_search': ('Search…', '搜索…'),
    'set_col_subid': ('Subscription', '订阅号'),
    'set_col_plan': ('Plan', '套餐'),
    'set_col_cycle': ('Cycle', '周期'),
    'set_col_status': ('Status', '状态'),
    'set_col_amount': ('Amount', '金额'),
    'set_col_current': ('Current period', '当前周期'),
    'set_col_end': ('Ends', '结束时间'),
    'set_col_date': ('Date', '日期'),
    'set_col_actions': ('Actions', '操作'),
    'set_col_no': ('Ref', '流水号'),
    'set_col_desc': ('Description', '说明'),
    'set_col_type': ('Type', '类型'),
    'set_col_scene': ('Scene', '场景'),
    'set_col_points': ('Credits', '积分'),
    'set_col_remain': ('Balance', '剩余'),
    'set_col_expire': ('Expires', '过期时间'),
    'set_col_order': ('Order', '订单号'),
    'set_col_item': ('Item', '商品'),
    'set_col_method': ('Method', '支付方式'),
    'set_col_invoice': ('Invoice', '发票'),
    'set_col_created': ('Created', '创建时间'),
    'set_col_title': ('Title', '标题'),
    'set_col_latest': ('Latest reply', '最新回复'),
    'set_col_updated': ('Updated', '更新时间'),
    'set_records': ('records', '条记录'),
    'set_total': ('Total', '共'),
    'set_cancel': ('Cancel', '取消'),
    'set_confirm': ('Confirm', '确认'),
    'set_monthly': ('Monthly', '月度订阅'),
    'set_yearly': ('Yearly', '年度订阅'),
    'set_per_month': ('/mo', '/月'),
    'set_per_year': ('/yr', '/年'),
    'set_save_2mo': ('2 months free', '省 2 个月'),
    'set_choose_plan': ('Choose a plan', '选择套餐'),
    'set_choose_pack': ('Choose a credit pack', '选择积分包'),
    'set_invoice_sent': ('Ask the site owner for an invoice. Email notices need to be turned on first.',
                         '发票请向站长索取。邮件通知需站长开启。'),
    'set_saved': ('Saved', '已保存'),
    'set_copied': ('Copied', '已复制'),
    'set_ticket_title': ('Subject', '标题'),
    'set_ticket_body': ('Describe the issue', '问题描述'),
    'set_ticket_sent': ('Ticket created', '工单已创建'),
    'set_subscribed_ok': ('Subscription active', '订阅已开通'),
    'set_credits_added': ('Credits added', '积分已到账'),
    'set_cancel_sub': ('Cancel subscription', '取消订阅'),
    'set_canceled_ok': ('Subscription will end at the period end', '订阅将在本期结束后停止'),
    'set_login_required': ('Please sign in first', '请先登录'),
})


def t(key):
    en, zh = T[key]
    return zh if LANG == 'zh' else en


def L(d, base):
    """Bilingual field lookup with English fallback."""
    if LANG == 'zh':
        v = d.get(f'{base}_zh')
        if v:
            return v
    return d.get(f'{base}_en', '')


def esc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


# --------------------------------------------------------------------------
# icons (lucide)
# --------------------------------------------------------------------------
ICONS = {
    'compass': '<circle cx="12" cy="12" r="9"/><path d="M12 7.1l1.42 3.48L16.9 12l-3.48 1.42L12 16.9l-1.42-3.48L7.1 12l3.48-1.42z"/>',
    'layout-grid': '<rect width="7.5" height="7.5" x="3" y="3" rx="2.2"/><rect width="7.5" height="7.5" x="13.5" y="3" rx="2.2"/><rect width="7.5" height="7.5" x="3" y="13.5" rx="2.2"/><rect width="7.5" height="7.5" x="13.5" y="13.5" rx="2.2" fill="currentColor" stroke="none"/>',
    'shapes': '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
    'hash': '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
    'activity': '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    'trophy': '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    'sparkles': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'panel-left': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    'globe': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'arrow-left': '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    'arrow-up-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    'code': '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    'image': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    'video': '<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>',
    'music': '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    'pen-line': '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
    'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'calendar': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'tag': '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    'credit-card': '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    'external': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'trash': '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'edit': '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    'inbox': '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    'bar-chart': '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
    'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    'gauge': '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'loader': '<path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/>',
    'coins': '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    'life-buoy': '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
    'megaphone': '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    'receipt': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    'more-vertical': '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
    'home': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    'wallet': '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
}


USED_ICONS = set()


def icon(name, cls='', size=None):
    """Emit a <use> reference; page() inlines one <symbol> per icon used."""
    USED_ICONS.add(name)
    style = f' style="width:{size}px;height:{size}px"' if size else ''
    c = 'ic' + (f' {cls}' if cls else '')
    return f'<svg class="{c}" aria-hidden="true"{style}><use href="#i-{name}"/></svg>'


def build_sprite():
    syms = ''.join(
        f'<symbol id="i-{n}" viewBox="0 0 24 24">{ICONS[n]}</symbol>'
        for n in sorted(USED_ICONS))
    return f'<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">{syms}</svg>'


# --------------------------------------------------------------------------
# routing
# --------------------------------------------------------------------------
def R():
    """Depth of the current page INSIDE its language tree (for page links).

    /zh/settings/billing.html -> '../'   (reaches /zh/)
    /zh/tools.html            -> ''      (already at /zh/)
    /settings/billing.html    -> '../'   (reaches /)
    """
    return '../' * PATH.count('/')


def RA():
    """Depth from the current page to the SITE root (for assets).

    Assets live at /assets/..., never inside the language tree, so a zh page
    needs one extra level up.
    """
    return '../' * (PATH.count('/') + (1 if LANG == 'zh' else 0))


def u(path):
    """Language-relative URL — page links stay inside the current language."""
    return R() + path


def a(path):
    """Site-root-relative URL — for css/js/img/fonts."""
    return RA() + path


_VER_CACHE = {}


def _asset_ver(rel):
    """Short content hash so a CSS/JS edit busts the browser cache."""
    if rel in _VER_CACHE:
        return _VER_CACHE[rel]
    fp = os.path.join(ROOT, rel)
    try:
        with open(fp, 'rb') as fh:
            ver = hashlib.md5(fh.read()).hexdigest()[:8]
    except OSError:
        ver = '0'
    _VER_CACHE[rel] = ver
    return ver


def au(path):
    """Asset URL with cache-busting version query."""
    return a(path) + '?v=' + _asset_ver(path)


def abs_url(path, lang=None):
    lang = lang or LANG
    prefix = '/zh/' if lang == 'zh' else '/'
    return SITE + prefix + path


def url_tool(slug):
    return u(f'tools/{slug}.html')


def url_cat(slug):
    return u(f'categories/{slug}.html')


def url_tag(slug):
    return u(f'tags/{slug}.html')


def maker_slug(name):
    """'Otter.ai' -> 'otter-ai', 'Leonardo Interactive' -> 'leonardo-interactive'."""
    s = re.sub(r'[^a-z0-9]+', '-', (name or '').lower()).strip('-')
    return s or 'maker'


def url_maker(name):
    return u(f'makers/{maker_slug(name)}.html')


def at(path):
    """Set the page path so relative URLs resolve correctly."""
    global PATH
    PATH = path
    USED_ICONS.clear()


def other_lang_href():
    if LANG == 'zh':
        # zh -> en: climb out of /zh/ to the site root
        return RA() + PATH
    return R() + 'zh/' + PATH


# --------------------------------------------------------------------------
# queries
# --------------------------------------------------------------------------
def cat(slug):
    return next(c for c in CATS if c['slug'] == slug)


def tag(slug):
    return next(t for t in TAGS if t['slug'] == slug)


def featured_tools():
    """PRD §3.1: paid pins first, then editorial picks.

    Both are placements with an end date. An expired pin is still a listing —
    it just stops being pinned, which is exactly what "7 days on the homepage"
    is supposed to mean.
    """
    live = [t for t in VISIBLE if t['pin']]
    paid = [t for t in live if t['is_paid']]
    rest = [t for t in live if not t['is_paid']]
    return paid + rest


def ordered_tools():
    """Every listing, in the order a visitor sees them.

    Three bands, because the pricing page sells three different positions:
    pinned (Featured / Pro) → paid but not pinned (Standard) → everything else
    (Free). Without the middle band, Standard's "listed above the free queue"
    would be a line on a pricing table that the build never honoured.
    """
    seen = set()
    out = []
    for band in (featured_tools(),
                 [t for t in VISIBLE if t['is_paid']],
                 VISIBLE):
        for t in band:
            if t['slug'] not in seen:
                seen.add(t['slug'])
                out.append(t)
    return out


def by_votes(n=None):
    s = sorted(VISIBLE, key=lambda t: -t['votes_week'])
    return s[:n] if n else s


def by_newest(n=None):
    s = sorted(VISIBLE, key=lambda t: t['created_at'], reverse=True)
    return s[:n] if n else s


def fmt_date(iso):
    try:
        d = datetime.strptime(iso, '%Y-%m-%d').date()
    except Exception:
        return iso
    if LANG == 'zh':
        return f'{d.year} 年 {d.month} 月 {d.day} 日'
    return d.strftime('%b %-d, %Y')


def rel_day(iso):
    try:
        d = datetime.strptime(iso, '%Y-%m-%d').date()
    except Exception:
        return fmt_date(iso)
    # Measured against the real clock, not TODAY: a submission approved today
    # would otherwise render as "-2 days ago" on a build that predates it, and
    # the server keeps rendering cards long after the last build.
    delta = max(0, (date.today() - d).days)
    if LANG == 'zh':
        if delta == 0:
            return '今天'
        if delta == 1:
            return '昨天'
        if delta < 7:
            return f'{delta} 天前'
        return fmt_date(iso)
    if delta == 0:
        return 'today'
    if delta == 1:
        return 'yesterday'
    if delta < 7:
        return f'{delta} days ago'
    return fmt_date(iso)


def num(n):
    return f'{n:,}'


# --------------------------------------------------------------------------
# chrome
# --------------------------------------------------------------------------
NAV_BROWSE = [
    ('home', 'discover', 'index.html', 'compass'),
    ('tools', 'tools', 'tools.html', 'layout-grid'),
    ('categories', 'categories', 'categories.html', 'shapes'),
    ('makers', 'makers', 'makers.html', 'user'),
    ('pricing', 'pricing', 'pricing.html', 'credit-card'),
    ('seo-check', 'seo_check', 'seo-check.html', 'gauge'),
    ('weekly', 'weekly', 'weekly.html', 'trophy'),
    ('just-added', 'just_added', 'just-added.html', 'activity'),
]
NAV_MORE = [
    ('submit', 'submit', 'submit.html', 'plus'),
    ('dashboard', 'dashboard', 'settings/submissions.html', 'inbox'),
]
# The admin console is deliberately absent from every nav: it is the owner's
# page, not a user feature. It is reachable only at /admin.html?token=…
# (serve.py refuses to render it without a valid token).


def nav_item(active, key, label_key, href, ic):
    cls = 'nav-item is-active' if active == key else 'nav-item'
    cur = ' aria-current="page"' if active == key else ''
    return (f'<li><a class="{cls}" href="{u(href)}"{cur}>{icon(ic)}{t(label_key)}</a></li>')


def brand():
    return f'''<a class="brand" href="{u('index.html')}">
  <img src="{a('assets/img/brand/logo.png')}" alt="{SITE_NAME}" width="28" height="28">
  <span>{SITE_NAME}</span>
</a>'''


def sidebar(active):
    return f'''<aside class="sidebar">
  <div class="sidebar__brand">{brand()}</div>
  <div class="sidebar__body">
    <nav class="sidebar__nav">
      <div class="nav-group">
        <p class="nav-group__label">{t('browse')}</p>
        <ul class="nav-list">{''.join(nav_item(active, *n) for n in NAV_BROWSE)}</ul>
      </div>
      <div class="nav-group">
        <p class="nav-group__label">{t('more')}</p>
        <ul class="nav-list">{''.join(nav_item(active, *n) for n in NAV_MORE)}</ul>
      </div>
    </nav>
    <div class="sidebar__promo">
      <p>{t('promo_title')}</p>
      <p>{t('promo_body')}</p>
      <a class="btn btn--primary" href="{u('submit.html')}">{icon('plus')}{t('promo_btn')}</a>
    </div>
  </div>
</aside>'''


def topbar():
    return f'''<header class="topbar">
  <div class="topbar__inner">
    <button class="icon-btn topbar__toggle" type="button" aria-label="Toggle sidebar" title="Toggle sidebar" data-drawer-open>
      {icon('panel-left', size=20)}
    </button>
    <div class="topbar__logo">{brand()}</div>
    <div class="topbar__search-wrap">
      <button class="search-trigger" type="button" aria-label="{t('search')}" data-search-open>
        {icon('search')}<span>{t('search')}</span><kbd>⌘K</kbd>
      </button>
    </div>
    <div class="topbar__actions">
      <a class="topbar__link" href="{u('pricing.html')}">{t('pricing')}</a>
      <a class="btn btn--ghost topbar__submit" href="{u('submit.html')}">{icon('plus')}{t('promo_btn')}</a>
      <div class="topbar__extras">
        <a class="icon-btn" href="{other_lang_href()}" hreflang="{'en' if LANG == 'zh' else 'zh-Hans'}" aria-label="{t('lang_label')}" title="{t('lang_switch')}">
          {icon('globe', size=16)}<span class="sr-only">{t('lang_label')}</span>
        </a>
        <button class="icon-btn" type="button" data-theme-toggle>
          <span class="theme-sun">{icon('sun', size=16)}</span>
          <span class="theme-moon">{icon('moon', size=16)}</span>
          <span class="sr-only">Toggle theme</span>
        </button>
      </div>
      <a class="btn btn--primary" href="{u('sign-in.html')}" data-auth-label>{t('signin')}</a>
    </div>
  </div>
</header>'''


def footer():
    col1 = [('tools', 'tools.html'), ('categories', 'categories.html'),
            ('makers', 'makers.html'), ('seo_check', 'seo-check.html'),
            ('tags', 'tags.html'), ('weekly', 'weekly.html'),
            ('just_added', 'just-added.html')]
    col2 = [('pricing', 'pricing.html'), ('submit', 'submit.html'),
            ('dashboard', 'settings/submissions.html')]
    c1 = ''.join(f'<li><a href="{u(h)}">{t(k)}</a></li>' for k, h in col1)
    c2 = ''.join(f'<li><a href="{u(h)}">{t(k)}</a></li>' for k, h in col2)
    cats = ''.join(f'<li><a href="{url_cat(c["slug"])}">{esc(L(c, "name"))}</a></li>' for c in CATS)
    tools = ''.join(f'<li><a href="{url_tool(x["slug"])}">{esc(L(x, "name"))}</a></li>'
                    for x in by_votes(6))
    legal = (f'<li><a href="{u("privacy-policy.html")}">{t("privacy")}</a></li>'
             f'<li><a href="{u("terms-of-service.html")}">{t("terms")}</a></li>')
    return f'''<footer class="footer">
  <div class="footer__inner">
    <p class="footer__tagline">{t('footer_tag')}</p>
    <div class="footer__cols">
      <nav aria-label="{t('directory')}"><h3>{t('directory')}</h3><ul>{c1}</ul></nav>
      <nav aria-label="{t('resources')}"><h3>{t('resources')}</h3><ul>{c2}{legal}</ul></nav>
      <nav aria-label="{t('popular_cats')}"><h3>{t('popular_cats')}</h3><ul>{cats}</ul></nav>
      <nav aria-label="{t('popular_tools')}"><h3>{t('popular_tools')}</h3><ul>{tools}</ul></nav>
    </div>
  </div>
  <div class="footer__bottom">
    <div class="footer__bottom-inner">
      <span>{t('copy')}</span>
      <span>{'免费提交 · 付费置顶' if LANG == 'zh' else 'Free to submit · Paid to feature'}</span>
    </div>
  </div>
</footer>'''


def search_modal():
    idx = [{
        'name': L(x, 'name'),
        'alt': x['name_en'],
        'desc': L(x, 'short'),
        'category': L(cat(x['category']), 'name'),
        'tags': x['tags'],
        'votes': x['votes_week'],
        'featured': x['pin'],
        'icon': a(x['logo']),
        'url': url_tool(x['slug']),
    } for x in by_votes()]
    payload = json.dumps(idx, ensure_ascii=False).replace('</', '<\\/')
    return f'''<div class="modal-root" id="search-root" role="dialog" aria-modal="true" aria-label="{t('search')}">
  <div class="modal-overlay" data-search-close></div>
  <div class="modal">
    <div class="modal__search">
      {icon('search')}
      <input id="search-input" type="text" placeholder="{t('search')}" autocomplete="off" spellcheck="false">
      <span class="modal__esc">Esc</span>
    </div>
    <div class="modal__body" id="search-results"></div>
    <div class="modal__foot">
      <span><kbd>↑</kbd><kbd>↓</kbd> {'切换' if LANG == 'zh' else 'to navigate'}</span>
      <span><kbd>↵</kbd> {'选中' if LANG == 'zh' else 'to select'}</span>
      <span><kbd>esc</kbd> {'关闭' if LANG == 'zh' else 'to close'}</span>
    </div>
  </div>
</div>
<script type="application/json" id="search-data">{payload}</script>'''


def drawer():
    return f'''<div class="drawer-root" id="drawer-root" role="dialog" aria-modal="true" aria-label="Menu">
  <div class="modal-overlay" data-drawer-close></div>
  <div class="drawer">
    <div class="sidebar__brand">{brand()}</div>
    <nav class="sidebar__nav">
      <div class="nav-group">
        <p class="nav-group__label">{t('browse')}</p>
        <ul class="nav-list">{''.join(nav_item('', *n) for n in NAV_BROWSE)}</ul>
      </div>
      <div class="nav-group">
        <p class="nav-group__label">{t('more')}</p>
        <ul class="nav-list">{''.join(nav_item('', *n) for n in NAV_MORE)}</ul>
      </div>
    </nav>
    <div class="drawer__foot">
      <a class="icon-btn" href="{other_lang_href()}" aria-label="{t('lang_label')}">{icon('globe', size=16)}</a>
      <button class="icon-btn" type="button" data-theme-toggle>
        <span class="theme-sun">{icon('sun', size=16)}</span>
        <span class="theme-moon">{icon('moon', size=16)}</span>
        <span class="sr-only">Toggle theme</span>
      </button>
      <a class="btn btn--primary" style="margin-left:auto" href="{u('sign-in.html')}">{t('signin')}</a>
    </div>
  </div>
</div>'''


THEME_INIT = ("<script>(function(){try{var t=localStorage.getItem('dir-theme');"
              "if(t==='dark'){document.documentElement.classList.remove('light');"
              "document.documentElement.classList.add('dark');"
              "document.documentElement.style.colorScheme='dark';}}catch(e){}})();</script>")


def page(title, desc, content, active, path, extra_head='', body_class='', noindex=False,
         robots=None):
    global PATH
    PATH = path
    lang_attr = 'zh-Hans' if LANG == 'zh' else 'en'
    if robots:
        robots = f'<meta name="robots" content="{robots}">\n'
    else:
        robots = ('<meta name="robots" content="noindex,nofollow">\n' if noindex else '')
    sb, tb, ft = sidebar(active), topbar(), footer()
    sm, dr = search_modal(), drawer()
    sprite = build_sprite()
    head_extra = (
        f'<link rel="canonical" href="{abs_url(path)}">\n'
        f'<link rel="alternate" hreflang="en" href="{abs_url(path, "en")}">\n'
        f'<link rel="alternate" hreflang="zh-Hans" href="{abs_url(path, "zh")}">\n'
        f'<link rel="alternate" hreflang="x-default" href="{abs_url(path, "en")}">\n'
    )
    return f'''<!DOCTYPE html>
<html lang="{lang_attr}" class="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
{robots}<meta name="generator" content="Product Atlas">
{head_extra}<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{SITE_NAME}">
<meta property="og:locale" content="{'zh_CN' if LANG == 'zh' else 'en_US'}">
<meta property="og:locale:alternate" content="{'en_US' if LANG == 'zh' else 'zh_CN'}">
<meta property="og:url" content="{abs_url(path)}">
<meta property="og:image" content="{SITE}/assets/img/brand/og-{'zh' if LANG == 'zh' else 'en'}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{SITE}/assets/img/brand/og-{'zh' if LANG == 'zh' else 'en'}.jpg">
<link rel="icon" href="{a('assets/img/brand/logo.png')}">
<link rel="stylesheet" href="{au('assets/css/style.css')}">
{THEME_INIT}
{extra_head}
</head>
<body class="{body_class}" data-lang="{LANG}" data-root="{R()}" data-assetroot="{RA()}">
{sprite}
<div class="shell">
{sb}
<div class="main">
{tb}
<main>{content}</main>
{ft}
</div>
</div>
{sm}
{dr}
<script src="{au('assets/js/app.js')}"></script>
</body>
</html>'''


# --------------------------------------------------------------------------
# components
# --------------------------------------------------------------------------
def vote_btn(x, small=False, count=None):
    cls = 'vote vote--sm' if small else 'vote'
    n = x["votes_week"] if count is None else count
    return (f'<button class="{cls}" type="button" data-vote="{x["slug"]}" '
            f'data-count="{n}" aria-label="{t("vote")} {esc(L(x, "name"))}">'
            f'{icon("arrow-up")}<span data-vote-count>{num(n)}</span></button>')


def tool_card(x, order=0):
    star = (f'<span class="star" title="{t("featured")}">{icon("sparkles")}'
            f'<span class="sr-only">{t("featured")}</span></span>') if x['pin'] else ''
    chips = ''
    if x['is_paid'] and x['pin']:
        chips += f'<span class="chip chip--paid">{t("sponsored")}</span>'
    chips += f'<span class="chip">{esc(L(cat(x["category"]), "name"))}</span>'
    # A paid pin counts as "featured" for the default sort. Without this the
    # client-side sort only promotes editorial picks, so a new free community
    # listing tied on data-order and outranked the placements people paid for.
    return f'''<div class="tool-card" data-tool data-slug="{x['slug']}" data-category="{x['category']}" data-name="{esc(L(x, 'name'))}" data-created="{x['created_at']}" data-votes="{x['votes_week']}" data-featured="{1 if x['pin'] else 0}" data-order="{order}">
  <div class="tool-card__top">
    <div class="tool-icon" style="width:44px;height:44px"><img src="{a(x['logo'])}" alt="" width="44" height="44" loading="lazy"></div>
    <div class="tool-card__body">
      <div class="tool-card__name">
        <h3><a href="{url_tool(x['slug'])}">{esc(L(x, 'name'))}</a></h3>{star}
      </div>
      <p class="tool-card__desc">{esc(L(x, 'short'))}</p>
    </div>
  </div>
  <div class="tool-card__foot">{chips}{vote_btn(x, small=True)}</div>
</div>'''


def tool_grid(tools, community=None):
    """`community` leaves an injection point the server fills at request time
    with listings that went live after the last build.

    The static build cannot know about a submission approved at 2am, so the
    slot ships as an HTML comment and serve.py splices cards into it. Values:
    'all' | 'cat:<slug>' | 'tag:<name>' — the server filters accordingly.
    """
    marker = f'<!--community:{community}-->' if community else ''
    return '<div class="tool-grid">' + marker + ''.join(
        tool_card(x, i) for i, x in enumerate(tools)) + '</div>'


def feed_row(x):
    """One row in the "Just added" feed. Shared with the runtime renderer."""
    return f'''<li><a class="feed-row" href="{url_tool(x['slug'])}">
  <span class="tool-icon" style="width:40px;height:40px"><img src="{a(x['logo'])}" alt="" width="40" height="40" loading="lazy"></span>
  <span class="feed-row__body">
    <span class="feed-row__title"><strong>{esc(L(x, 'name'))}</strong>{'<span class="star">' + icon('sparkles') + '</span>' if x['pin'] else ''}</span>
    <span class="feed-row__desc">{esc(L(x, 'short'))}</span>
  </span>
  <span class="feed-row__meta"><time datetime="{x['created_at']}">{rel_day(x['created_at'])}</time><span class="chip">{esc(L(cat(x['category']), 'name'))}</span></span>
</a></li>'''


def section_head(title, sub='', more_label='', more_href='', stack=False):
    cls = 'section-head section-head--stack' if stack else 'section-head'
    inner = f'<h2>{title}</h2>'
    if sub:
        inner += f'<p>{sub}</p>'
    more = ''
    if more_label:
        more = f'<a class="more" href="{more_href}">{more_label}{icon("arrow-right")}</a>'
    return f'<div class="{cls}"><div class="section-head__title">{inner}</div>{more}</div>'


# --------------------------------------------------------------------------
# Ask AI strip  — GEO, not just SEO
# --------------------------------------------------------------------------
AI_ENGINES = [
    ('ChatGPT', 'https://chatgpt.com/?q=', '#10a37f'),
    ('Claude', 'https://claude.ai/new?q=', '#d97757'),
    ('Perplexity', 'https://www.perplexity.ai/search?q=', '#20808d'),
    ('Grok', 'https://grok.com/?q=', '#1a1a1a'),
    ('DeepSeek', 'https://chat.deepseek.com/?q=', '#4d6bfe'),
]


def ask_ai_block(x):
    """Pre-filled AI-chat links under the product title.

    JSON-LD tells a crawler what the page *is*; it does not make a model quote
    the page. Each link below opens a chat with the product name and its
    one-liner already typed in, so the visitor never has to assemble a prompt
    — and every link is a crawlable, context-bearing path into this listing.
    That is the whole point of the "discovered by Google and AI search" pitch.
    """
    name = L(x, 'name')
    short = L(x, 'short')
    if LANG == 'zh':
        q = f'请介绍「{name}」：{short}'
    else:
        q = f'Summarise "{name}" — {short}'
    enc = quote(q)
    links = ''.join(
        f'<a class="ask-ai__link" style="--dot:{dot}" href="{base}{enc}" '
        f'target="_blank" rel="nofollow noopener">{lab}</a>'
        for lab, base, dot in AI_ENGINES)
    label = '问 AI' if LANG == 'zh' else 'Ask AI'
    hint = ('让 AI 替你读这一页' if LANG == 'zh' else 'Let an assistant read this page')
    return f'''<div class="ask-ai">
  <span class="ask-ai__label">{label}</span>
  <span class="ask-ai__links">{links}</span>
  <span class="ask-ai__hint">{hint}</span>
</div>'''


def cat_tile(c):
    return f'''<a class="cat-tile" href="{url_cat(c['slug'])}">
  <span class="cat-tile__icon">{icon(c['icon'])}</span>
  <span class="cat-tile__body"><p>{esc(L(c, 'name'))}</p><p>{esc(L(c, 'desc'))}</p></span>
  {icon('chevron-right')}
</a>'''


def breadcrumb(items):
    parts = []
    for i, (label, href) in enumerate(items):
        if i:
            parts.append(icon('chevron-right'))
        parts.append(f'<a href="{href}">{label}</a>' if href else f'<span>{label}</span>')
    return f'<nav class="breadcrumb" aria-label="breadcrumb">{"".join(parts)}</nav>'


def pills(active='all'):
    items = [('all', t('all'))] + [(c['slug'], L(c, 'name'))
                                   for c in sorted(CATS, key=lambda c: (-c['count'], c['slug']))]
    out = ''
    for slug, name in items:
        cls = 'pill is-active' if slug == active else 'pill'
        cur = ' aria-current="page"' if slug == active else ''
        href = u('tools.html') if slug == 'all' else u(f'tools.html?category={slug}')
        out += f'<a class="{cls}" href="{href}"{cur}>{esc(name)}</a>'
    return f'<nav class="pills scrollbar-none" aria-label="{t("categories")}">{out}</nav>'


def top_picks_block():
    """This week's top five. Lifted out of rail() so the homepage can put it
    beside the hero, where the right column would otherwise be empty."""
    picks = by_votes(5)
    items = ''
    for i, x in enumerate(picks, 1):
        cls = 'rail-item__rank is-top' if i <= 3 else 'rail-item__rank'
        items += f'''<li><a class="rail-item" href="{url_tool(x['slug'])}">
  <span class="{cls}">{i}</span>
  <span class="tool-icon" style="width:32px;height:32px"><img src="{a(x['logo'])}" alt="" width="32" height="32" loading="lazy"></span>
  <span class="rail-item__body"><p>{esc(L(x, 'name'))}</p><p>{num(x['votes_week'])} {t('votes')}</p></span>
</a></li>'''
    return f'''<section>
    {section_head(t('top_picks'), stack=True)}
    <p class="rail-sub">{t('top_picks_sub')}</p>
    <ol class="rail-list">{items}</ol>
  </section>'''


def tags_block():
    tags = ''.join(f'<a class="tag-pill" href="{url_tag(g["slug"])}">#{esc(L(g, "name"))}</a>'
                   for g in TAGS)
    return f'''<section>
    {section_head(t('popular_tags'), stack=True)}
    <div class="tag-cloud">{tags}</div>
  </section>'''


def _week_total(w):
    return sum(r['votes'] for r in w['ranking'])


def sparkline(vals, width=136, height=30):
    """A plain polyline + fill. No chart library, no axis — this is a pulse,
    not a report, so the only thing that has to read is the last point."""
    if len(vals) < 2:
        return ''
    lo, hi = min(vals), max(vals)
    span = (hi - lo) or 1
    n = len(vals)
    step = (width - 4) / (n - 1)
    pts = []
    for i, v in enumerate(vals):
        x = round(2 + i * step, 2)
        y = round(height - 3 - (v - lo) * (height - 8) / span, 2)
        pts.append(f'{x},{y}')
    line = 'M' + ' L'.join(pts)
    area = f'{line} L{pts[-1].split(",")[0]},{height} L{pts[0].split(",")[0]},{height} Z'
    last_x, last_y = pts[-1].split(',')
    return (f'<svg class="rail-heat__spark" viewBox="0 0 {width} {height}" width="{width}" '
            f'height="{height}" aria-hidden="true" preserveAspectRatio="none">'
            f'<path class="rail-heat__area" d="{area}"/>'
            f'<path class="rail-heat__line" d="{line}" fill="none"/>'
            f'<circle class="rail-heat__dot" cx="{last_x}" cy="{last_y}" r="2.5"/></svg>')


def rail_heat_card():
    """The most recent archived week, against the week before it.

    Two things this card must not do. It must not invent a visitor counter —
    that is the competitor's move, and it costs nothing but credibility. And it
    must not draw "this week" as an extra sixth point: `votes_week` in the seed
    data *is* the most recent archived week, so appending it repeated the last
    point and made the delta read "flat" — a number compared against itself.
    Five archived weeks, one honest comparison, and the date range spelled out
    so anyone can check the arithmetic.
    """
    totals = [_week_total(w) for w in WEEKS]       # newest → oldest
    series = list(reversed(totals))                # oldest → newest, for the line
    latest = totals[0]
    prev = totals[1] if len(totals) > 1 else latest
    delta = latest - prev
    pct = round(100 * delta / prev) if prev else 0
    # A genuinely flat week is a real result, not a 0% win — say "flat" rather
    # than printing "+0%", which reads like a broken counter.
    if delta == 0:
        change, tone = ('持平' if LANG == 'zh' else 'flat'), 'is-flat'
    else:
        change = f'{"+" if delta > 0 else ""}{pct}%'
        tone = 'is-up' if delta > 0 else 'is-down'

    span = (WEEKS[0]['label_zh'] if LANG == 'zh' else WEEKS[0]['label_en'])
    span = span.replace(', 2026', '')
    if LANG == 'zh':
        label, unit, vs = '上周票数', '票', '较前一周'
        foot = f'{span} · 每周总票数'
    else:
        label, unit, vs = 'Last week', 'votes', 'vs the week before'
        foot = f'{span} · weekly totals'
    return f'''<div class="rail-heat">
  <div class="rail-heat__top">
    <span class="rail-heat__label">{label}</span>
    <span class="rail-heat__delta {tone}">{change} <em>{vs}</em></span>
  </div>
  <p class="rail-heat__num">{num(latest)}<span>{unit}</span></p>
  {sparkline(series)}
  <p class="rail-heat__foot">{foot}</p>
</div>'''


def ads_marker(kind):
    """A slot the server fills at request time with a live ad, if any.

    Ads are sold by the week, so they cannot be baked into the build: a booking
    taken this afternoon has to show up this afternoon, and an ad whose window
    ended yesterday has to disappear without waiting for a rebuild. The marker
    ships empty and serve.py splices in whatever `ads.active()` returns — or
    nothing at all, which is the normal case.
    """
    return f'<!--ads:{kind}-->'


def rail():
    return f'''<aside class="rail">
  {ads_marker('sidebar')}
  {rail_heat_card()}
  {top_picks_block()}
  {tags_block()}
</aside>'''


def google_g(size=18):
    return (f'<svg class="g-icon" viewBox="0 0 48 48" width="{size}" height="{size}" '
            'aria-hidden="true" focusable="false">'
            '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
            '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
            '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
            '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>'
            '</svg>')


def auth_modal():
    """Sign-in dialog opened by the hero URL box.

    The URL the visitor typed is parked on the element (`data-next-url`) and
    carried into the submit wizard after sign-in, so nobody has to type their
    product address twice.
    """
    zh = LANG == 'zh'
    title = '先登录，再提交' if zh else 'Sign in to continue'
    sub = ('登录后我们会把你刚填的链接直接带进提交页。'
           if zh else 'We will carry the URL you just typed into the submit form.')
    google = '使用 Google 继续' if zh else 'Continue with Google'
    note = ('只读取你的姓名、邮箱和头像，不会拿到 Gmail 或其他数据。'
            if zh else 'We only read your name, email and avatar — never your Gmail or other data.')
    return f'''<div class="auth-modal" data-auth-modal hidden>
  <div class="auth-modal__overlay" data-auth-close></div>
  <div class="auth-modal__panel" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
    <button class="auth-modal__x" type="button" data-auth-close aria-label="{'关闭' if zh else 'Close'}">&times;</button>
    <h2 id="auth-modal-title">{title}</h2>
    <p class="auth-modal__sub">{sub}</p>
    <button class="btn btn--google btn--block" type="button" data-auth-google>{google_g()}{google}</button>
    <p class="auth-modal__note">{note}</p>
  </div>
</div>'''


def paid_card():
    """The right-column upsell, modelled on how launch directories sell a pin.

    Every line here is something the site can actually deliver today — no
    invented traffic numbers, no "27x more views" we cannot measure.
    """
    zh = LANG == 'zh'
    feats = ([
        '永久 dofollow 反链，不挂 badge',
        sla(PAID_SLA),
        '目录页排在免费收录之前',
        '想再往前：精选 %s 加置顶 7 天' % money('featured')[0],
    ] if zh else [
        'Permanent dofollow link, no badge',
        sla(PAID_SLA),
        'Listed above every free submission',
        'Want the top? Featured adds a 7-day pin for %s' % money('featured')[0],
    ])
    li = ''.join(f'<li>{icon("circle-check")}<span>{esc(f)}</span></li>' for f in feats)
    return f'''<section class="paid-card">
  <div class="paid-card__preview">
    <span class="paid-card__thumb">{icon('sparkles')}</span>
    <span class="paid-card__pv">
      <b>{'你的产品' if zh else 'Your tool'}</b>
      <span>{'排在免费收录之前' if zh else 'Listed above free'}</span>
    </span>
    <span class="paid-card__flag">STANDARD</span>
  </div>
  <h2>{'让更多人先看到你' if zh else 'Get seen first'}</h2>
  <p class="paid-card__sub">{sla(PAID_SLA) + sla_stop(zh)}</p>
  <ul class="paid-feats">{li}</ul>
  <p class="paid-card__price"><span>{'从' if zh else 'From'}</span><b>{money('standard')[0]}</b><em>{money('standard')[1]}</em></p>
  <a class="btn btn--primary btn--block" href="{u('pricing.html')}">{'升级收录' if zh else 'Upgrade your listing'}{icon('arrow-right')}</a>
</section>'''


def jsonld(obj):
    return ('<script type="application/ld+json">'
            + json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
            + '</script>')


def ld_breadcrumb_obj(items):
    """BreadcrumbList as a plain node (no @context) so it can join a @graph."""
    return {
        '@type': 'BreadcrumbList',
        'itemListElement': [{'@type': 'ListItem', 'position': i, 'name': n, 'item': abs_url(p)}
                            for i, (n, p) in enumerate(items, 1)],
    }


def ld_breadcrumb(items):
    return jsonld({'@context': 'https://schema.org', **ld_breadcrumb_obj(items)})


def ld_itemlist_obj(name, tools):
    """ItemList of tool detail pages — the machine-readable shape of a listing page."""
    return {
        '@type': 'ItemList',
        'name': name,
        'numberOfItems': len(tools),
        'itemListElement': [{'@type': 'ListItem', 'position': i,
                             'url': abs_url(f'tools/{x["slug"]}.html'),
                             'name': L(x, 'name')} for i, x in enumerate(tools, 1)],
    }


def ld_url_list_obj(name, pairs):
    """ItemList pointing at index pages (category list, tag list)."""
    return {
        '@type': 'ItemList',
        'name': name,
        'numberOfItems': len(pairs),
        'itemListElement': [{'@type': 'ListItem', 'position': i, 'name': n, 'url': abs_url(p)}
                            for i, (n, p) in enumerate(pairs, 1)],
    }


def ld_webpage_obj(name, desc, path, kind='WebPage'):
    return {
        '@type': kind,
        'name': name,
        'description': desc,
        'url': abs_url(path),
        'inLanguage': 'zh-Hans' if LANG == 'zh' else 'en',
        'isPartOf': {'@type': 'WebSite', 'name': SITE_NAME, 'url': SITE + '/index.html'},
    }


def ld_graph(*nodes):
    """Emit several schema.org entities in one script — fewer tags, same semantics."""
    return jsonld({'@context': 'https://schema.org', '@graph': [n for n in nodes if n]})


# --------------------------------------------------------------------------
# home  (PRD §3.1)
# --------------------------------------------------------------------------
def build_home():
    at('index.html')
    # Every pin can expire. Falling back to the top-voted listing keeps the
    # hero card from blowing up on a build where nothing is currently paid —
    # an IndexError here would take the whole homepage down.
    hero = (featured_tools() or by_votes(1))[0]
    tiles = [cat(s) for s in ('coding', 'chatbots', 'image')]
    top = by_votes(6)
    new = by_newest(6)

    zh = LANG == 'zh'
    DR = DATA['site'].get('dr')
    # Never print a DR we have not measured: site.dr_verified gates the number.
    DR_OK = bool(DATA['site'].get('dr_verified')) and isinstance(DR, int)

    dr_faq = ([
        ('DR %d 是什么意思？' % DR,
         'Ahrefs 的 Domain Rating，0–100，用来衡量一个站点传递链接权重的能力。DR 越高，你拿到的反链越值钱。我们自己的 DR 在 Ahrefs 上可以查到。'),
    ] if zh else [
        ('What does DR %d mean?' % DR,
         'Domain Rating from Ahrefs, on a 0-100 scale. It is a proxy for how much link equity a backlink passes. '
         'Higher DR means a more valuable link. You can look ours up in Ahrefs.'),
    ]) if DR_OK else []

    faqs = ([
        ('提交要花钱吗？', '免费收录 0 元，进人工审核队列，' + sla(FREE_SLA) + '，链接是 nofollow。标准一次性 $19：' + sla(PAID_SLA) + '、永久 dofollow、目录页排在免费收录之前。精选 $39：再加目录页和分类页置顶 7 天、首页精选卡。专业 $69：分类页置顶 90 天、全年 4 次文案修改、' + sla(PRO_REPLY) + '。都是单次付费，不是订阅。'),
        ('多久能上线？', '付费档在站长确认收款后当天上线（人工确认收款）。免费收录由人工审核，' + sla(FREE_SLA) + '。'),
        ('免费收录的链接是 nofollow 吗？', '是。免费不收钱，链接就是 nofollow，页面照样永久保留、照常进每周榜单。要 dofollow 需要付费，付费之后没有附加条件：不用挂我们的 badge，不会定期复查，也不会因为某天忘了续费而消失。'),
        ('上线后还能改吗？', '可以。在「我的提交」里随时修改，已上线的条目改动后会重新过一遍审核。'),
    ] + dr_faq if zh else [
        ('How much does it cost?', 'A free listing costs nothing, waits in the review queue (' + sla(FREE_SLA) + '), and carries a nofollow link. Standard is a one-time $19: ' + sla(PAID_SLA)[0].lower() + sla(PAID_SLA)[1:] + ', permanent dofollow, listed above every free submission. Featured is $39 and adds a 7-day pin on the directory and category pages plus the homepage card. Pro is $69 for a 90-day category pin, four copy edits a year, and ' + sla(PRO_REPLY) + '. All one-time payments, never a subscription.'),
        ('How fast does my listing go live?', sla(PAID_SLA) + '. Free listings are reviewed by a person, ' + sla(FREE_SLA) + '.'),
        ('Is the free link nofollow?', 'Yes. Free listings cost nothing, so the link is nofollow — the page still stays up forever and still competes on the weekly board. Dofollow comes with a paid listing, and there are no strings attached to it: no badge to install, no periodic re-check, nothing that expires while you are not looking.'),
        ('Can I edit after it goes live?', 'Yes, any time from My submissions. Edits to a live listing are re-reviewed before they publish.'),
    ] + dr_faq)
    acc = ''.join(
        f'<div class="acc-item"><button class="acc-trigger" type="button" aria-expanded="false">{esc(q)}{icon("chevron-down")}</button><div class="acc-panel">{esc(a)}</div></div>'
        for q, a in faqs)

    # ---- maker hero -------------------------------------------------------
    # The full stop sits OUTSIDE the highlight in Chinese on purpose: "。" is a
    # full-width glyph that only inks the bottom-left of its em box, so keeping
    # it inside the span leaves ~0.6em of empty amber trailing past the ink.
    h1 = ('发布你的产品，<span class="mk-h1__em">反链永久保留</span>。' if zh
          else 'Launch your product.<br><span class="mk-h1__em">Keep the backlink forever.</span>')
    sub = ('付费收录给一条 DR %d 的永久 dofollow 反链，一个 AI 搜索读得懂也愿意引用的页面，'
           '以及每周一重置的榜单曝光。免费提交也能上，链接是 nofollow。' % DR if (zh and DR_OK) else
           '付费收录给一条永久 dofollow 反链、一个 AI 搜索读得懂也愿意引用的页面，'
           '以及每周一重置的榜单曝光。免费提交也能上，链接是 nofollow。' if zh else
           'Paid listings get a permanent dofollow backlink from a DR %d site, a page AI search can read '
           'and cite, and a weekly leaderboard that resets every Monday. Free listings go up too — nofollow.' % DR if DR_OK else
           'Paid listings get a permanent dofollow backlink, a page AI search can read and cite, '
           'and a weekly leaderboard that resets every Monday. Free listings go up too — nofollow.')
    url_ph = 'https://你的产品.com' if zh else 'https://yourtool.com'
    url_cta = '免费提交' if zh else 'Submit free'
    url_aria = '输入产品网址，登录后进入提交' if zh else 'Your product URL — sign in to continue'
    proofs = (['30 秒提交', '付费收录 dofollow', '确认收款当天上线'] if zh
              else ['30-second submit', 'Dofollow on paid', 'Live once payment is confirmed'])

    stats = ([('30', '个产品已收录'), ('8', '个分类'),
              ('DR %d' % DR if DR_OK else 'dofollow', '域名权重' if DR_OK else '付费收录外链'),
              ('每周一', '榜单重置')] if zh else
             [('30', 'products listed'), ('8', 'categories'),
              ('DR %d' % DR if DR_OK else 'dofollow', 'domain rating' if DR_OK else 'on paid listings'),
              ('Weekly', 'board reset')])
    stats_html = ''.join(f'<div class="mk-stat"><b>{v}</b><span>{k}</span></div>' for v, k in stats)

    # ---- what you get -----------------------------------------------------
    # The badge swap is gone. It was a second, quieter price list: "free, but
    # put our badge on your site and we will make it dofollow" — which nobody
    # could verify daily and which made "permanent dofollow" mean two things.
    # Free is now plainly nofollow, and the only dofollow link is a paid one.
    link_zh = ('DR %d 的 dofollow 外链，付费收录才有。免费收录是 nofollow，页面照样永久保留。' % DR if DR_OK
               else '付费收录给 dofollow 外链，免费收录是 nofollow —— 页面照样永久保留。')
    link_en = ('A DR %d dofollow link, on paid listings. Free listings are nofollow but stay online forever.' % DR if DR_OK
               else 'Dofollow on paid listings, nofollow on free ones — either way the page stays online.')
    gets = ([
        ('link', '付费即得 dofollow 反链', link_zh),
        ('sparkles', 'AI 搜索读得懂', '每个收录都带结构化数据和纯文本版本，ChatGPT、Perplexity 这类 AI 搜索可以直接引用你。'),
        ('trophy', '每周一次冲榜机会', '榜单每周一重置。前三名在首页榜单里高亮，也排在周榜页最前 —— 每周重新开始，谁都有机会。'),
        ('clock', '30 秒完成提交', '粘贴产品链接，我们自动填好资料，你只需确认。不用从空白表单开始。'),
    ] if zh else [
        ('link', 'A dofollow link when you pay', link_en),
        ('sparkles', 'Readable by AI search', 'Every listing ships structured data and a plain-markdown copy, so ChatGPT and Perplexity can cite you.'),
        ('trophy', 'A weekly shot at the top', 'The board resets every Monday. The top three are highlighted on the home board and sit at the top of the weekly page — everyone starts level again each week.'),
        ('clock', 'Submitted in 30 seconds', 'Paste your URL, we prefill the listing, you confirm. No blank form to fill from scratch.'),
    ])
    gets_html = ''.join(
        f'<article class="get-card"><span class="get-card__ico">{icon(ic)}</span>'
        f'<h3>{t_}</h3><p>{d}</p></article>'
        for ic, t_, d in gets)

    # ---- weekly board -----------------------------------------------------
    def medal(i):
        return ' is-top' if i <= 3 else ''
    rows = ''
    for i, x in enumerate(by_votes(6), 1):
        # The top three carry a tinted row: on a board that resets every
        # Monday, "am I still in the medals" is the thing people check.
        top = ' is-top' if i <= 3 else ''
        rows += f'''<li class="board__row{top}">
  <a class="board__link" href="{url_tool(x['slug'])}">
    <span class="board__rank{medal(i)}">{i}</span>
    <span class="tool-icon" style="width:38px;height:38px"><img src="{a(x['logo'])}" alt="" width="38" height="38" loading="lazy"></span>
    <span class="board__body">
      <span class="board__name">{esc(L(x, 'name'))}</span>
      <span class="board__desc">{esc(L(x, 'short'))}</span>
    </span>
    <span class="board__meta">
      <span class="board__tag">{icon('shapes')}{esc(L(cat(x['category']), 'name'))}</span>
      <span class="board__votes">{icon('arrow-up')}{num(x['votes_week'])}</span></span>
  </a>
</li>'''
    cur = WEEKS[0]
    week_label = (cur['label_zh'] if zh else cur['label_en'])

    sec_get = '收录后你能得到什么' if zh else 'What you get when you list'
    sec_get_sub = ('四件事，每一条收录都有。' if zh else 'Four things, on every listing.')
    sec_board = '本周榜单' if zh else "This week's board"
    sec_board_sub = (f'{week_label} · 每周一重置' if zh else f'{week_label} · resets every Monday')
    sec_cat = '按分类浏览' if zh else 'Browse by category'
    sec_new = '最新收录' if zh else 'Just added'
    sec_new_sub = '目录里最近上线的产品。' if zh else 'The newest products in the directory.'
    q_h = '常见问题' if zh else 'Questions'

    content = f'''<div class="container">
  <div class="home-top">
    <section class="mk-hero mk-hero--center">
      <p class="mk-eyebrow">{'写给 Maker' if zh else 'For makers'}</p>
      <h1 class="mk-h1">{h1}</h1>
      <p class="mk-sub">{sub}</p>
      <form class="mk-url" data-hero-submit action="{u('submit.html')}" method="get">
        <div class="mk-url__row">
          <input class="mk-url__input" type="text" inputmode="url" autocomplete="url" name="url"
                 spellcheck="false" data-hero-url placeholder="{url_ph}" aria-label="{url_aria}">
          <button class="btn btn--primary btn--lg mk-url__btn" type="submit">{url_cta}{icon('arrow-right')}</button>
        </div>
        <ul class="mk-proofs">{''.join(f'<li>{icon("check")}{p_}</li>' for p_ in proofs)}</ul>
      </form>
      <div class="mk-stats">{stats_html}</div>
    </section>
    <aside class="home-top__side">{top_picks_block()}</aside>
  </div>

  <div class="home-layout">
    <div class="home-main">

      <section>
        {section_head(sec_get, sec_get_sub)}
        <div class="get-grid">{gets_html}</div>
      </section>

      <section>
        {section_head(t('featured'), '', t('view_all'), u('tools.html'))}
        <div class="featured-grid">
          <div class="hero-card">
            <div class="hero-card__glow" aria-hidden="true"></div>
            <div class="hero-card__inner">
              <div class="hero-card__head">
                <span class="hero-card__logo"><img src="{a(hero['logo'])}" alt="" width="36" height="36"></span>
                <span class="badge-pick">{t('sponsored') if (hero['is_paid'] and hero['pin']) else t('featured')}</span>
              </div>
              <h3>{esc(L(hero, 'name'))}</h3>
              <p class="hero-card__desc">{esc(L(hero, 'short'))}</p>
              <div class="hero-card__cta">
                <a class="btn btn--primary" href="{url_tool(hero['slug'])}">{t('view_details')}{icon('arrow-right')}</a>
                <span class="hero-card__meta">{icon('arrow-up')}<span>{num(hero['votes_week'])} {t('votes')}</span></span>
              </div>
            </div>
          </div>
          <div class="featured-tiles">{''.join(cat_tile(c) for c in tiles)}</div>
        </div>
      </section>

      {pills()}

      <section>
        {section_head(sec_board, sec_board_sub, t('view_all'), u('weekly.html'))}
        <ol class="board">{rows}</ol>
      </section>

      <section>
        {section_head(sec_cat, '', t('view_all'), u('categories.html'))}
        <div class="cat-grid">{''.join(cat_card(c) for c in CATS)}</div>
      </section>

      <section>
        {section_head(sec_new, sec_new_sub, t('view_all'), u('just-added.html'))}
        {tool_grid(new, community='all')}
      </section>

      <section class="home-faq">
        <h2>{q_h}</h2>
        <div class="accordion">{acc}</div>
      </section>
    </div>
    <aside class="rail">
      {ads_marker('sidebar')}
      {rail_heat_card()}
      {paid_card()}
      {tags_block()}
    </aside>
  </div>
</div>
{auth_modal()}'''

    title = ('Product Atlas — 提交你的产品，拿到永久反链' if zh
             else 'Product Atlas — Launch your product, keep the backlink')
    desc = ('面向 Maker 的产品收录站：免费提交，付费置顶拿 dofollow 反链，'
            '每个收录都有可被 AI 搜索引用的结构化页面，并参与每周榜单。' if zh else
            'A product directory built for makers: free submission, dofollow backlink on paid placements, '
            'a page AI search can cite, and a weekly leaderboard that resets every Monday.')
    ld = jsonld({
        '@context': 'https://schema.org', '@type': 'WebSite',
        'name': SITE_NAME, 'url': abs_url('index.html'),
        'potentialAction': {
            '@type': 'SearchAction',
            'target': {'@type': 'EntryPoint', 'urlTemplate': abs_url('tools.html') + '?q={search_term_string}'},
            'query-input': 'required name=search_term_string',
        },
    })
    return page(title, desc, content, 'home', 'index.html', ld)


def cat_mix(slug, n=4):
    """The first few logos inside a category — used as a 2×2 preview tile."""
    return [y for y in TOOL_LIST if y['category'] == slug][:n]


def _cat_heat():
    """Category → votes this week, plus the hottest category as a denominator."""
    totals = {}
    for y in TOOL_LIST:
        totals[y['category']] = totals.get(y['category'], 0) + y['votes_week']
    return totals, (max(totals.values()) if totals else 1) or 1


CAT_VOTES, CAT_PEAK = _cat_heat()


def cat_card(c):
    """A category row: four real logos, a heat bar and this week's vote count.

    The logos are the point — an icon font tells you the category is "AI", but
    four faces tell you what you will actually find inside before you click.
    """
    logos = cat_mix(c['slug'])
    tiles = ''.join(
        f'<img src="{a(y["logo"])}" alt="" width="18" height="18" loading="lazy">'
        for y in logos)
    tiles += '<span class="cat-card__mix-empty" aria-hidden="true"></span>' * (4 - len(logos))
    votes = CAT_VOTES.get(c['slug'], 0)
    pct = round(100 * votes / CAT_PEAK) if CAT_PEAK else 0
    heat_label = (f'{votes} 票本周' if LANG == 'zh' else f'{votes} votes this week')
    count_label = '个产品' if LANG == 'zh' else 'products'
    return f'''<a class="cat-card" href="{url_cat(c['slug'])}">
  <span class="cat-card__mix" aria-hidden="true">{tiles}</span>
  <span class="cat-card__body">
    <span class="cat-card__title">{esc(L(c, 'name'))}<span class="cat-card__count">{c['count']} {count_label}</span></span>
    <span class="cat-card__desc">{esc(L(c, 'desc'))}</span>
  </span>
  <span class="cat-card__heat" title="{heat_label}">
    <span class="cat-card__bar"><span style="width:{pct}%"></span></span>
    <span class="cat-card__num">{num(votes)}</span>
  </span>
</a>'''


# --------------------------------------------------------------------------
# makers  (UppLaunch's /makers/<slug>: one free long-tail page per vendor)
# --------------------------------------------------------------------------
def _index_makers():
    """Group the catalogue by vendor.

    Every listing names a maker, so the vendor is the only axis we can cut
    without writing new copy: 29 pages that all already have content, and a
    second internal link into every product page.
    """
    idx = {}
    for x in TOOL_LIST:
        name = (x.get('maker') or '').strip()
        if not name:
            continue
        s = maker_slug(name)
        m = idx.setdefault(s, {'slug': s, 'name': name, 'tools': [], 'cats': [], 'votes': 0})
        m['tools'].append(x)
        if x['category'] not in m['cats']:
            m['cats'].append(x['category'])
        m['votes'] += x['votes_week']
    for m in idx.values():
        m['tools'].sort(key=lambda y: -y['votes_week'])
    return sorted(idx.values(), key=lambda m: (-len(m['tools']), -m['votes'], m['name'].lower()))


MAKERS = _index_makers()
MAKER_BY_SLUG = {m['slug']: m for m in MAKERS}


def maker_avatar(m, size=44):
    """First letter on a tinted disc.

    Not the product logo: a vendor with three listings would look like it is
    represented by whichever one happened to be voted highest this week.
    """
    hue = (sum(ord(ch) for ch in m['name']) * 37) % 360
    initial = m['name'][:1].upper()
    return (f'<span class="maker-av" style="width:{size}px;height:{size}px;'
            f'--h:{hue}" aria-hidden="true">{esc(initial)}</span>')


def maker_card(m):
    n = len(m['tools'])
    if LANG == 'zh':
        unit = '款产品'
    else:
        unit = 'product' if n == 1 else 'products'
    cats = ''.join(
        f'<span class="chip">{esc(L(cat(s), "name"))}</span>' for s in m['cats'][:1])
    return f'''<a class="maker-card" href="{url_maker(m['name'])}">
  {maker_avatar(m, 40)}
  <span class="maker-card__body">
    <span class="maker-card__name">{esc(m['name'])}</span>
    <span class="maker-card__meta">{n} {unit}</span>
  </span>
  <span class="maker-card__cats">{cats}</span>
</a>'''


def build_makers():
    at('makers.html')
    cards = ''.join(maker_card(m) for m in MAKERS)
    h1 = '开发者' if LANG == 'zh' else 'Makers'
    sub = (f'{len(MAKERS)} 个开发者，{len(TOOL_LIST)} 款产品。'
           if LANG == 'zh' else
           f'{len(MAKERS)} makers behind {len(TOOL_LIST)} products.')
    content = f'''<div class="container">
  {breadcrumb([(t('discover'), u('index.html')), (h1, None)])}
  <header class="page-head"><h1 class="page-title">{h1}</h1><p class="page-sub">{sub}</p></header>
  <div class="maker-grid">{cards}</div>
</div>'''
    title = ('开发者 — 谁做了这些产品 | Product Atlas' if LANG == 'zh'
             else 'Makers — who builds these products | Product Atlas')
    desc = ('Product Atlas 收录产品的开发者与团队，按收录数量排序。'
            if LANG == 'zh' else
            'The makers and teams behind the products in Product Atlas, ordered by how many they have listed.')
    ld = ld_graph(
        ld_breadcrumb_obj([(t('discover'), 'index.html'), (h1, 'makers.html')]),
        ld_url_list_obj(h1, [(m['name'], f'makers/{m["slug"]}.html') for m in MAKERS]),
    )
    return page(title, desc, content, 'makers', 'makers.html', ld)


def _related_makers(m, n=4):
    peers = [o for o in MAKERS if o['slug'] != m['slug'] and set(o['cats']) & set(m['cats'])]
    return peers[:n]


def build_maker(slug):
    at(f'makers/{slug}.html')
    m = MAKER_BY_SLUG[slug]
    n = len(m['tools'])
    zh = LANG == 'zh'

    names = '、'.join(L(y, 'name') for y in m['tools']) if zh else ', '.join(
        L(y, 'name') for y in m['tools'])
    cat_links = ' '.join(
        f'<a class="chip" href="{url_cat(s)}">{esc(L(cat(s), "name"))}</a>' for s in m['cats'])

    if zh:
        intro = (f'{m["name"]} 在 Product Atlas 有 {n} 款产品：{names}。'
                 f'下面按本周票数排序。')
        works_h = f'{m["name"]} 的产品'
        works_sub = f'{n} 款，按本周票数排序。'
        peers_h = '同分类的开发者'
        peers_sub = '做相近方向的团队。'
        title = f'{m["name"]} — {n} 款产品 | Product Atlas'
        desc = f'{m["name"]} 在 Product Atlas 收录了 {n} 款产品：{names}。'
    else:
        intro = (f'{m["name"]} has {n} product{"s" if n != 1 else ""} on Product Atlas: {names}. '
                 f'Ordered by votes this week.')
        works_h = f'Products by {m["name"]}'
        works_sub = f'{n} listed, ordered by votes this week.'
        peers_h = 'Makers in the same categories'
        peers_sub = 'Teams working on adjacent problems.'
        title = f'{m["name"]} — {n} product{"s" if n != 1 else ""} | Product Atlas'
        desc = f'{m["name"]} has {n} product{"s" if n != 1 else ""} listed on Product Atlas: {names}.'

    rows = ''
    for i, x in enumerate(m['tools'], 1):
        rows += f'''<li class="board__row">
  <a class="board__link" href="{url_tool(x['slug'])}">
    <span class="board__rank">{i}</span>
    <span class="tool-icon" style="width:38px;height:38px"><img src="{a(x['logo'])}" alt="" width="38" height="38" loading="lazy"></span>
    <span class="board__body">
      <span class="board__name">{esc(L(x, 'name'))}</span>
      <span class="board__desc">{esc(L(x, 'short'))}</span>
    </span>
    <span class="board__meta">
      <span class="board__tag">{icon('shapes')}{esc(L(cat(x['category']), 'name'))}</span>
      <span class="board__votes">{icon('arrow-up')}{num(x['votes_week'])}</span></span>
  </a>
</li>'''

    peers = _related_makers(m)
    peers_html = ''
    if peers:
        peers_html = f'''<section style="margin-top:40px">
  {section_head(peers_h, peers_sub)}
  <div class="maker-grid">{''.join(maker_card(o) for o in peers)}</div>
</section>'''

    content = f'''<div class="container">
  {breadcrumb([(t('discover'), u('index.html')), (t('makers'), u('makers.html')), (esc(m['name']), None)])}
  <header class="maker-head">
    {maker_avatar(m, 64)}
    <div class="maker-head__body">
      <h1 class="page-title">{esc(m['name'])}</h1>
      <p class="maker-head__cats">{cat_links}</p>
    </div>
  </header>
  <p class="maker-intro">{esc(intro)}</p>
  <section>
    {section_head(works_h, works_sub)}
    <ol class="board">{rows}</ol>
  </section>
  {peers_html}
</div>'''

    ld = ld_graph(
        ld_breadcrumb_obj([(t('discover'), 'index.html'), (t('makers'), 'makers.html'),
                           (m['name'], f'makers/{slug}.html')]),
        {'@type': 'Organization', 'name': m['name'], 'url': abs_url(f'makers/{slug}.html'),
         'owns': [{'@type': 'SoftwareApplication', 'name': L(y, 'name'),
                   'url': abs_url(f'tools/{y["slug"]}.html')} for y in m['tools']]},
        ld_itemlist_obj(works_h, m['tools']),
    )
    return page(title, desc, content, 'makers', f'makers/{slug}.html', ld)


# --------------------------------------------------------------------------
# tools index  (PRD §3.1 sorting)
# --------------------------------------------------------------------------
def build_tools():
    at('tools.html')
    order = ordered_tools()
    cards = ''.join(tool_card(x, i) for i, x in enumerate(order))
    h1 = '全部产品' if LANG == 'zh' else 'All products'
    sub = ('浏览目录里的全部产品，可按分类筛选或切换排序。'
           if LANG == 'zh' else
           'Browse every product in the directory. Filter by category or change the sort order.')
    opts = ([('featured', '精选优先'), ('newest', '最新'), ('votes', '最热')] if LANG == 'zh'
            else [('featured', 'Featured first'), ('newest', 'Newest'), ('votes', 'Top voted')])
    sel = ''.join(f'<option value="{v}">{lab}</option>' for v, lab in opts)
    count = f'共 {len(TOOL_LIST)} 个产品' if LANG == 'zh' else f'All {len(TOOL_LIST)} products'
    content = f'''<div class="container">
  {breadcrumb([(t('discover'), u('index.html')), (t('tools'), None)])}
  <header class="page-head">
    <h1 class="page-title">{h1}</h1>
    <p class="page-sub">{sub}</p>
  </header>
  <div style="margin-bottom:24px">{pills()}</div>
  <div class="tools-toolbar">
    <h2 class="tools-count" data-tool-count>{count}</h2>
    <label class="sort-select">
      <span class="sr-only">{'排序' if LANG == 'zh' else 'Sort by'}</span>
      <select data-sort>{sel}</select>
      {icon('chevron-down')}
    </label>
  </div>
  <div class="tool-grid" data-tools-page><!--community:all-->{cards}</div>
  <nav class="pagination" data-pager aria-label="Pagination"></nav>
</div>'''
    title = ('全部产品 — 浏览与对比 | Product Atlas' if LANG == 'zh'
             else 'All 30 Products — Browse & Compare | Product Atlas')
    desc = ('浏览 Product Atlas 目录里的全部产品，按分类筛选、按最新或最热排序，快速对比它们能做什么。'
            if LANG == 'zh' else
            'Browse all 30 products in the Product Atlas directory. Filter by category, sort by newest or votes, and compare what each one does.')
    ld = jsonld({
        '@context': 'https://schema.org', '@type': 'ItemList',
        'name': h1, 'numberOfItems': len(TOOL_LIST),
        'itemListElement': [{'@type': 'ListItem', 'position': i, 'url': abs_url(f'tools/{x["slug"]}.html'),
                             'name': L(x, 'name')} for i, x in enumerate(order, 1)],
    })
    return page(title, desc, content, 'tools', 'tools.html', ld)


# --------------------------------------------------------------------------
# tool detail  (PRD §3.2 — no rich content)
# --------------------------------------------------------------------------
def related_tools(x, n=3):
    scored = []
    for y in TOOL_LIST:
        if y['slug'] == x['slug']:
            continue
        s = 0
        if y['category'] == x['category']:
            s += 3
        s += len(set(y['tags']) & set(x['tags'])) * 2
        scored.append((s, y['votes_week'], y))
    scored.sort(key=lambda r: (-r[0], -r[1]))
    return [r[2] for r in scored[:n]]


def build_tool(slug):
    at(f'tools/{slug}.html')
    x = TOOLS[slug]
    c = cat(x['category'])
    feats = featured_tools()
    badges = ''
    if x['is_paid'] and x['pin']:
        badges += f'<span class="badge-featured badge-featured--paid">{icon("sparkles")}{t("sponsored")}</span>'
    elif x['pin']:
        badges += f'<span class="badge-featured">{icon("sparkles")}{t("featured")}</span>'
    # The outbound link is the thing people actually buy, so the rel has to
    # match the invoice. Every listing used to ship rel="dofollow" whether or
    # not anyone had paid, which made the pricing table a lie in the one place
    # a buyer would check.
    out_rel = 'dofollow noopener' if x['is_paid'] else 'nofollow noopener'

    meta = f'''<div><dt>{icon('shapes')}<span class="sr-only">{t('categories')}</span></dt><dd><a href="{url_cat(c['slug'])}">{esc(L(c, 'name'))}</a></dd></div>
<div><dt>{icon('calendar')}<span class="sr-only">{'收录时间' if LANG == 'zh' else 'Listed'}</span></dt><dd><time datetime="{x['created_at']}">{fmt_date(x['created_at'])}</time></dd></div>
<div><dt>{icon('user')}<span class="sr-only">Maker</span></dt><dd><a href="{url_maker(x['maker'])}">{esc(x['maker'])}</a></dd></div>'''

    tags = ''.join(
        f'<a href="{url_tag(next(g["slug"] for g in TAGS if g["name_en"] == tg))}">#{esc(next((L(g, "name") for g in TAGS if g["name_en"] == tg), tg))}</a>'
        for tg in x['tags'])

    gallery = ''
    if x['shots']:
        imgs = [a(f'assets/img/screenshots/{s}') for s in x['shots']]
        thumbs = ''.join(
            f'<button class="gallery__thumb{" is-active" if i == 0 else ""}" type="button" data-gallery-thumb="{i}" aria-label="Screenshot {i+1}"><img src="{src}" alt="" loading="lazy"></button>'
            for i, src in enumerate(imgs))
        nav = ''
        if len(imgs) > 1:
            nav = (f'<button class="gallery__nav gallery__nav--prev" type="button" data-gallery-prev aria-label="Previous">{icon("chevron-left")}</button>'
                   f'<button class="gallery__nav gallery__nav--next" type="button" data-gallery-next aria-label="Next">{icon("chevron-right")}</button>'
                   f'<span class="gallery__count" data-gallery-count>1 / {len(imgs)}</span>')
        thumbs_wrap = f'<div class="gallery__thumbs">{thumbs}</div>' if len(imgs) > 1 else ''
        gallery = f'''<div class="gallery" data-gallery='{json.dumps(imgs)}'>
  <div class="gallery__main">
    <button type="button" data-gallery-zoom style="width:100%;height:100%;display:block" aria-label="Zoom"><img src="{imgs[0]}" alt="{esc(L(x, 'name'))}" data-gallery-main></button>
    {nav}
  </div>
  {thumbs_wrap}
</div>'''

    long_txt = L(x, 'long') or L(x, 'short')
    paras = ''.join(f'<p>{esc(p)}</p>' for p in long_txt.split('\n\n') if p.strip())
    about_h = f'关于 {L(x, "name")}' if LANG == 'zh' else f'About {L(x, "name")}'

    rel = related_tools(x, n=4)
    # Compact two-up cards, not the homepage's big grid: on a detail page these
    # are exits, so they should read in one glance and cost little height.
    rel_items = ''.join(f'''<li><a class="rel-item" href="{url_tool(y['slug'])}">
  <span class="tool-icon" style="width:40px;height:40px"><img src="{a(y['logo'])}" alt="" width="40" height="40" loading="lazy"></span>
  <span class="rel-item__body"><span class="rel-item__name">{esc(L(y, 'name'))}</span><span class="rel-item__desc">{esc(L(y, 'short'))}</span></span>
  {icon('arrow-up-right')}
</a></li>''' for y in rel)
    rel_head = ('相似产品' if LANG == 'zh' else f'Similar to {L(x, "name")}')
    related_html = f'''<section style="margin-top:48px">
  {section_head(rel_head, '', t('view_all'), url_cat(c['slug']))}
  <ul class="rel-list">{rel_items}</ul>
</section>''' if rel else ''

    popular = ''
    for i, y in enumerate(by_votes(5), 1):
        popular += f'''<a href="{url_tool(y['slug'])}">
  <span class="popular-list__rank">{i}</span>
  <span class="tool-icon" style="width:28px;height:28px"><img src="{a(y['logo'])}" alt="" width="28" height="28" loading="lazy"></span>
  <span class="popular-list__body"><span class="popular-list__name">{esc(L(y, 'name'))}</span><span class="popular-list__desc">{num(y['votes_week'])} {t('votes')}</span></span>
</a>'''

    aside_title = '本周热门' if LANG == 'zh' else 'Top voted this week'
    vote_hint = ('登录后每周可为每个产品投 1 票。' if LANG == 'zh'
                 else 'One vote per tool, per week. Sign in to cast yours.')

    content = f'''<div class="container">
  {breadcrumb([(t('discover'), u('index.html')), (t('tools'), u('tools.html')), (esc(L(x, 'name')), None)])}
  <div class="detail-layout">
    <div class="detail-main">
      <header class="detail-head">
        <div class="detail-title">
          <div class="detail-icon" style="width:64px;height:64px"><img src="{a(x['logo'])}" alt="" width="64" height="64"></div>
          <div class="detail-title__body">
            <div class="detail-title__row"><h1>{esc(L(x, 'name'))}</h1>{badges}</div>
            <p class="detail-head__tagline">{esc(L(x, 'short'))}</p>
          </div>
        </div>
        <div class="detail-visit">
          {vote_btn(x)}
          <a class="btn btn--primary" href="{esc(x['url'])}" target="_blank" rel="{out_rel}">{t('visit')}{icon('arrow-up-right')}</a>
        </div>
        <dl class="meta-dl">{meta}</dl>
        <div class="detail-tags">{tags}</div>
        <p class="vote-hint">{vote_hint}</p>
      </header>
      {ask_ai_block(x)}
      {gallery}
      <section class="doc-section" id="about"><h2>{about_h}</h2><div>{paras}</div></section>
    </div>
    <aside class="detail-aside">
      <div class="aside-card">
        <p>{aside_title}</p>
        <div class="popular-list">{popular}</div>
      </div>
      <div class="aside-card aside-card--slot">
        <p>{'赞助位' if LANG == 'zh' else 'Sponsored slot'}</p>
        <span class="slot-note">{'预留广告位（MVP 不开放购买）' if LANG == 'zh' else 'Reserved ad slot (not for sale in MVP)'}</span>
      </div>
    </aside>
  </div>
  {related_html}
</div>'''

    if LANG == 'zh':
        title = f"{L(x, 'name')}：功能、定价与同类工具 | Product Atlas"
        desc = L(x, 'short')
    else:
        title = f"{L(x, 'name')}: Features, Pricing & Alternatives | Product Atlas"
        desc = L(x, 'short')
    ld = jsonld({
        '@context': 'https://schema.org', '@type': 'SoftwareApplication',
        'name': L(x, 'name'), 'description': L(x, 'short'),
        'url': abs_url(f'tools/{slug}.html'),
        'applicationCategory': APP_CATEGORY.get(x['category'], 'UtilityApplication'),
        'operatingSystem': 'Web',
        'image': SITE + '/' + x['logo'],
        'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
        'sameAs': x['url'],
    }) + ld_breadcrumb([(t('discover'), 'index.html'), (t('tools'), 'tools.html'), (L(x, 'name'), f'tools/{slug}.html')])
    return page(title, desc, content, 'tools', f'tools/{slug}.html', ld)


# --------------------------------------------------------------------------
# categories / tags
# --------------------------------------------------------------------------
def build_categories():
    at('categories.html')
    cards = ''.join(cat_card(c) for c in CATS)
    h1 = '产品分类' if LANG == 'zh' else 'Product categories'
    sub = '目录里的全部分类。' if LANG == 'zh' else 'Every category in the directory.'
    content = f'''<div class="container">
  {breadcrumb([(t('discover'), u('index.html')), (t('categories'), None)])}
  <header class="page-head"><h1 class="page-title">{h1}</h1><p class="page-sub">{sub}</p></header>
  <div class="cat-grid">{cards}</div>
</div>'''
    title = ('产品分类 — 全部浏览 | Product Atlas' if LANG == 'zh'
             else 'Product Categories — Browse all | Product Atlas')
    desc = ('Product Atlas 目录里的全部产品分类：聊天助手、编程、图像、视频、语音与研究等。'
            if LANG == 'zh' else
            'Every product category in the Product Atlas directory, from chatbots and coding to image, video, voice and research.')
    ld = ld_graph(
        ld_breadcrumb_obj([(t('discover'), 'index.html'), (t('categories'), 'categories.html')]),
        ld_url_list_obj(h1, [(L(c, 'name'), f'categories/{c["slug"]}.html') for c in CATS]),
    )
    return page(title, desc, content, 'categories', 'categories.html', ld)


def build_category(slug):
    at(f'categories/{slug}.html')
    c = cat(slug)
    tools = [x for x in ordered_tools() if x['category'] == slug]
    content = f'''<div class="container">
  {breadcrumb([(t('discover'), u('index.html')), (t('categories'), u('categories.html')), (esc(L(c, 'name')), None)])}
  <header class="page-head">
    <h1 class="page-title">{esc(L(c, 'name'))}</h1>
    <p class="page-sub">{esc(L(c, 'desc'))}</p>
    <p class="stat-line" style="margin-top:8px">{c['count']} {'个产品' if LANG == 'zh' else 'products in this category'}</p>
  </header>
  {tool_grid(tools, community=f'cat:{slug}')}
</div>'''
    nm = L(c, 'name')
    year = TODAY.year
    if LANG == 'zh':
        # 「效率工具」already ends in 工具 — don't append a second one
        tail = '' if nm.endswith('工具') else '工具'
        # keep a space only when the name starts with a Latin word (AI 聊天助手)
        sep = ' ' if re.match(r'^[A-Za-z]', nm) else ''
        title = f'{c["count"]} 款最佳{sep}{nm}{tail}（{year}）| Product Atlas'
        desc = f'{L(c, "desc")} 精选 {c["count"]} 款{sep}{nm}{tail}，人工审核，{year} 年持续更新。'
    else:
        # 「AI Chatbots」is already plural — "Chatbots Tools" reads wrong
        tail = '' if nm.endswith('s') and not nm.endswith('ss') else ' Tools'
        title = f'{c["count"]} Best {nm}{tail} in {year} | Product Atlas'
        desc = f'{L(c, "desc")} Hand-picked {nm.lower()}{tail.lower()}, reviewed and updated for {year}.'
    ld = ld_graph(
        ld_breadcrumb_obj([(t('discover'), 'index.html'), (t('categories'), 'categories.html'),
                           (L(c, 'name'), f'categories/{slug}.html')]),
        ld_itemlist_obj(title.split(' | ')[0], tools),
    )
    return page(title, desc, content, 'categories', f'categories/{slug}.html', ld)


def build_tags():
    at('tags.html')
    items = ''.join(f'<a class="tag-pill" href="{url_tag(g["slug"])}">#{esc(L(g, "name"))}'
                    f'<span class="tag-pill__count">{g["count"]}</span></a>' for g in TAGS)
    h1 = '按标签浏览产品' if LANG == 'zh' else 'Products by tag'
    sub = '用标签找到更具体的产品。' if LANG == 'zh' else 'Browse products by tag.'
    content = f'''<div class="container">
  {breadcrumb([(t('discover'), u('index.html')), (t('tags'), None)])}
  <header class="page-head"><h1 class="page-title">{h1}</h1><p class="page-sub">{sub}</p></header>
  <div class="tag-cloud tag-cloud--page">{items}</div>
</div>'''
    title = ('产品标签 | Product Atlas' if LANG == 'zh' else 'Products by Tag | Product Atlas')
    desc = ('按标签浏览产品 — API、智能体、聊天机器人、视频生成、开源等。'
            if LANG == 'zh' else
            'Browse products by tag — API, agent, chatbot, video generation, open source and more.')
    ld = ld_graph(
        ld_breadcrumb_obj([(t('discover'), 'index.html'), (t('tags'), 'tags.html')]),
        ld_url_list_obj(h1, [('#' + L(g, 'name'), f'tags/{g["slug"]}.html') for g in TAGS]),
    )
    return page(title, desc, content, 'tags', 'tags.html', ld)


def build_tag(slug):
    at(f'tags/{slug}.html')
    g = tag(slug)
    tools = [x for x in TOOL_LIST if g['name_en'] in x['tags']]
    tools.sort(key=lambda x: (-x['votes_week']))
    content = f'''<div class="container">
  {breadcrumb([(t('discover'), u('index.html')), (t('tags'), u('tags.html')), ('#' + esc(L(g, 'name')), None)])}
  <header class="page-head">
    <h1 class="page-title">#{esc(L(g, 'name'))}</h1>
    <p class="page-sub">{g['count']} {'个产品带有该标签' if LANG == 'zh' else f"products tagged #{L(g, 'name')}"}。</p>
  </header>
  {tool_grid(tools, community=f'tag:{slug}')}
</div>'''
    title = (f'#{L(g, "name")} 产品 | Product Atlas' if LANG == 'zh'
             else f'#{L(g, "name")} Products | Product Atlas')
    desc = (f'{g["count"]} 个带有 {L(g, "name")} 标签的产品。' if LANG == 'zh'
            else f'{g["count"]} products tagged {L(g, "name")} in the Product Atlas directory.')
    ld = ld_graph(
        ld_breadcrumb_obj([(t('discover'), 'index.html'), (t('tags'), 'tags.html'),
                           ('#' + L(g, 'name'), f'tags/{slug}.html')]),
        ld_itemlist_obj(title.split(' | ')[0], tools),
    )
    return page(title, desc, content, 'tags', f'tags/{slug}.html', ld)


# --------------------------------------------------------------------------
# weekly leaderboard  (PRD §3.4)
# --------------------------------------------------------------------------
def build_weekly():
    at('weekly.html')
    # The board resets every Monday, so "this week" has to be the *actual*
    # ISO week, not whatever happens to sit at index 0 of the fixture. The
    # seed data stops at W44; rendering that as "本周" in W45 is a date lie a
    # visitor can check in one glance.
    cur_id = BUILD_DATE.strftime('%G-W%V')
    archived = next((w for w in WEEKS if w.get('id') == cur_id), None)
    live_week = archived is not None
    cur = archived or WEEKS[0]
    if live_week:
        cur_label = cur['label_zh'] if LANG == 'zh' else cur['label_en']
        cur_votes = {r['slug']: r['votes'] for r in cur['ranking']}
    else:
        mon = BUILD_DATE - timedelta(days=BUILD_DATE.weekday())
        sun = mon + timedelta(days=6)
        cur_label = ('%d 月 %d 日 – %d 月 %d 日' % (mon.month, mon.day, sun.month, sun.day)
                     if LANG == 'zh' else
                     '%s %d – %s %d' % (mon.strftime('%b'), mon.day, sun.strftime('%b'), sun.day))
        # A week that has not been voted on yet starts at zero and inherits
        # last week's *order* only as a tiebreak. Showing last week's numbers
        # as this week's would be the same lie in a different place.
        cur_votes = {r['slug']: 0 for r in cur['ranking']}

    tabs = ''
    panels = ''
    history = []

    def move_html(i, rank, slug):
        if i + 1 >= len(WEEKS):
            return '<span class="rank-move">—</span>', '', 0
        prev = next((p for p in WEEKS[i + 1]['ranking'] if p['slug'] == slug), None)
        if not prev:
            return '<span class="rank-move is-new">NEW</span>', 'new', 0
        pr = WEEKS[i + 1]['ranking'].index(prev) + 1
        if pr > rank:
            return f'<span class="rank-move is-up">▲{pr - rank}</span>', 'up', pr - rank
        if pr < rank:
            return f'<span class="rank-move is-down">▼{rank - pr}</span>', 'down', rank - pr
        return '<span class="rank-move">—</span>', '', 0

    for i, w in enumerate(WEEKS):
        label = cur_label if i == 0 else (w['label_zh'] if LANG == 'zh' else w['label_en'])
        suffix = (' · 本周' if LANG == 'zh' else ' · current') if i == 0 else ''
        tabs += (f'<button class="pill{" is-active" if i == 0 else ""}" type="button" '
                 f'data-week-tab="{i}" aria-selected="{"true" if i == 0 else "false"}">'
                 f'{esc(label)}{suffix}</button>')
        if i == 0:
            rows = ''
            for rank, r in enumerate(w['ranking'], 1):
                x = TOOLS[r['slug']]
                move, _, _ = (move_html(i, rank, r['slug']) if live_week
                              else ('<span class="rank-move">—</span>', '', 0))
                rows += f'''<tr data-slug="{x['slug']}" data-base="{cur_votes.get(x['slug'], 0)}">
  <td class="rank-num">{rank}</td>
  <td><a class="rank-tool" href="{url_tool(x['slug'])}">
    <span class="tool-icon" style="width:32px;height:32px"><img src="{a(x['logo'])}" alt="" width="32" height="32" loading="lazy"></span>
    <span><strong>{esc(L(x, 'name'))}</strong><em>{esc(L(x, 'short'))}</em></span>
  </a></td>
  <td class="rank-cat"><span class="chip">{esc(L(cat(x['category']), 'name'))}</span></td>
  <td class="rank-move-cell">{move}</td>
  <td class="rank-votes">{vote_btn(x, small=True, count=cur_votes.get(x['slug'], 0))}</td>
</tr>'''
                # The board slot sits exactly where the pricing page says it
                # does: after the third row, before the fourth. One row, full
                # width, and only for the week that is actually current.
                if rank == 3:
                    rows += ads_marker('board')
            head = (f'<tr><th>#</th><th>{"工具" if LANG == "zh" else "Tool"}</th>'
                    f'<th>{t("categories")}</th><th>{"变化" if LANG == "zh" else "Change"}</th>'
                    f'<th>{"本周票数" if LANG == "zh" else "Votes"}</th></tr>')
            panels += f'''<div class="week-panel is-active" data-week-panel="0">
  <table class="rank-table"><thead>{head}</thead><tbody>{rows}</tbody></table>
</div>'''
        else:
            hrows = []
            for rank, r in enumerate(w['ranking'], 1):
                _, mv, delta = move_html(i, rank, r['slug'])
                y = TOOLS[r['slug']]
                hrows.append({'r': rank, 's': y['slug'], 'n': L(y, 'name'), 'd': L(y, 'short'),
                              'c': L(cat(y['category']), 'name'), 'v': r['votes'],
                              'm': mv, 'x': delta})
            history.append({'label': label, 'rows': hrows})
            panels += f'<div class="week-panel" data-week-panel="{i}"></div>'

    history_json = json.dumps(history, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')

    h1 = '本周产品榜' if LANG == 'zh' else 'Weekly product leaderboard'
    sub = ('每周一重置，按登录用户的投票数排名。付费置顶在首页优先展示，但不影响这里的票数排名。'
           if LANG == 'zh' else
           'Resets every Monday. Ranked by votes from signed-in users. Paid placements are pinned on the homepage but do not affect this ranking.')
    content = f'''<div class="container" data-week="{cur_id}">
  {breadcrumb([(t('discover'), u('index.html')), (t('weekly'), None)])}
  <header class="page-head">
    <h1 class="page-title">{h1}</h1>
    <p class="page-sub">{sub}</p>
    <p class="stat-line" style="margin-top:8px">{'当前周期' if LANG == 'zh' else 'Current period'}：{esc(cur_label)} · {cur_id}</p>
  </header>
  <nav class="tab-nav tab-nav--weeks" aria-label="{t('weekly')}">{tabs}</nav>
  {panels}
  <script type="application/json" id="weeks-data">{history_json}</script>
</div>'''
    title = ('本周产品榜 | Product Atlas' if LANG == 'zh' else 'Weekly Product Leaderboard | Product Atlas')
    desc = ('每周更新的产品排行榜，按用户投票排名，含历史周榜。'
            if LANG == 'zh' else
            'A weekly leaderboard of products ranked by community votes, with past weeks included.')
    ld = jsonld({
        '@context': 'https://schema.org', '@type': 'ItemList', 'name': h1,
        'itemListOrder': 'https://schema.org/ItemListOrderDescending',
        'numberOfItems': len(cur['ranking']),
        'itemListElement': [{'@type': 'ListItem', 'position': i,
                             'url': abs_url(f'tools/{r["slug"]}.html'),
                             'name': L(TOOLS[r['slug']], 'name')}
                            for i, r in enumerate(cur['ranking'][:20], 1)],
    })
    return page(title, desc, content, 'weekly', 'weekly.html', ld)


# --------------------------------------------------------------------------
# just added  (PRD §3.1)
# --------------------------------------------------------------------------
def build_just_added():
    at('just-added.html')
    items = by_newest()
    rows = ''.join(feed_row(x) for x in items)
    h1 = '最新收录' if LANG == 'zh' else 'Just added'
    sub = ('按收录时间排序，包含社区提交并通过审核的产品。'
           if LANG == 'zh' else
           'Sorted by listing date — including community submissions that passed review.')
    content = f'''<div class="container">
  {breadcrumb([(t('discover'), u('index.html')), (t('just_added'), None)])}
  <header class="page-head">
    <h1 class="page-title">{h1}</h1>
    <p class="page-sub">{sub}</p>
  </header>
  <div class="feed-layout">
    <div style="min-width:0"><ol class="feed-list feed-list--plain"><!--community:feed-->{rows}</ol></div>
    {rail()}
  </div>
</div>'''
    title = ('最新收录的产品 | Product Atlas' if LANG == 'zh' else 'New products — just added | Product Atlas')
    desc = ('按时间倒序排列的最新产品收录，包含社区提交。'
            if LANG == 'zh' else
            'The newest products in the directory, sorted by listing date, including community submissions.')
    ld = ld_graph(
        ld_breadcrumb_obj([(t('discover'), 'index.html'), (t('just_added'), 'just-added.html')]),
        ld_itemlist_obj(h1, items),
    )
    return page(title, desc, content, 'just-added', 'just-added.html', ld)


# --------------------------------------------------------------------------
# submit  (PRD §3.3 two tracks)
# --------------------------------------------------------------------------
def build_submit():
    at('submit.html')
    cats_opt = ''.join(f'<option value="{c["slug"]}">{esc(L(c, "name"))}</option>' for c in CATS)
    tag_chips = ''.join(
        f'<label class="tag-check"><input type="checkbox" name="tags" value="{g["name_en"]}"><span>#{esc(L(g, "name"))}</span></label>'
        for g in TAGS)
    h1 = '提交产品' if LANG == 'zh' else 'Submit a product'
    sub = ('粘贴产品链接，自动填好资料；确认后选择免费或付费发布。'
           if LANG == 'zh' else
           'Paste your product URL and we fill in the details. Then pick free or paid.')
    steps = ([('1', '粘贴链接', '自动提取'), ('2', '确认资料', '可编辑'), ('3', '选择发布方式', '免费或付费')]
             if LANG == 'zh' else
             [('1', 'Paste URL', 'Auto-extract'), ('2', 'Review', 'Editable'), ('3', 'Publish', 'Free or paid')])
    stepper = ''.join(
        f'<li class="step{" is-active" if i == 0 else ""}" data-step-indicator="{i+1}">'
        f'<span>{n}</span><div><strong>{lab}</strong><em>{hint}</em></div></li>'
        for i, (n, lab, hint) in enumerate(steps))

    catalog = json.dumps([{
        'slug': x['slug'], 'name': x['name_en'], 'domain': x['url'].split('//')[-1].split('/')[0].replace('www.', ''),
        'desc': x['short_en'], 'long': x['long_en'], 'category': x['category'],
        'tags': x['tags'], 'logo': SITE + '/' + x['logo'],
    } for x in TOOL_LIST], ensure_ascii=False).replace('</', '<\\/')

    content = f'''<div class="container">
  <header class="page-head page-head--submit">
    <h1 class="page-title">{h1}</h1>
    <p class="page-sub page-sub--lg">{sub}</p>
  </header>

  <div class="submit-shell" data-submit>
    <ol class="stepper">{stepper}</ol>

    <section class="submit-step is-active" data-step="1">
      <label class="field field--url">
        <span>{'产品链接' if LANG == 'zh' else 'Product URL'}</span>
        <div class="url-row">
          <input type="url" data-url-input placeholder="https://yourproduct.com" autocomplete="off">
          <button class="btn btn--primary" type="button" data-fetch>{icon('sparkles')}{'自动提取' if LANG == 'zh' else 'Fetch details'}</button>
        </div>
        <p class="field__hint">{'系统会读取页面标题、描述与图标，作为草稿；你可以逐项修改。'
                                if LANG == 'zh' else
                                'We read the page title, description and icon to build a draft. Everything stays editable.'}</p>
      </label>
      <p class="fetch-note" data-fetch-note hidden></p>
    </section>

    <section class="submit-step" data-step="2">
      <div class="form-grid">
        <label class="field"><span>{'名称' if LANG == 'zh' else 'Name'} *</span><input type="text" data-f="name" maxlength="60" required></label>
        <label class="field"><span>{'官网链接' if LANG == 'zh' else 'Website'} *</span><input type="url" data-f="url" required></label>
        <label class="field field--wide"><span>{'一句话描述' if LANG == 'zh' else 'One-line description'} *</span><input type="text" data-f="short" maxlength="120" required></label>
        <label class="field field--wide"><span>{'长描述' if LANG == 'zh' else 'Long description'}</span><textarea data-f="long" rows="5" placeholder="{'它解决什么问题？谁在用？有什么不一样？' if LANG == 'zh' else 'What does it solve? Who uses it? What makes it different?'}"></textarea></label>
        <label class="field"><span>{'分类' if LANG == 'zh' else 'Category'} *</span>
          <select data-f="category">{cats_opt}</select>
        </label>
        <label class="field"><span>{'图标 URL' if LANG == 'zh' else 'Logo URL'}</span><input type="url" data-f="logo" placeholder="https://…/icon.png"></label>
        <div class="field field--wide"><span>{'标签' if LANG == 'zh' else 'Tags'}</span>
          <div class="tag-checks">{tag_chips}</div>
        </div>
      </div>
      <div class="step-actions">
        <button class="btn btn--outline" type="button" data-back>{icon('arrow-left')}{'上一步' if LANG == 'zh' else 'Back'}</button>
        <button class="btn btn--primary" type="button" data-next>{'下一步' if LANG == 'zh' else 'Continue'}{icon('arrow-right')}</button>
      </div>
    </section>

    <section class="submit-step" data-step="3">
      <div class="plan-grid">
        <button class="plan" type="button" data-plan="free" aria-pressed="true" data-label="{esc('免费' if LANG == 'zh' else 'Free')}" data-amount="0.00">
          <span class="plan__name">{'免费' if LANG == 'zh' else 'Free'}<span class="plan__price">{money('free')[0]}</span></span>
          <ul class="plan__feats">
            <li>{icon('check')}<span>{('人工审核，' if LANG == 'zh' else 'Manual review, ') + sla(FREE_SLA)}</span></li>
            <li>{icon('check')}<span>{'目录页 + 分类页展示' if LANG == 'zh' else 'Directory and category listing'}</span></li>
            <li>{icon('check')}<span>{'链接是 nofollow，页面永久保留' if LANG == 'zh' else 'Nofollow link, page kept forever'}</span></li>
          </ul>
        </button>
        <button class="plan" type="button" data-plan="standard" aria-pressed="false" data-label="Standard" data-amount="19.00">
          <span class="plan__name">{'标准' if LANG == 'zh' else 'Standard'}<span class="plan__price">{money('standard')[0]}<span>{money('standard')[1]}</span></span></span>
          <ul class="plan__feats">
            <li>{icon('check')}<span>{sla(PAID_SLA)}</span></li>
            <li>{icon('check')}<span>{'永久 dofollow 反链，不挂 badge' if LANG == 'zh' else 'Permanent dofollow link, no badge'}</span></li>
            <li>{icon('check')}<span>{'目录页排在免费收录之前' if LANG == 'zh' else 'Listed above every free submission'}</span></li>
          </ul>
        </button>
        <button class="plan" type="button" data-plan="featured" aria-pressed="false" data-label="Featured" data-amount="39.00">
          <span class="plan__name">{'精选' if LANG == 'zh' else 'Featured'}<span class="plan__price">{money('featured')[0]}<span>{money('featured')[1]}</span></span></span>
          <ul class="plan__feats">
            <li>{icon('check')}<span>{'标准档全部权益' if LANG == 'zh' else 'Everything in Standard'}</span></li>
            <li>{icon('check')}<span>{'目录页 + 分类页置顶 7 天' if LANG == 'zh' else 'Pinned on the directory and category for 7 days'}</span></li>
            <li>{icon('check')}<span>{'首页精选卡排期' if LANG == 'zh' else 'A slot in the homepage rotation'}</span></li>
          </ul>
        </button>
        <button class="plan" type="button" data-plan="pro" aria-pressed="false" data-label="Pro" data-amount="69.00">
          <span class="plan__name">{'专业' if LANG == 'zh' else 'Pro'}<span class="plan__price">{money('pro')[0]}<span>{money('pro')[1]}</span></span></span>
          <ul class="plan__feats">
            <li>{icon('check')}<span>{'精选档全部权益' if LANG == 'zh' else 'Everything in Featured'}</span></li>
            <li>{icon('check')}<span>{'分类页置顶 90 天' if LANG == 'zh' else 'Category pin for 90 days'}</span></li>
            <li>{icon('check')}<span>{'全年 4 次文案修改' if LANG == 'zh' else 'Four copy edits a year'}</span></li>
          </ul>
        </button>
      </div>
      <button class="plan plan--wide" type="button" data-plan="ad" aria-pressed="false" hidden data-label="{esc('周广告位' if LANG == 'zh' else 'Weekly ad slot')}" data-amount="29.00">
        <span class="plan__name">{'周广告位' if LANG == 'zh' else 'Weekly ad slot'}<span class="plan__price">{money('board')[0]}<span>{money('board')[1]}</span></span></span>
        <ul class="plan__feats">
          <li>{icon('check')}<span>{'榜单位（榜单第 3、4 名之间）%s / 周；右栏位（首页 + 最新收录页）%s / 周' % (money('board')[0], money('sidebar')[0]) if LANG == 'zh' else 'Board slot (between 3rd and 4th) %s / week; sidebar (homepage + just-added) %s / week' % (money('board')[0], money('sidebar')[0])}</span></li>
          <li>{icon('check')}<span>{'展示 7 天，周一起算，到期自动下架；连投 4 周更便宜' if LANG == 'zh' else 'Seven days from Monday, then it comes down on its own. Four-week blocks cost less'}</span></li>
          <li>{icon('check')}<span>{'不用提交产品 —— 位置是租的，不是买的' if LANG == 'zh' else 'No product submission needed — the spot is rented, not bought'}</span></li>
        </ul>
      </button>
      <p class="plan-more"><a href="{u('pricing.html')}">{'四档完整对比 + 周广告位' if LANG == 'zh' else 'Full comparison and the weekly ad slots'}{icon('arrow-right')}</a></p>
      <div class="step-actions">
        <button class="btn btn--outline" type="button" data-back>{icon('arrow-left')}{'上一步' if LANG == 'zh' else 'Back'}</button>
        <button class="btn btn--primary" type="button" data-publish>{'提交' if LANG == 'zh' else 'Submit listing'}{icon('arrow-right')}</button>
      </div>
      <p class="form-note">{('免费收录进入人工审核，' + sla(FREE_SLA) + '。付费档：' + sla(PAID_SLA) + '。' + sla(MAIL_NOTE)
                            if LANG == 'zh' else
                            'Free listings are reviewed by hand — ' + sla(FREE_SLA) + '. Paid tiers: ' + sla(PAID_SLA)[0].lower() + sla(PAID_SLA)[1:] + '. ' + sla(MAIL_NOTE))}</p>
    </section>
  </div>

  <script type="application/json" id="catalog-data">{catalog}</script>

  <div class="modal-root" id="pay-root" role="dialog" aria-modal="true" aria-label="{'确认订单' if LANG == 'zh' else 'Request invoice'}">
    <div class="modal-overlay" data-pay-close></div>
    <div class="modal modal--pay">
      <div class="pay-head">{icon('receipt')}<div><strong>{'确认订单' if LANG == 'zh' else 'Request invoice'}</strong><span>{'人工收款，本页不扣款' if LANG == 'zh' else 'Manual payment — nothing is charged on this page'}</span></div></div>
      <div class="pay-line"><span><span data-pay-plan>Standard</span> · <span data-pay-unit>{'一次性' if LANG == 'zh' else 'one-time'}</span></span><strong data-pay-amount>{money('standard')[0]}.00</strong></div>
      <div class="pay-notes">
        <p><strong>{'订单号' if LANG == 'zh' else 'Order number.'}</strong> {'提交成功后生成，可在「我的提交」查看。付款或与站长沟通时请注明该订单号。' if LANG == 'zh' else 'Issued when you submit, and shown under My submissions. Quote it when you pay or write to the site owner.'}</p>
        <p><strong>{'付款方式' if LANG == 'zh' else 'How to pay.'}</strong> {'与站长约定的人工收款（转账或站长指定的方式）。此页不跳转支付网关，也不会扣款。' if LANG == 'zh' else 'A manual payment the site owner arranges — bank transfer, or another method they name. This page does not open a card checkout and does not charge you.'}</p>
        <p><strong>{'时限' if LANG == 'zh' else 'Window.'}</strong> {'请在提交后 7 天内完成付款。逾期订单留在待付款队列，不会自动上线。' if LANG == 'zh' else 'Pay within 7 days of submitting. After that the order stays in the unpaid queue and does not go live on its own.'}</p>
        <p><strong>{'上线' if LANG == 'zh' else 'Go-live.'}</strong> {sla(PAID_SLA) + sla_stop()}</p>
        <p>{sla(MAIL_NOTE)}</p>
      </div>
      <button class="btn btn--primary btn--block" type="button" data-pay-confirm>{'提交订单，申请发票' if LANG == 'zh' else 'Request invoice'}</button>
      <button class="btn btn--ghost btn--block" type="button" data-pay-close>{'取消' if LANG == 'zh' else 'Cancel'}</button>
    </div>
  </div>

  <section class="submit-faq">
    <h2>{'提交常见问题' if LANG == 'zh' else 'Submission FAQ'}</h2>
    <div class="accordion">{submission_faq()}</div>
  </section>
</div>'''
    title = ('提交产品 | Product Atlas' if LANG == 'zh' else 'Submit a product | Product Atlas')
    desc = ('粘贴产品链接即可提交收录。免费档人工审核；付费档在确认收款后当天上线。'
            if LANG == 'zh' else
            'Submit your product by pasting a URL. Free listings are reviewed by hand; paid tiers go live the day payment is confirmed.')
    ld = ld_graph(
        ld_breadcrumb_obj([(t('discover'), 'index.html'), (t('submit'), 'submit.html')]),
        ld_webpage_obj(title.split(' | ')[0], desc, 'submit.html'),
        {'@type': 'FAQPage',
         'mainEntity': [{'@type': 'Question', 'name': q,
                         'acceptedAnswer': {'@type': 'Answer', 'text': a}}
                        for q, a in submission_faq_items()]},
    )
    return page(title, desc, content, 'submit', 'submit.html', ld)


def submission_faq_items():
    if LANG == 'zh':
        return [
            ('提交是免费的吗？', '是。免费提交会进入审核队列，' + sla(FREE_SLA) + '。通过后长期保留。'),
            ('收录后能得到什么？', '一个独立的详情页和永久链接、一条指向你官网的外链（付费为 dofollow）、参与每周榜单的资格，以及让搜索引擎和 AI 搜索能读懂的结构化数据。'),
            ('付费档位有什么区别？', '标准 $19：' + sla(PAID_SLA) + '、永久 dofollow、排在免费收录之前。精选 $39：再加目录页和分类页置顶 7 天、首页精选卡。专业 $69：分类页置顶 90 天、全年 4 次文案修改、' + sla(PRO_REPLY) + '。'),
            ('自动提取不准确怎么办？', '第 2 步的每个字段都可以手动修改，图标也可以直接换成你自己的图片地址。'),
            ('提交后还能改吗？', '可以，在「我的提交」里编辑并重新提交，被拒的条目修改后会重新进入队列。'),
            ('周广告位是什么？', '租一个位置，不是买一个页面：榜单位 $29 / 周，右栏位 $19 / 周，展示 7 天，周一起算，到期自动下架；连投 4 周有折扣。不需要提交产品，也不影响收录。'),
        ]
    return [
        ('Is submitting a product free?', 'Yes. Free submissions go into the review queue — ' + sla(FREE_SLA) + ' — and stay listed once approved.'),
        ('What do I get once listed?', 'A detail page with a permanent URL, an outbound link to your site (dofollow on paid listings), a place in the weekly leaderboard, and structured data that search engines and AI search can read.'),
        ('What is the difference between the paid tiers?', 'Standard $19: ' + sla(PAID_SLA)[0].lower() + sla(PAID_SLA)[1:] + ', permanent dofollow, listed above every free submission. Featured $39 adds a 7-day pin on the directory and category pages plus the homepage card. Pro $69 adds a 90-day category pin, four copy edits a year, and ' + sla(PRO_REPLY) + '.'),
        ('What if the auto-fill is wrong?', 'Every field in step 2 is editable, including the logo URL.'),
        ('Can I edit after submitting?', 'Yes — edit from My submissions and resubmit. Rejected listings go back into the queue after editing.'),
        ('What is a weekly ad slot?', 'A rented position, not a listing: $29 a week on the board, $19 a week in the sidebar, seven days from Monday, then it comes down on its own. Four-week blocks cost less. No product submission needed, and it does not affect your listing.'),
    ]


def submission_faq():
    return ''.join(
        f'<div class="acc-item"><button class="acc-trigger" type="button" aria-expanded="false">{esc(q)}{icon("chevron-down")}</button><div class="acc-panel">{esc(a)}</div></div>'
        for q, a in submission_faq_items())


# --------------------------------------------------------------------------
# dashboard  (PRD §3.3 submitter back office)
# --------------------------------------------------------------------------
def build_dashboard():
    """Legacy URL — the dashboard now lives at settings/submissions.html."""
    at('dashboard.html')
    target = u('settings/submissions.html')
    label = '我的提交' if LANG == 'zh' else 'My submissions'
    return f'''<!DOCTYPE html>
<html lang="{'zh-Hans' if LANG == 'zh' else 'en'}" class="light">
<head>
<meta charset="utf-8">
<title>{label} | {SITE_NAME}</title>
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="refresh" content="0;url={target}">
<link rel="canonical" href="{abs_url('settings/submissions.html')}">
<script>location.replace('{target}');</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:40px">
<p><a href="{target}">{label}</a></p>
</body>
</html>'''


# --------------------------------------------------------------------------
# admin  (PRD §3.7)
# --------------------------------------------------------------------------
def build_admin():
    at('admin.html')
    tool_rows = ''
    for x in TOOL_LIST:
        tool_rows += f'''<tr data-admin-tool="{x['slug']}">
  <td><a class="rank-tool" href="{url_tool(x['slug'])}"><span class="tool-icon" style="width:28px;height:28px"><img src="{a(x['logo'])}" alt="" width="28" height="28" loading="lazy"></span><strong>{esc(L(x, 'name'))}</strong></a></td>
  <td><span class="chip">{esc(L(cat(x['category']), 'name'))}</span></td>
  <td>{num(x['votes_week'])}</td>
  <td><label class="switch"><input type="checkbox" data-toggle-featured {'checked' if x['is_featured'] else ''}><span></span></label></td>
  <td><button class="btn btn--ghost btn--sm" type="button" data-unpublish>{'下架' if LANG == 'zh' else 'Unpublish'}</button></td>
</tr>'''
    h1 = '后台管理' if LANG == 'zh' else 'Admin'
    sub = ('审核免费提交、确认付款、管理收录与置顶。付费档在确认收款前不能通过审核上线。数据来自服务器上的提交记录。'
           if LANG == 'zh' else
           'Review free submissions, confirm payments, manage listings and pins. Paid tiers cannot be approved until payment is confirmed. Data comes from the submission store on the server.')
    content = f'''<div class="container">
  <header class="page-head">
    <h1 class="page-title">{h1}</h1>
    <p class="page-sub">{sub}</p>
  </header>

  <div class="admin-stats" data-admin-stats></div>

  <section class="admin-block">
    <h2>{'审核队列' if LANG == 'zh' else 'Review queue'}</h2>
    <p class="admin-hint">{'标准、精选、专业和周广告在确认收款前，「通过」不可用。请在下方「待付款」里确认收款后再上线。' if LANG == 'zh' else 'Approve is unavailable for Standard, Featured, Pro and weekly ads until payment is confirmed. Use Awaiting payment below.'}</p>
    <div data-review-queue></div>
  </section>

  <section class="admin-block">
    <h2>{'待付款' if LANG == 'zh' else 'Awaiting payment'}</h2>
    <div data-orders></div>
  </section>

  <section class="admin-block">
    <h2>{'周广告位' if LANG == 'zh' else 'Weekly ad slots'}</h2>
    <p class="admin-hint">{'按周出租。起止日期一到就自动上下架，不需要重新构建站点。榜单位在每周页第 3、4 名之间；侧栏位在首页与「最新收录」页的右栏顶部。' if LANG == 'zh' else 'Rented by the week. A placement appears and disappears on its own dates — no rebuild needed. Board sits between 3rd and 4th on the weekly page; sidebar sits at the top of the right rail on the homepage and Just added.'}</p>
    <form class="ad-form" data-ad-form>
      <label class="ad-form__field"><span>{'位置' if LANG == 'zh' else 'Slot'}</span>
        <select name="slot">
          <option value="board">{'榜单位' if LANG == 'zh' else 'Board slot'}</option>
          <option value="sidebar">{'侧栏位' if LANG == 'zh' else 'Sidebar slot'}</option>
        </select>
      </label>
      <label class="ad-form__field"><span>{'名称' if LANG == 'zh' else 'Name'}</span>
        <input name="name" required maxlength="60" placeholder="Acme Analytics">
      </label>
      <label class="ad-form__field ad-form__field--wide"><span>{'一句话' if LANG == 'zh' else 'One line'}</span>
        <input name="headline" required maxlength="90" placeholder="{'产品分析，五分钟接入' if LANG == 'zh' else 'Product analytics in five minutes'}">
      </label>
      <label class="ad-form__field ad-form__field--wide"><span>{'链接' if LANG == 'zh' else 'URL'}</span>
        <input name="url" required placeholder="https://example.com/?utm_source=atlas">
      </label>
      <label class="ad-form__field ad-form__field--wide"><span>{'Logo 地址（可空）' if LANG == 'zh' else 'Logo URL (optional)'}</span>
        <input name="logo" placeholder="https://example.com/logo.png">
      </label>
      <label class="ad-form__field"><span>{'开始' if LANG == 'zh' else 'Start'}</span>
        <input type="date" name="start" value="{BUILD_DATE.isoformat()}">
      </label>
      <label class="ad-form__field"><span>{'结束' if LANG == 'zh' else 'End'}</span>
        <input type="date" name="end" value="{(BUILD_DATE + timedelta(days=6)).isoformat()}">
      </label>
      <button class="btn btn--primary ad-form__submit" type="submit">{'添加排期' if LANG == 'zh' else 'Add placement'}</button>
    </form>
    <div data-ad-list></div>
  </section>

  <section class="admin-block">
    <h2>{'工具管理' if LANG == 'zh' else 'Tools'}</h2>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>{'工具' if LANG == 'zh' else 'Tool'}</th><th>{t('categories')}</th><th>{'本周票数' if LANG == 'zh' else 'Votes'}</th><th>Featured</th><th></th></tr></thead>
        <tbody>{tool_rows}</tbody>
      </table>
    </div>
  </section>
</div>'''
    title = ('后台管理 | Product Atlas' if LANG == 'zh' else 'Admin | Product Atlas')
    desc = 'Admin: review queue, listing management and orders.'
    return page(title, desc, content, 'admin', 'admin.html', noindex=True)


# --------------------------------------------------------------------------
# legal / sign-in / 404
# --------------------------------------------------------------------------
PRIVACY_EN = [
    ('Introduction', ['We respect your privacy and are committed to protecting your personal data. This policy explains what we collect and how we use it.']),
    ('Information We Collect', ['Account information — the name and email you provide when signing in.',
                                'Usage data — which pages and listings you interact with, used to improve the directory.',
                                'Submission data — the product details, links and logos you send us for review.',
                                'Payment data — paid orders are confirmed by hand. This site does not collect or store card numbers.']),
    ('How We Use It', ['To publish and maintain listings, record manual payments, prevent abuse, and send service messages when email notices are turned on.']),
    ('Sharing', ['We do not sell personal data. We share it only with processors that help us run the service, or where the law requires it.']),
    ('Your Rights', ['You can access, correct, export or delete your data from your account or by contacting us.']),
    ('Contact', ['Questions about this policy can be sent to the address listed on the site.']),
]
PRIVACY_ZH = [
    ('引言', ['我们尊重你的隐私，并致力于保护你的个人数据。本政策说明我们收集哪些信息以及如何使用。']),
    ('我们收集的信息', ['账号信息 —— 登录时提供的名称与邮箱。',
                        '使用数据 —— 你浏览与互动的页面，用于改进目录。',
                        '提交数据 —— 你提交审核的产品资料、链接与图标。',
                        '支付数据 —— 付费订单由站长人工确认。本站不收集、不存储银行卡号。']),
    ('使用方式', ['用于发布与维护收录、记录人工收款、防止滥用，并在站长开启邮件通知后发送服务邮件。']),
    ('共享', ['我们不出售个人数据，仅在运行服务所必需或法律要求时共享。']),
    ('你的权利', ['你可以在账号中或联系我们，访问、更正、导出或删除你的数据。']),
    ('联系方式', ['如对本政策有疑问，可通过网站上列出的邮箱联系我们。']),
]
TERMS_EN = [
    ('Introduction', ['These terms govern your use of this site. By using the service you agree to them.']),
    ('Use of the Service', ['Use the service lawfully and keep your account secure. You are responsible for activity under your account.']),
    ('Listings and Submissions', ['We may edit, decline or remove listings that are inaccurate, misleading, duplicated, or link to a site that does not work. Free listings go live after manual review and carry a nofollow link.']),
    ('Payments', ['Paid placements are a one-time fee for a fixed pin period, as shown at checkout. They do not renew automatically.']),
    ('Content', ['You keep ownership of what you submit and grant us a licence to display it on the service.']),
    ('Disclaimers', ['The directory is provided “as is”. We do not control third-party tools and are not responsible for their content or availability.']),
    ('Changes', ['We may update these terms; continued use means you accept the updated version.']),
]
TERMS_ZH = [
    ('引言', ['本条款适用于你对本站的使用。使用本服务即表示你同意这些条款。']),
    ('服务使用', ['请合法使用本服务并妥善保管账号，账号下的行为由你负责。']),
    ('收录与提交', ['对于不准确、误导、重复或链接失效的收录，我们可以编辑、拒绝或下架。免费收录经人工审核后展示，外链为 nofollow。']),
    ('支付', ['付费置顶为一次性费用，置顶周期以结账页为准，不会自动续费。']),
    ('内容', ['你保留所提交内容的所有权，并授权我们在本服务中展示。']),
    ('免责声明', ['本目录按「现状」提供。我们不控制第三方工具，也不对其内容与可用性负责。']),
    ('变更', ['我们可能更新本条款，继续使用即表示接受更新后的版本。']),
]


def build_legal(kind):
    zh = LANG == 'zh'
    if kind == 'privacy':
        blocks = PRIVACY_ZH if zh else PRIVACY_EN
        title = '隐私政策' if zh else 'Privacy Policy'
        sub = '我们如何收集、使用与保护你的个人信息。' if zh else 'How we collect, use and protect your personal information.'
        fname, meta_title = 'privacy-policy.html', ('隐私政策 | Product Atlas' if zh else 'Privacy Policy | Product Atlas')
    else:
        blocks = TERMS_ZH if zh else TERMS_EN
        title = '服务条款' if zh else 'Terms of Service'
        sub = '使用本站及其服务的规则。' if zh else 'The rules for using this site and its services.'
        fname, meta_title = 'terms-of-service.html', ('服务条款 | Product Atlas' if zh else 'Terms of Service | Product Atlas')
    at(fname)
    body = ''.join(
        f'<section class="doc-section" style="padding-top:24px"><h2>{esc(h)}</h2>'
        + ''.join(f'<p>{esc(p)}</p>' for p in ps) + '</section>'
        for h, ps in blocks)
    content = f'''<div class="container">
  <div class="article">
    <a class="back-link" href="{u('index.html')}">{icon('arrow-left')}{t('back_home')}</a>
    <h1 class="page-title">{title}</h1>
    <p class="page-sub">{sub}</p>
    <p class="stat-line" style="margin-top:12px">{'最后更新' if zh else 'Last updated'}：2026-10-29</p>
    <div style="margin-top:8px">{body}</div>
  </div>
</div>'''
    ld = ld_graph(
        ld_breadcrumb_obj([(t('discover'), 'index.html'), (title, fname)]),
        {**ld_webpage_obj(meta_title, sub, fname),
         'dateModified': '2026-10-29', 'datePublished': '2026-10-29'},
    )
    return page(meta_title, sub, content, '', fname, ld)


def build_signin():
    at('sign-in.html')
    zh = LANG == 'zh'
    h1 = '登录' if zh else 'Sign in'
    sub = ('登录后可以提交产品、查看收录进度并投票。我们只用 Google 验证你的身份，不保存密码。'
           if zh else
           'Sign in to submit products, track your listing and vote. Google verifies you — we never see a password.')
    # Resolved outside the f-string: inside a nested string literal the braces
    # are plain text, which is how four dead links got shipped once.
    tos = u('terms-of-service.html')
    priv = u('privacy-policy.html')
    agree = (f'登录即表示你同意我们的<a href="{tos}">服务条款</a>与<a href="{priv}">隐私政策</a>。'
             if zh else
             f'By signing in you agree to our <a href="{tos}">Terms</a> and '
             f'<a href="{priv}">Privacy Policy</a>.')
    content = f'''<div class="container">
  <div class="narrow">
    <header class="page-head"><h1 class="page-title">{h1}</h1><p class="page-sub">{sub}</p></header>
    <div class="form-card">
      <button class="btn btn--google btn--block" type="button" data-signin-google>{google_g()}{'使用 Google 继续' if zh else 'Continue with Google'}</button>
      <p class="auth-note" data-auth-error hidden></p>
      <p class="form-note">{'我们只读取你的姓名、邮箱和头像，用来显示账户和关联你提交的产品。不会获得 Gmail、云盘或其他任何数据。'
                            if zh else
                            'We read only your name, email and avatar — enough to show your account and attach the products you submit. No access to Gmail, Drive or anything else.'}</p>
      <p class="form-note">{agree}</p>
    </div>
  </div>
</div>'''
    return page(('登录 | Product Atlas' if zh else 'Sign in | Product Atlas'),
                ('登录 Product Atlas。' if zh else 'Sign in to Product Atlas.'),
                content, '', 'sign-in.html', noindex=True)


def build_404():
    at('404.html')
    zh = LANG == 'zh'
    body = f'''<div class="center-page"><div>
  <h1>404</h1>
  <p>{'页面不存在' if zh else 'Page not found'}</p>
  <a class="btn btn--primary" href="{u('index.html')}">{t('back_home')}</a>
</div></div>'''
    return f'''<!DOCTYPE html>
<html lang="{'zh-Hans' if zh else 'en'}" class="light">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{'页面不存在 | Product Atlas' if zh else 'Page not found | Product Atlas'}</title>
<meta name="description" content="{'你访问的页面不存在或已被移除。' if zh else 'The page you are looking for does not exist or has been removed.'}">
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="{a('assets/img/brand/logo.png')}"><link rel="stylesheet" href="{au('assets/css/style.css')}">
</head><body>{body}</body></html>'''


# --------------------------------------------------------------------------
# user settings area  /settings/*
# --------------------------------------------------------------------------
SET_TOP = [('overview', 'set_overview', 'settings/index.html', 'layout-dashboard')]
SET_GROUPS = [
    ('set_grp_activity', [
        ('submissions', 'set_submissions', 'settings/submissions.html', 'inbox'),
    ]),
    ('set_grp_account', [
        ('profile', 'set_profile', 'settings/profile.html', 'user'),
    ]),
    ('set_grp_content', [
        ('tickets', 'set_tickets', 'settings/tickets.html', 'life-buoy'),
    ]),
]


def set_nav_item(active, key, label_key, href, ic):
    cls = 'nav-item is-active' if active == key else 'nav-item'
    cur = ' aria-current="page"' if active == key else ''
    return f'<li><a class="{cls}" href="{u(href)}"{cur}>{icon(ic)}{t(label_key)}</a></li>'


def set_nav_groups(active):
    out = [f'<div class="nav-group"><ul class="nav-list">'
           f'{"".join(set_nav_item(active, *n) for n in SET_TOP)}</ul></div>']
    for label_key, items in SET_GROUPS:
        out.append(
            f'<div class="nav-group"><p class="nav-group__label">{t(label_key)}</p>'
            f'<ul class="nav-list">{"".join(set_nav_item(active, *n) for n in items)}</ul></div>')
    return ''.join(out)


def user_sidebar(active):
    return f'''<aside class="sidebar sidebar--user">
  <div class="sidebar__brand">{brand()}</div>
  <div class="sidebar__body">
    <nav class="sidebar__nav">{set_nav_groups(active)}</nav>
    <div class="sidebar__foot">
      <a class="nav-item" href="{u('index.html')}">{icon('home')}{t('set_home')}</a>
      <div class="user-chip" data-user-chip>
        <span class="user-chip__avatar" data-user-avatar>{(LANG == 'zh' and '用') or 'U'}</span>
        <span class="user-chip__text">
          <b data-user-name>{t('set_profile')}</b>
          <em data-user-email>—</em>
        </span>
        <button class="user-chip__more" type="button" data-user-menu aria-label="{t('set_profile')}">{icon('more-vertical', size=16)}</button>
      </div>
    </div>
  </div>
</aside>'''


def user_drawer():
    return f'''<div class="drawer-root" id="drawer-root" role="dialog" aria-modal="true" aria-label="Menu">
  <div class="modal-overlay" data-drawer-close></div>
  <div class="drawer">
    <div class="sidebar__brand">{brand()}</div>
    <nav class="sidebar__nav">{set_nav_groups('')}</nav>
    <div class="drawer__foot">
      <a class="nav-item" href="{u('index.html')}">{icon('home')}{t('set_home')}</a>
    </div>
  </div>
</div>'''


def user_page(title, desc, content, active, path):
    """Settings pages: own sidebar, no marketing topbar/footer, noindex."""
    global PATH
    PATH = path
    lang_attr = 'zh-Hans' if LANG == 'zh' else 'en'
    sb, dr = user_sidebar(active), user_drawer()
    sm = search_modal()
    # build the topbar before the sprite so its icon lands in USED_ICONS
    top = (f'<header class="set-topbar">\n'
           f'  <button class="icon-btn" type="button" aria-label="Toggle sidebar" '
           f'data-drawer-open>{icon("panel-left", size=18)}</button>\n'
           f'</header>')
    sprite = build_sprite()
    signin = u('sign-in.html')
    guard = ("<script>(function(){try{"
             "if(!localStorage.getItem('dir-user')){"
             "location.replace('" + signin + "?next=" + path + "');}"
             "}catch(e){}})();</script>")
    return f'''<!DOCTYPE html>
<html lang="{lang_attr}" class="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="noindex,nofollow">
<meta name="generator" content="Product Atlas">
<meta property="og:title" content="{esc(title)}">
<meta property="og:site_name" content="{SITE_NAME}">
<meta property="og:locale" content="{'zh_CN' if LANG == 'zh' else 'en_US'}">
<link rel="icon" href="{a('assets/img/brand/logo.png')}">
<link rel="stylesheet" href="{au('assets/css/style.css')}">
{THEME_INIT}
{guard}
</head>
<body class="is-settings" data-lang="{LANG}" data-root="{R()}" data-assetroot="{RA()}">
{sprite}
<div class="shell">
{sb}
<div class="main">
{top}
<main class="set-main" data-set-page="{active}">{content}</main>
</div>
</div>
{sm}
{dr}
<script src="{au('assets/js/app.js')}"></script>
</body>
</html>'''


def set_head(h1, sub, actions=''):
    return f'''<header class="set-head">
  <div>
    <h1 class="page-title">{h1}</h1>
    <p class="page-sub">{sub}</p>
  </div>
  {actions}
</header>'''


def set_stat(label, value_html, note, ic='', action_html=''):
    ic_html = f'<span class="set-stat__ic">{icon(ic)}</span>' if ic else ''
    return f'''<div class="set-stat">
  <div class="set-stat__top"><span class="set-stat__label">{label}</span>{ic_html}</div>
  <p class="set-stat__value">{value_html}</p>
  <div class="set-stat__foot"><span>{note}</span>{action_html}</div>
</div>'''


def set_card(title, body, more=None, cls=''):
    more_html = ''
    if more:
        more_html = (f'<a class="set-card__more" href="{more[1]}">{more[0]}'
                     f'{icon("chevron-right", size=14)}</a>')
    head = f'<div class="set-card__head"><h2>{title}</h2>{more_html}</div>' if title else ''
    return f'<section class="set-card {cls}">{head}<div class="set-card__body">{body}</div></section>'


def set_tabs(items, active_key='all', attr='data-set-tab'):
    lis = ''.join(
        f'<button class="set-tab{" is-active" if k == active_key else ""}" type="button" '
        f'{attr}="{k}">{label}</button>' for k, label in items)
    return f'<div class="set-tabs" role="tablist">{lis}</div>'


def set_table(cols, empty, search=True, select=None, body_attr=''):
    ths = ''.join(f'<th>{c}</th>' for c in cols)
    sel = ''
    if select:
        opts = ''.join(f'<option value="{v}">{l}</option>' for v, l in select)
        sel = (f'<label class="set-select"><select data-set-status>{opts}</select>'
               f'{icon("chevron-down", size=14)}</label>')
    sear = ''
    if search:
        sear = (f'<label class="set-search">{icon("search", size=15)}'
                f'<input type="search" placeholder="{t("set_search")}" data-set-search></label>')
    return f'''<section class="set-card set-card--table">
  <div class="set-toolbar">{sear}{sel}
    <button class="icon-btn set-refresh" type="button" data-set-refresh aria-label="Refresh">{icon('refresh-cw', size=16)}</button>
  </div>
  <div class="table-wrap">
    <table class="set-table">
      <thead><tr>{ths}</tr></thead>
      <tbody {body_attr}></tbody>
    </table>
    <p class="set-empty" data-set-empty>{empty}</p>
  </div>
  <div class="set-foot"><span data-set-count></span></div>
</section>'''


def set_modal(mid, title, body, confirm_label, confirm_attr, extra_btn=''):
    return f'''<div class="modal-root" id="{mid}" role="dialog" aria-modal="true" aria-labelledby="{mid}-t">
  <div class="modal-overlay" data-close-modal></div>
  <div class="modal modal--pay">
    <h2 id="{mid}-t">{title}</h2>
    {body}
    <div class="modal__actions">
      <button class="btn btn--ghost" type="button" data-close-modal>{t('set_cancel')}</button>
      {extra_btn}
      <button class="btn btn--primary" type="button" {confirm_attr}>{confirm_label}</button>
    </div>
  </div>
</div>'''


def build_settings_overview():
    """Account overview, built around what the site actually sells.

    There is no credit balance and no subscription to manage: a listing is
    bought once. So the three stats are plan / submissions / tickets, and the
    upgrade link goes to the public pricing page rather than to a billing
    screen that would have nothing to show.
    """
    at('settings/index.html')
    zh = LANG == 'zh'
    subs_label = '我的提交' if zh else 'My submissions'
    subs_note = ('<span data-subs-note>审核中 0 · 已上线 0</span>' if zh
                 else '<span data-subs-note>0 in review · 0 live</span>')
    plan_note = '一次付费，不订阅' if zh else 'One-time, never a subscription'
    see_pricing = '查看定价' if zh else 'See pricing'
    help_title = '需要帮助' if zh else 'Need a hand'
    help_body = ('免费收录人工审核，' + sla(FREE_SLA) + '。付费收录（标准 / 精选 / 专业）：' + sla(PAID_SLA) + '。' + sla(MAIL_NOTE)
                 if zh else
                 'Free listings are reviewed by hand, ' + sla(FREE_SLA) + '. Paid listings (Standard, Featured, Pro): ' + sla(PAID_SLA)[0].lower() + sla(PAID_SLA)[1:] + '. ' + sla(MAIL_NOTE))
    recent_title = '最近的提交' if zh else 'Recent submissions'
    recent_body = ('<div class="set-mini" data-overview-subs></div>'
                   '<p class="set-mini__empty" data-overview-subs-empty>'
                   + ('还没有提交。' if zh else 'Nothing submitted yet.')
                   + '</p>')

    stats = f'''<div class="set-stats">
  {set_stat(t('set_plan'), f'<span data-stat="plan">{t("set_free")}</span>', plan_note, 'sparkles',
            f'<a class="set-stat__act" href="{u("pricing.html")}">{see_pricing}</a>')}
  {set_stat(subs_label, '<span data-stat="subs">0</span>', subs_note, 'inbox',
            f'<a class="set-stat__act" href="{u("settings/submissions.html")}">{t("view_all")}</a>')}
  {set_stat(t('set_support'), '24h', ('开启邮件后' if zh else 'after email is on'), 'life-buoy',
            f'<a class="set-stat__act" href="{u("settings/tickets.html")}">{("联系" if zh else "Contact")}</a>')}
</div>'''
    recent = set_card(recent_title, recent_body,
                      (t('view_all'), u('settings/submissions.html')))
    help_card = set_card(help_title, f'<div class="set-mini"><p>{help_body}</p></div>',
                         (t('pricing'), u('pricing.html')))
    content = f'''<div class="set-container">
  {set_head(t('set_overview'), f'{t("set_welcome")} <span data-user-name>{t("set_profile")}</span>')}
  {stats}
  <div class="set-grid-2">{recent}{help_card}</div>
</div>'''
    return user_page(f'{t("set_overview")} | {SITE_NAME}',
                     'Your account overview.', content, 'overview', 'settings/index.html')


def build_settings_submissions():
    at('settings/submissions.html')
    actions = (f'<div class="set-head__actions">'
               f'<a class="btn btn--ghost" href="{u("submit.html")}?plan=paid">{t("set_become_sponsor")}</a>'
               f'<a class="btn btn--primary" href="{u("submit.html")}">{icon("plus")}{t("set_submit_tool")}</a></div>')
    # reuses the dashboard renderer in app.js (data-dash-list)
    content = f'''<div class="set-container">
  {set_head(t('set_submissions'), t('set_subs_sub'), actions)}
  <div class="set-card set-card--flush"><div data-dash-list></div></div>
</div>'''
    return user_page(f'{t("set_submissions")} | {SITE_NAME}',
                     'Manage your submitted tools.', content, 'submissions', 'settings/submissions.html')


def build_settings_profile():
    at('settings/profile.html')
    content = f'''<div class="set-container">
  {set_head(t('set_profile'), t('set_profile_sub'))}
  <form class="set-card set-card--form" data-profile-form>
    <div class="set-card__head"><h2>{t('set_profile')}</h2></div>
    <div class="set-card__body">
      <div class="field">
        <label class="field__label">{t('set_avatar')}</label>
        <button class="avatar-drop" type="button" data-avatar-pick>
          <span class="avatar-drop__ic">{icon('upload', size=20)}</span>
          <span class="avatar-drop__label">{t('set_upload')}</span>
          <span class="avatar-drop__hint">Max 2MB</span>
        </button>
        <input type="file" accept="image/*" hidden data-avatar-input>
        <p class="field__hint">{t('set_avatar_hint')}</p>
      </div>
      <div class="field">
        <label class="field__label" for="pf-name">{t('set_name')}</label>
        <input id="pf-name" name="name" type="text" autocomplete="name" readonly>
        <p class="field__hint">{'来自你的 Google 账户，修改请到 Google 账户设置。' if LANG == 'zh' else 'Comes from your Google account — change it in your Google settings.'}</p>
      </div>
      <div class="field">
        <label class="field__label" for="pf-email">{t('set_email')}</label>
        <input id="pf-email" name="email" type="email" disabled>
      </div>
    </div>
    <div class="set-card__foot"><button class="btn btn--primary" type="submit">{t('set_save')}</button></div>
  </form>
</div>'''
    return user_page(f'{t("set_profile")} | {SITE_NAME}',
                     'Manage your account details.', content, 'profile', 'settings/profile.html')


def build_settings_tickets():
    """Support is an email — not a ticket queue.

    This page used to render a ticket table backed by localStorage: you could
    open a ticket, watch it appear in the list, and nothing ever reached a
    human. A support channel that silently swallows messages is worse than no
    support page at all, so this is now the thing the pricing page actually
    promises: an address, and a reply within 24 hours after email is turned on.
    """
    at('settings/tickets.html')
    zh = LANG == 'zh'
    subject = quote('Support — %s' % SITE_NAME)
    mailto = f'mailto:{SITE_EMAIL}?subject={subject}'

    h1 = '联系我们' if zh else 'Contact us'
    sub = ('付费收录的优先支持走邮件：站长开启邮件后 24h 内回复；免费收录的问题也会看，只是慢一些。'
           if zh else
           'Priority support for paid listings is by email, with a reply within 24 hours after the site owner turns email on. '
           'Questions about free listings are read too, just more slowly.')

    steps = ([
        ('附上收录页面的链接', '这样我们不用先问你要链接。'),
        ('说清楚要改什么', '标题、简介、分类、标签、Logo —— 直接写「把标题改成 …」。'),
        ('如果是付款问题', '把付款时间、金额和付款方式一起发过来。'),
    ] if zh else [
        ('Include the listing URL', 'So we do not have to ask for it first.'),
        ('Say exactly what to change', 'Title, description, category, tags, logo — “change the title to …” is enough.'),
        ('For payment questions', 'Send the date, the amount and how you paid.'),
    ])
    lis = ''.join(f'<li>{icon("check")}<span><strong>{esc(a)}</strong>{esc(b)}</span></li>'
                  for a, b in steps)
    mail_body = f'''<div class="set-mini">
      <p style="font-size:15px;font-weight:600">{esc(SITE_EMAIL)}</p>
      <p style="margin-top:6px;color:var(--muted-foreground);font-size:13px">{'回复时间：站长开启邮件后，工作日 24h 内。' if zh else 'Replies within 24 hours on weekdays, after the site owner turns email on.'}</p>
      <p style="margin-top:14px"><a class="btn btn--primary" href="{mailto}">{'写邮件' if zh else 'Compose email'}{icon('arrow-up-right')}</a></p>
    </div>'''
    help_body = f'<ul class="set-steps">{lis}</ul>'

    content = f'''<div class="set-container">
  {set_head(h1, sub, '')}
  <div class="set-grid-2">
    {set_card('邮箱' if zh else 'Email', mail_body)}
    {set_card('写信时请附上' if zh else 'What to include', help_body)}
  </div>
</div>'''
    return user_page(f'{h1} | {SITE_NAME}',
                     'Contact support.', content, 'contact', 'settings/tickets.html')


# --------------------------------------------------------------------------
# SEO check  (v1.2)
# --------------------------------------------------------------------------
def build_seo_check():
    at('seo-check.html')
    zh = LANG == 'zh'

    h1 = ('SEO 诊断：粘一个链接，10 秒看完 20 项检查' if zh
          else 'SEO check: paste a link, get 20 checks in about 10 seconds')
    sub = ('不注册、不装插件、不改你的站。我们会像爬虫一样真的抓取你的页面，'
           '检查标题、结构化数据、AI 可读性、抓取索引和内容，然后告诉你先改哪几项。'
           if zh else
           'No signup, no plugin, nothing to install. We fetch your page the way a crawler does, '
           'check title, structured data, AI readability, crawlability and content — '
           'then tell you which few things to fix first.')

    dims = ([
        ('meta', '标题与描述', '标题决定点击率，描述决定要不要点。两个都缺，搜索引擎只能自己编一段。'),
        ('schema', '结构化数据', 'JSON-LD 说清这是什么、多少钱、谁做的。没有它，机器只能靠猜你的页面。'),
        ('ai', 'AI 可读性', 'AI 搜索读的是纯文本。H1 混乱、正文写在图片里、没有 llms.txt，它们就没法引用你。'),
        ('crawl', '抓取与索引', 'canonical、robots.txt、sitemap、noindex。任何一项配错，页面做得再好也进不了索引。'),
        ('content', '内容与关键词', '300 词以上、用 H2 分节、图片有 alt、有内链。这是能不能排上去的地基。'),
    ] if zh else [
        ('meta', 'Title & description', 'The title wins the click, the description decides whether there is one. Missing both, a search engine writes its own.'),
        ('schema', 'Structured data', 'JSON-LD states what this is, what it costs, who made it. Without it a machine is guessing.'),
        ('ai', 'AI readability', 'AI search reads plain text. Scattered H1s, copy baked into images and no llms.txt leave it nothing to cite.'),
        ('crawl', 'Crawl & index', 'Canonical, robots.txt, sitemap, noindex. Get one wrong and a beautiful page never enters the index.'),
        ('content', 'Content & keywords', '300+ words, H2 sections, image alt text, internal links. This is the floor you rank from.'),
    ])
    dims_html = ''.join(
        f'<article class="dim-card"><span class="dim-card__n">{i:02d}</span>'
        f'<h3>{n}</h3><p>{d}</p></article>'
        for i, (k, n, d) in enumerate(dims, 1))

    faqs = ([
        ('这个分数等于 Google 排名吗？',
         '不等于。这 20 项是技术底子：做对了才「有机会」被收录、被引用；做不对基本没机会。排名还看外链、内容质量、搜索意图，那些这项工具不测。'),
        ('为什么我分数不低，还是没流量？',
         '技术合格只是入场券。分数高说明机器读得懂你的页面，但有没有人搜、搜了会不会点，取决于关键词选择和页面本身的说服力。'),
        ('诊断完可以直接提交收录吗？',
         '可以。提交时带上刚才诊断的链接，我们会自动抓取标题、描述和图标，你只需要确认。'),
        ('你们会不会保存我查过的网址？',
         '不会存进数据库，也没有账号体系。结果只在这次请求里生成，刷新就没了。'),
    ] if zh else [
        ('Is this score my Google ranking?',
         'No. These 20 checks are the technical floor: get them right and you have a chance to be indexed and cited; get them wrong and you mostly do not. Ranking also depends on links, content quality and search intent, which this tool does not measure.'),
        ('My score is decent but I still get no traffic. Why?',
         'Technical health is the entry ticket. A high score means machines can read your page; whether anyone searches for it, and clicks, depends on keyword choice and how convincing the page is.'),
        ('Can I submit my product right after the check?',
         'Yes. Submit with the URL you just checked and we prefill the title, description and icon — you only confirm.'),
        ('Do you store the URLs I check?',
         'No database, no account. The report is built for that one request and disappears on refresh.'),
    ])
    acc = ''.join(
        f'<div class="acc-item"><button class="acc-trigger" type="button" aria-expanded="false">{esc(q)}{icon("chevron-down")}</button><div class="acc-panel">{esc(a)}</div></div>'
        for q, a in faqs)

    content = f'''<div class="container container--narrow">
  {breadcrumb([(t('discover'), u('index.html')), (t('seo_check'), None)])}

  <header class="page-head tool-head">
    <p class="tool-eyebrow">{icon('gauge')}{'免费工具 · 无需注册' if zh else 'Free tool · no signup'}</p>
    <h1 class="page-title page-title--lg">{h1}</h1>
    <p class="page-sub page-sub--lg">{sub}</p>
  </header>

  <section class="tool-panel" aria-label="{'SEO 诊断' if zh else 'SEO check'}">
    <form class="tool-form" id="audit-form" novalidate>
      <div class="tool-form__field">
        <span class="tool-form__ico">{icon('link')}</span>
        <input id="audit-url" name="url" type="text" inputmode="url" autocomplete="url"
               spellcheck="false" placeholder="https://your-product.com"
               aria-label="{'要检测的网址' if zh else 'URL to check'}">
      </div>
      <button class="btn btn--primary btn--lg" type="submit" id="audit-go">
        <span data-label>{'开始诊断' if zh else 'Run the check'}</span>{icon('arrow-right')}
      </button>
    </form>
    <p class="tool-note">{icon('shield-check')}<span>{'只读取公开页面，不需要登录或授权。抓不到就是抓不到，我们不会编一份结果。' if zh else 'We read the public page only — no login, no access. If we cannot fetch it, we say so instead of inventing a report.'}</span></p>
    <p class="tool-status" id="audit-status" role="status" aria-live="polite"></p>
    <div class="audit" id="audit-result" hidden></div>
    <noscript><p class="tool-status is-error">{'诊断需要 JavaScript。' if zh else 'The check needs JavaScript enabled.'}</p></noscript>
  </section>

  <section class="tool-section">
    {section_head('20 项检查，5 个维度' if zh else '20 checks, five areas',
                  '每项 1 分，5 个维度各 20 分，满分 100。' if zh else 'One point per check, 20 points per area, 100 total.')}
    <div class="dim-grid">{dims_html}</div>
  </section>

  <!-- filled in by the server with recently checked domains -->
  <div class="recent-check" data-recent-check></div>

  <section class="tool-section" id="dr">
    {section_head('Domain Rating' + ('（DR）' if zh else ' (DR)'),
                  'DR 是 Ahrefs 的指标，0–100，衡量有多少个不同域名链向你。它不是 Google 排名，也不该被当成排名来卖。' if zh
                  else 'DR is an Ahrefs metric on a 0–100 scale: how many distinct domains link to you. It is not a Google ranking, and should not be sold as one.')}

    <div class="dr-card">
      <form class="tool-form" id="dr-form" novalidate>
        <div class="tool-form__field">
          <span class="tool-form__ico">{icon('globe')}</span>
          <input id="dr-domain" name="domain" type="text" inputmode="url" autocomplete="off"
                 spellcheck="false" placeholder="your-product.com"
                 aria-label="{'要查询的域名' if zh else 'Domain to look up'}">
        </div>
        <button class="btn btn--outline btn--lg" type="submit" id="dr-go">
          <span data-label>{'查询 DR' if zh else 'Look up DR'}</span>
        </button>
      </form>
      <p class="tool-status" id="dr-status" role="status" aria-live="polite"></p>
      <div class="dr-result" id="dr-result" hidden></div>
      <p class="dr-disclaimer">{icon('info')}<span>{'我们只显示数据源真实返回的数字。拿不到，就告诉你拿不到——不给你一个估出来的值。' if zh else 'We only ever show a number a data source actually returned. If we cannot get one, we say so — we will not hand you an estimate dressed up as a fact.'}</span></p>
    </div>
  </section>

  <section class="tool-section">
    {section_head('常见问题' if zh else 'Questions')}
    <div class="accordion">{acc}</div>
  </section>

  <section class="tool-cta">
    <div class="tool-cta__body">
      <h2>{'诊断完，把产品提交上来' if zh else 'Checked it? Now list the product.'}</h2>
      <p>{'免费收录，页面永久保留；付费置顶拿 dofollow 反链。提交时带上你刚查的链接，资料自动填好。' if zh else 'Free to list, the page stays. A paid placement adds a dofollow backlink. Submit with the URL you just checked and the listing is prefilled.'}</p>
    </div>
    <a class="btn btn--primary btn--lg" href="{u('submit.html')}">{'提交产品' if zh else 'Submit a product'}{icon('arrow-right')}</a>
  </section>
</div>'''

    title = ('SEO 诊断工具 — 免费检查产品页的 20 项技术 SEO | Product Atlas' if zh
             else 'Free SEO Check — 20 technical checks for your product page | Product Atlas')
    desc = ('免费 SEO 诊断：粘贴网址，10 秒检查标题、结构化数据、AI 可读性、抓取索引与内容，'
            '并给出优先修复清单。无需注册。' if zh else
            'Free SEO checker: paste a URL and get 20 checks across title, structured data, '
            'AI readability, crawlability and content, with a prioritised fix list. No signup.')

    ld = ld_graph(
        ld_breadcrumb_obj([(t('discover'), 'index.html'), (t('seo_check'), 'seo-check.html')]),
        {
            '@type': 'WebApplication',
            'name': 'SEO Check' if not zh else 'SEO 诊断',
            'url': abs_url('seo-check.html'),
            'description': desc,
            'applicationCategory': 'BusinessApplication',
            'operatingSystem': 'Any',
            'browserRequirements': 'Requires JavaScript',
            'isAccessibleForFree': True,
            'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
            'publisher': {'@type': 'Organization', 'name': SITE_NAME, 'url': SITE + '/index.html'},
        },
        {
            '@type': 'FAQPage',
            'mainEntity': [
                {'@type': 'Question', 'name': q,
                 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faqs
            ],
        },
        ld_webpage_obj(title.split(' | ')[0], desc, 'seo-check.html'),
    )
    extra = f'<script src="{au("assets/js/tools.js")}" defer></script>'
    return page(title, desc, content, 'seo-check', 'seo-check.html', ld + extra)


# --------------------------------------------------------------------------
# pricing  (one-time tiers — no subscription anywhere)
# --------------------------------------------------------------------------
def build_pricing():
    """Four tiers, every one a one-time payment.

    Deliberately no subscription: a directory sells one thing (a permanent
    page), so charging monthly would be charging repeatedly for the same
    delivery. It also means no dunning, no refunds-for-forgotten-renewals and
    no churn analysis — which matters when one person runs the site.

    The ladder is $0 / $19 / $39 / $69 on purpose. An earlier version jumped
    $0 → $29 → $99: the entry price was above what this market charges for the
    same feature, and the gap to the top tier was 3.4×, so there was nothing to
    step onto in between. Each step here is roughly double, which is the only
    shape where "upgrade one level" feels like a decision rather than a jump.
    """
    at('pricing.html')
    zh = LANG == 'zh'

    tiers = [
        {
            'key': 'free', 'hl': False,
            'name': ('免费' if zh else 'Free'),
            'price': money('free', zh)[0], 'unit': money('free', zh)[1],
            'blurb': ('先上站。链接是 nofollow，但页面永久保留，也照常进每周榜单。'
                      if zh else 'Get listed. The link is nofollow, but the page is yours to keep.'),
            'feats': ([
                '人工审核，' + sla(FREE_SLA, True),
                '目录页 + 分类页展示',
                '链接是 nofollow，不传递权重',
                '永久保留，可参与每周榜单',
            ] if zh else [
                'Manual review, ' + sla(FREE_SLA, False),
                'Directory and category listing',
                'Nofollow link — it passes no authority',
                'Stays online, competes on the weekly board',
            ]),
            'cta': ('免费提交' if zh else 'Submit free'),
            'href': 'submit.html?plan=free',
        },
        {
            'key': 'standard', 'hl': False,
            'name': ('标准' if zh else 'Standard'),
            'price': money('standard', zh)[0], 'unit': money('standard', zh)[1],
            'blurb': ('最便宜的一次升级：链接变成永久 dofollow。'
                      if zh else 'The cheapest upgrade that matters: the link turns dofollow.'),
            'feats': ([
                sla(PAID_SLA, True),
                '永久 dofollow 反链，不挂 badge、不复查',
                '目录页排在免费收录之前',
                '永久保留，可参与每周榜单',
            ] if zh else [
                sla(PAID_SLA, False),
                'Permanent dofollow, no badge, no re-checking',
                'Listed above every free submission',
                'Stays online, competes on the weekly board',
            ]),
            'cta': ('升级到标准' if zh else 'Go Standard'),
            'href': 'submit.html?plan=standard',
        },
        {
            'key': 'featured', 'hl': True,
            'name': ('精选' if zh else 'Featured'),
            'price': money('featured', zh)[0], 'unit': money('featured', zh)[1],
            'blurb': ('要位置就选这个：目录和分类页最前面，加首页卡。'
                      if zh else 'If you want the position: top of the directory and category, plus the homepage card.'),
            'feats': ([
                '标准档的全部权益',
                '目录页 + 分类页置顶 7 天',
                '首页精选卡排期（每期 1 个）',
                '7 天后自动回到标准档排序，链接不变',
            ] if zh else [
                'Everything in Standard',
                'Pinned on the directory and category for 7 days',
                'A slot in the homepage rotation (one per period)',
                'After 7 days it drops back to Standard — the link stays',
            ]),
            'cta': ('选精选' if zh else 'Go Featured'),
            'href': 'submit.html?plan=featured',
        },
        {
            'key': 'pro', 'hl': False,
            'name': ('专业' if zh else 'Pro'),
            'price': money('pro', zh)[0], 'unit': money('pro', zh)[1],
            'blurb': ('长期占住一个分类页第一屏。'
                      if zh else 'For holding the top of one category page, long term.'),
            'feats': ([
                '精选档的全部权益',
                '分类页置顶 90 天',
                '全年 4 次文案修改（标题、描述、截图）',
                sla(PRO_REPLY, True),
            ] if zh else [
                'Everything in Featured',
                'Pinned on its category page for 90 days',
                'Four copy edits a year (title, description, shots)',
                'Replies within 24 hours after the site owner turns email on',
            ]),
            'cta': ('选专业' if zh else 'Choose Pro'),
            'href': 'submit.html?plan=pro',
        },
    ]

    cards = ''
    for t_ in tiers:
        feats = ''.join(
            f'<li>{icon("circle-check")}<span>{esc(f)}</span></li>' for f in t_['feats'])
        cards += f'''<div class="price-card{' price-card--hl' if t_['hl'] else ''}">
  {'<p class="price-card__flag">' + ('最多人选' if zh else 'Most picked') + '</p>' if t_['hl'] else ''}
  <h3 class="price-card__name">{esc(t_['name'])}</h3>
  <p class="price-card__blurb">{esc(t_['blurb'])}</p>
  <p class="price-card__amount"><b>{t_['price']}</b><span>{esc(t_['unit'])}</span></p>
  <ul class="price-feats">{feats}</ul>
  <a class="btn {'btn--primary' if t_['hl'] else 'btn--outline'} btn--block" href="{u(t_['href'])}">{esc(t_['cta'])}{icon('arrow-right')}</a>
</div>'''

    # Only things the build can actually enforce are in this table. "90 days of
    # view stats" and "one newsletter mention" used to sit here; neither
    # existed, and a comparison table is the one place a buyer will check.
    rows = [
        (('上线时间' if zh else 'Goes live'),
         ('通常 7–14 天，不保证' if zh else 'Usually 7–14 days, not guaranteed'),
         ('确认收款当天' if zh else 'Day payment is confirmed'),
         ('确认收款当天' if zh else 'Day payment is confirmed'),
         ('确认收款当天' if zh else 'Day payment is confirmed')),
        (('反链类型' if zh else 'Outbound link'), 'nofollow',
         ('永久 dofollow' if zh else 'Permanent dofollow'), ('永久 dofollow' if zh else 'Permanent dofollow'),
         ('永久 dofollow' if zh else 'Permanent dofollow')),
        (('目录页排序' if zh else 'Directory order'), ('最后' if zh else 'Last'),
         ('优先' if zh else 'Priority'), ('置顶 7 天' if zh else 'Top, 7 days'), ('置顶 90 天' if zh else 'Top, 90 days')),
        (('分类页置顶' if zh else 'Category pin'), '—', '—',
         ('7 天' if zh else '7 days'), ('90 天' if zh else '90 days')),
        (('首页精选卡' if zh else 'Homepage card'), '—', '—',
         ('排期' if zh else 'Rotating'), ('排期' if zh else 'Rotating')),
        (('文案修改' if zh else 'Copy edits'), '—', '—', '—', ('全年 4 次' if zh else '4 a year')),
        (('支持' if zh else 'Support'), ('普通' if zh else 'Standard'),
         ('普通' if zh else 'Standard'), ('普通' if zh else 'Standard'),
         ('开启邮件后 24h' if zh else '24h after email is on')),
        (('价格' if zh else 'Price'), money('free', zh)[0], money('standard', zh)[0],
         money('featured', zh)[0], money('pro', zh)[0]),
    ]
    trs = ''.join(
        f'<tr><th scope="row">{esc(r[0])}</th><td>{esc(r[1])}</td>'
        f'<td>{esc(r[2])}</td><td class="is-hl">{esc(r[3])}</td><td>{esc(r[4])}</td></tr>'
        for r in rows)

    # ---- weekly ad slots ---------------------------------------------------
    # Rented by the week, not bought outright. A placement is a scarce thing
    # that expires; charging once for it would mean the same two rows are sold
    # forever and the price never reflects demand.
    ad_slots = [
        {
            'key': 'board', 'price': 'board',
            'tag': ('榜单位' if zh else 'Board slot'),
            'title': ('本周榜单第 3、4 名之间' if zh
                      else 'Between 3rd and 4th on this week’s board'),
            'desc': ('榜单里唯一会被完整读完的一行 —— 人在决定投谁的时候正好看到你。' if zh
                     else 'The one row people read properly, at the moment they decide what to upvote.'),
            'feats': ([
                '整行展示：logo、标题、一句话卖点',
                '直达你指定的落地页，中间没有跳转页',
                '展示 7 天，周一起算',
            ] if zh else [
                'A full row: logo, headline, one-line pitch',
                'Links straight to the page you choose, no interstitial',
                'Seven days, starting Monday',
            ]),
        },
        {
            'key': 'sidebar', 'price': 'sidebar',
            'tag': ('右栏位' if zh else 'Sidebar slot'),
            # Not "site-wide": the rail is only rendered on the homepage and the
            # just-added feed. Saying otherwise was a claim the build could not
            # keep, and a buyer would notice on the second page they visited.
            'title': ('首页与「最新收录」页的右栏' if zh
                      else 'The rail on the homepage and the just-added feed'),
            'desc': ('右栏不随页面滚走 —— 访客在这两页停留的整段时间里一直看到它。' if zh
                     else 'The rail does not scroll away — it stays in view for the whole visit on both pages.'),
            'feats': ([
                '首页 + 最新收录页的右栏顶部',
                '卡片形态，含 logo 与一句话',
                '展示 7 天，周一起算',
            ] if zh else [
                'Top of the rail on the homepage and the just-added feed',
                'A card with your logo and one line',
                'Seven days, starting Monday',
            ]),
        },
    ]
    ad_cards = ''
    for s in ad_slots:
        feats = ''.join(
            f'<li>{icon("circle-check")}<span>{esc(f)}</span></li>' for f in s['feats'])
        cta = '预订这个位置' if zh else 'Book this spot'
        price, per = money(s['price'], zh)
        # Second axis of choice: same slot, four weeks, cheaper per week. The
        # saving is computed from PLANS so the two numbers cannot drift.
        wk = int(PLANS[s['price']]['usd'].strip('$'))
        blk = int(PLANS[s['price'] + '4']['usd'].strip('$'))
        save = wk * 4 - blk
        alt = (f'连投 4 周 {money(s["price"] + "4", zh)[0]} · 省 ${save}' if zh
               else f'4 weeks {money(s["price"] + "4", zh)[0]} — save ${save}')
        ad_cards += f'''<article class="ad-card">
  <div class="ad-card__top">
    <span class="ad-card__tag">{esc(s['tag'])}</span>
    <p class="ad-card__price"><b>{price}</b><span>{per}</span></p>
  </div>
  <h3 class="ad-card__title">{esc(s['title'])}</h3>
  <p class="ad-card__desc">{esc(s['desc'])}</p>
  <ul class="price-feats">{feats}</ul>
  <p class="ad-card__alt">{esc(alt)}</p>
  <a class="btn btn--primary btn--block" href="{u('submit.html')}?plan=ad&amp;slot={s['key']}">{cta}{icon('arrow-right')}</a>
  <p class="ad-card__note">{'按周计费，到期自动下架，可续租。' if zh else 'Billed weekly. Comes down when the week ends. Renew any time.'}</p>
</article>'''

    ad_h = '周广告位' if zh else 'Weekly ad slots'
    ad_sub = ('榜单位 %s / 周，右栏位 %s / 周；连投 4 周分别 %s 和 %s。'
              '榜单位是「决定投谁」的那一屏，所以更贵；右栏按停留时长卖，所以更便宜。'
              '位置是租的，不是买的 —— 不用提交产品，也可以和收录同时买。'
              % (money('board', zh)[0], money('sidebar', zh)[0],
                 money('board4', zh)[0], money('sidebar4', zh)[0])
              if zh else
              'Board %s a week, sidebar %s a week — or %s and %s for four weeks. The board is the screen '
              'where people decide what to upvote, so it costs more; the rail is sold on time-on-page, so it '
              'costs less. Both are rented, not bought — no product submission needed, and you can run one '
              'alongside a listing.'
              % (money('board', zh)[0], money('sidebar', zh)[0],
                 money('board4', zh)[0], money('sidebar4', zh)[0]))

    faq = [
        (('真的只付一次吗？' if zh else 'Is it really one payment?'),
         ('是。没有订阅、没有自动续费、没有隐藏费用。你买的是一次上架，不是一个按月租的位置。'
          if zh else
          'Yes. No subscription, no auto-renewal, no hidden fees. You are buying one listing, not renting a slot by the month.')),
        (('免费和付费差在哪？' if zh else 'What do I get by paying?'),
         ('三件事：等待时间、链接类型、展示位置。免费要排队，' + sla(FREE_SLA, True) + '，链接是 nofollow；'
          '付费档：' + sla(PAID_SLA, True) + '，反链永久 dofollow，目录页排在免费收录之前。再往上一档才开始买「位置」——'
          '目录页和分类页置顶 7 天。'
          if zh else
          'Three things: how long you wait, what kind of link you get, and where you appear. Free waits '
          + sla(FREE_SLA, False) + ', and the link is nofollow. Paid tiers ' + sla(PAID_SLA, False)[0].lower() + sla(PAID_SLA, False)[1:]
          + ', with a permanent dofollow link, listed above every free submission. Buying an actual position starts one tier up, at Featured.')),
        (('为什么中间还有一个 $19？' if zh else 'Why is there a $19 tier in the middle?'),
         ('因为绝大多数人只想要两件事：链接变 dofollow、确认收款后当天上线。他们并不想买首页位置，'
          '如果只有「免费」和「置顶」两个选择，这些人要么白嫖，要么被推去买一个用不上的档位。'
          '标准档就是给他们准备的。'
          if zh else
          'Because most people want exactly two things: the link turns dofollow, and the listing goes live the day payment is confirmed. They do '
          'not want a homepage slot. With only "free" and "pinned", those people either freeload or get pushed into '
          'a tier they do not need. Standard exists for them.')),
        (('dofollow 反链是永久的吗？' if zh else 'Is the dofollow link permanent?'),
         ('付费的是永久的：不用挂 badge，不复查，不会因为某天忘了续费而消失。免费收录是 nofollow，但页面和链接永久保留，不删。'
          if zh else
          'On paid, yes — permanent. No badge to install, no periodic re-check, nothing that lapses because you forgot to renew. Free listings are nofollow, but the page and the link stay up; we do not take them down.')),
        (('广告位和收录有什么区别？' if zh else 'How is an ad slot different from a listing?'),
         ('收录是买一个页面，一次付费、长期存在；广告位是租一个位置，按周计费、到期下架。两者互不影响，也可以同时买。'
          '榜单位 %s / 周，右栏位 %s / 周 —— 榜单是决定投票的那一屏，所以比右栏贵；连投 4 周有折扣。'
          % (money('board', zh)[0], money('sidebar', zh)[0])
          if zh else
          'A listing is a page you buy once and keep. An ad slot is a position you rent by the week and lose when '
          'the week ends. They do not compete, and you can run both. Board is %s a week, sidebar %s a week — the '
          'board is the screen where people decide what to upvote, which is why it costs more. Four-week blocks '
          'are cheaper per week.' % (money('board', zh)[0], money('sidebar', zh)[0]))),
        (('多久能上线？' if zh else 'How fast does it go live?'),
         ('付费档在站长确认收款后当天生成页面并上线（人工确认收款）。免费进入人工审核队列，' + sla(FREE_SLA, True) + '。'
          if zh else
          'Paid listings are generated and published the same day the site owner confirms the payment. Free listings join a manual review queue, ' + sla(FREE_SLA, False) + '.')),
        (('可以退款吗？' if zh else 'Can I get a refund?'),
         ('上线前可以全额退。上线后不支持退款——反链已经生效，撤不回来。所以如果不确定，先免费提交。'
          if zh else
          'Full refund before your listing goes live. After it is live we cannot refund, because the backlink is already out there. If you are unsure, submit free first.')),
        (('为什么不做月订阅？' if zh else 'Why no monthly plan?'),
         ('因为交付是一次性的。一个永久页面收一次钱就够，按月收费等于为同一件东西反复收钱。'
          if zh else
          'Because the delivery is one-off. A permanent page is paid for once; charging monthly would mean charging repeatedly for the same thing.')),
    ]
    faq_html = ''.join(
        f'<details class="faq-item"><summary>{esc(q)}</summary><div class="faq-item__body"><p>{esc(a)}</p></div></details>'
        for q, a in faq)

    h1 = '定价' if zh else 'Pricing'
    sub = ('免费就能上线。付费只买两件事：更早被看到，链接变 dofollow。不订阅、不自动续费。'
           if zh else
           'Launch free. Paying buys two things: being seen sooner, and a dofollow link. No subscription, no auto-renewal.')

    content = f'''<div class="container">
  {breadcrumb([(t('discover'), u('index.html')), (h1, None)])}
  <header class="page-head page-head--center">
    <h1 class="page-title">{h1}</h1>
    <p class="page-sub">{sub}</p>
  </header>
    <div class="price-grid">{cards}</div>
  <p class="price-note">{esc(sla(MAIL_NOTE))}</p>
  <section class="ad-section" id="ads">
    <div class="ad-section__head">
      <h2>{ad_h}</h2>
      <p>{ad_sub}</p>
    </div>
    <div class="ad-grid">{ad_cards}</div>
    <p class="ad-note">{'下单后我们人工确认排期与付款 —— 自动支付还没接。位置只有两个，同一周不会重复出售。' if zh else 'We confirm the slot and the payment by hand — checkout is not wired up yet. There are two positions, and neither is sold twice in the same week.'}</p>
  </section>
  <section class="price-compare">
    {section_head(('三档对比' if zh else 'Compare the three'), '')}
    <div class="table-wrap"><table class="price-table">
      <thead><tr><th scope="col">{'权益' if zh else 'What you get'}</th><th scope="col">{esc(tiers[0]['name'])}</th>
      <th scope="col">{esc(tiers[1]['name'])}</th>
      <th scope="col" class="is-hl">{esc(tiers[2]['name'])}</th><th scope="col">{esc(tiers[3]['name'])}</th></tr></thead>
      <tbody>{trs}</tbody>
    </table></div>
  </section>
  <section class="tool-section">
    {section_head(('常见问题' if zh else 'Questions'), '')}
    <div class="faq-list">{faq_html}</div>
  </section>
  <section class="price-cta">
    <h2>{'不确定选哪个？' if zh else 'Not sure which one?'}</h2>
    <p>{'先免费提交，上线后再决定要不要升级。' if zh else 'Submit free, then decide about upgrading once you are live.'}</p>
    <a class="btn btn--primary" href="{u('submit.html')}">{'提交产品' if zh else 'Submit a product'}{icon('arrow-right')}</a>
  </section>
</div>'''

    title = ('定价：一次付费，不订阅 | Product Atlas' if zh
             else 'Pricing — pay once, never a subscription | Product Atlas')
    desc = ('免费收录；$19 起升级永久 dofollow 反链，$39 加目录与分类页置顶，$69 分类页置顶 90 天。'
            '周广告位榜单位 $29、右栏位 $19，连投 4 周有折扣。不订阅、不自动续费。'
            if zh else
            'List free. $19 turns the link dofollow, $39 adds a 7-day pin on the directory and category pages, '
            '$69 holds a category page for 90 days. Weekly ad slots are $29 (board) and $19 (sidebar), cheaper '
            'in four-week blocks. No subscription.')
    ld = ld_graph(
        ld_breadcrumb_obj([(t('discover'), 'index.html'), (h1, 'pricing.html')]),
        ld_webpage_obj(h1, desc, 'pricing.html'),
        {
            '@type': 'FAQPage',
            'mainEntity': [
                {'@type': 'Question', 'name': q,
                 'acceptedAnswer': {'@type': 'Answer', 'text': a}}
                for q, a in faq
            ],
        },
    )
    return page(title, desc, content, 'pricing', 'pricing.html', ld)


# --------------------------------------------------------------------------
# SEO artefacts  (PRD §3.8)
# --------------------------------------------------------------------------
def build_sitemap():
    urls = []
    for lang in LANGS:
        prefix = '/zh/' if lang == 'zh' else '/'
        paths = ['index.html', 'tools.html', 'categories.html', 'makers.html', 'tags.html',
                 'pricing.html', 'seo-check.html', 'weekly.html', 'just-added.html',
                 'submit.html', 'privacy-policy.html', 'terms-of-service.html']
        paths += [f'tools/{x["slug"]}.html' for x in VISIBLE]
        paths += [f'categories/{c["slug"]}.html' for c in CATS]
        paths += [f'makers/{m["slug"]}.html' for m in MAKERS]
        paths += [f'tags/{g["slug"]}.html' for g in TAGS]
        for p in paths:
            loc = SITE + prefix + p
            alts = ''.join(
                f'\n    <xhtml:link rel="alternate" hreflang="{code}" href="{SITE}{"/zh/" if l == "zh" else "/"}{p}"/>'
                for l, code in (('en', 'en'), ('zh', 'zh-Hans')))
            alts += f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}/{p}"/>'
            if p == 'index.html':
                pri = '1.0'
            elif p.startswith('tools/'):
                pri = '0.8'
            elif p in ('privacy-policy.html', 'terms-of-service.html'):
                pri = '0.3'
            else:
                pri = '0.6'
            urls.append(f'  <url>\n    <loc>{loc}</loc>{alts}\n'
                        f'    <lastmod>2026-10-29</lastmod><changefreq>daily</changefreq>'
                        f'<priority>{pri}</priority>\n  </url>')
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
            '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
            + '\n'.join(urls) + '\n</urlset>\n')


def build_robots():
    return (f'User-agent: *\nAllow: /\nDisallow: /api/\n\n'
            f'Sitemap: {SITE}/sitemap.xml\n'
            f'Sitemap: {SITE}/sitemap-reports.xml\n')


def build_llms():
    lines = [f'# {SITE_NAME}', '',
             '> A hand-reviewed directory of products worth trying — AI tools, SaaS, indie apps and '
             'utilities — with bilingual (English / Chinese) listings, weekly community voting and paid placements.', '',
             '## Core pages',
             f'- [All products]({SITE}/tools.html): every listed product with category filters and sorting',
             f'- [Categories]({SITE}/categories.html): 8 categories',
             f'- [Makers]({SITE}/makers.html): one page per vendor, grouped by what they shipped',
             f'- [Tags]({SITE}/tags.html): 15 tags',
             f'- [SEO check]({SITE}/seo-check.html): free 20-point technical audit of any URL, plus an honest DR lookup',
             f'- [Weekly leaderboard]({SITE}/weekly.html): ranked by votes, resets every Monday',
             f'- [Just added]({SITE}/just-added.html): newest listings',
             f'- [Submit a product]({SITE}/submit.html): paste a URL, auto-fill, free or paid',
             f'- [中文版]({SITE}/zh/index.html)', '',
             '## Tools']
    for x in TOOL_LIST:
        lines.append(f'- [{x["name_en"]}]({SITE}/tools/{x["slug"]}.html): {x["short_en"]}')
    lines += ['', '## Categories']
    for c in CATS:
        lines.append(f'- [{c["name_en"]}]({SITE}/categories/{c["slug"]}.html): {c["desc_en"]}')
    return '\n'.join(lines) + '\n'


# --------------------------------------------------------------------------
# write
# --------------------------------------------------------------------------
def write(path, text):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full) or ROOT, exist_ok=True)
    open(full, 'w', encoding='utf-8').write(text)
    return path


def build_all(lang):
    global LANG
    LANG = lang
    pre = 'zh/' if lang == 'zh' else ''
    out = []
    out.append(write(pre + 'index.html', build_home()))
    out.append(write(pre + 'tools.html', build_tools()))
    for x in VISIBLE:
        out.append(write(pre + f'tools/{x["slug"]}.html', build_tool(x['slug'])))
    out.append(write(pre + 'categories.html', build_categories()))
    out.append(write(pre + 'makers.html', build_makers()))
    for m in MAKERS:
        out.append(write(pre + f'makers/{m["slug"]}.html', build_maker(m['slug'])))
    out.append(write(pre + 'pricing.html', build_pricing()))
    for c in CATS:
        out.append(write(pre + f'categories/{c["slug"]}.html', build_category(c['slug'])))
    out.append(write(pre + 'tags.html', build_tags()))
    for g in TAGS:
        out.append(write(pre + f'tags/{g["slug"]}.html', build_tag(g['slug'])))
    out.append(write(pre + 'seo-check.html', build_seo_check()))
    out.append(write(pre + 'weekly.html', build_weekly()))
    out.append(write(pre + 'just-added.html', build_just_added()))
    out.append(write(pre + 'submit.html', build_submit()))
    out.append(write(pre + 'dashboard.html', build_dashboard()))
    out.append(write(pre + 'settings/index.html', build_settings_overview()))
    out.append(write(pre + 'settings/submissions.html', build_settings_submissions()))
    out.append(write(pre + 'settings/profile.html', build_settings_profile()))
    out.append(write(pre + 'settings/tickets.html', build_settings_tickets()))
    out.append(write(pre + 'admin.html', build_admin()))
    out.append(write(pre + 'privacy-policy.html', build_legal('privacy')))
    out.append(write(pre + 'terms-of-service.html', build_legal('terms')))
    out.append(write(pre + 'sign-in.html', build_signin()))
    out.append(write(pre + '404.html', build_404()))
    return out


def main():
    out = []
    for lang in LANGS:
        out += build_all(lang)
    out.append(write('sitemap.xml', build_sitemap()))
    out.append(write('robots.txt', build_robots()))
    out.append(write('llms.txt', build_llms()))
    # Remember which origin the canonicals were built with: the runtime server
    # renders /seo-check/<domain> pages and must agree with them.
    out.append(write('data/site-origin.txt', SITE + '\n'))
    print(f'wrote {len(out)} files')


if __name__ == '__main__':
    main()
