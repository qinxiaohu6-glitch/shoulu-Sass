#!/usr/bin/env python3
"""Normalize scraped data into data/site.json used by build.py."""
import json, re, os, html

ROOT = os.path.dirname(os.path.abspath(__file__))
D = json.load(open('/tmp/tools_full.json'))
L = {t['slug']: t for t in json.load(open('/tmp/tools_list.json'))}

CATS = [
    ("chatbots", "AI Chatbots", "General-purpose assistants you can talk to.", "message-square"),
    ("coding", "Coding", "AI pair programmers, app builders and coding agents.", "code"),
    ("image", "Image Generation", "Create and edit images from text prompts.", "image"),
    ("video", "Video", "Generate, edit and translate video with AI.", "video"),
    ("audio", "Voice & Music", "Text-to-speech, voice cloning and AI music.", "music"),
    ("writing", "Writing", "Draft, rewrite and polish text.", "pen-line"),
    ("productivity", "Productivity", "Slides, notes and meetings, done faster.", "layout-dashboard"),
    ("research", "Search & Research", "Answer engines and research assistants.", "search"),
]
CAT_BY_NAME = {c[1]: c for c in CATS}


def strip_tags(s):
    return re.sub(r'<[^>]+>', '', s or '').strip()


tools = []
for t in D:
    l = L.get(t['slug'], {})
    meta = {m['label']: m for m in t['meta']}
    cat_name = meta.get('Category', {}).get('value', '')
    cat = CAT_BY_NAME.get(cat_name, ("chatbots", "AI Chatbots", "", "message-square"))
    spans = l.get('spans', [])
    sections = {s['id']: s for s in t['sections']}

    def sec(sid):
        return sections.get(sid, {})

    overview = [p for p in sec('what-is').get('paras', []) if p.strip()]
    steps = sec('how-to-use').get('steps', [])
    features = [i for i in sec('features').get('items', []) if i.get('title')]
    usecases = [i for i in sec('use-cases').get('items', []) if i.get('title')]

    shots = [s.split('/')[-1] for s in t.get('shots', [])]

    tools.append({
        "slug": t['slug'],
        "name": t['h1'] or l.get('name', ''),
        "tagline": t.get('tagline') or l.get('desc', ''),
        "desc": l.get('desc', ''),
        "icon": f"assets/img/icons/{t['slug']}.png",
        "category": {"slug": cat[0], "name": cat[1]},
        "tags": [x['t'] for x in t.get('tags', [])],
        "maker": meta.get('Maker', {}).get('value', ''),
        "listed": meta.get('Listed on', {}).get('value', ''),
        "website": t.get('website', ''),
        "featured": bool(l.get('featured')),
        "paid": 'Paid' in spans,
        "shots": shots,
        "overview": overview,
        "steps": steps,
        "features": features,
        "usecases": usecases,
        "pros": t.get('pros', []),
        "cons": t.get('cons', []),
        "faq": t.get('faq', []),
    })

# categories with counts
for c in CATS:
    c_count = len([t for t in tools if t['category']['slug'] == c[0]])
    pass
cats = []
for slug, name, desc, icon in CATS:
    items = [t['slug'] for t in tools if t['category']['slug'] == slug]
    cats.append({"slug": slug, "name": name, "desc": desc, "icon": icon,
                 "count": len(items), "tools": items})

# tags
tag_map = {}
for t in tools:
    for tg in t['tags']:
        tag_map.setdefault(tg, []).append(t['slug'])
tags = [{"name": k, "slug": re.sub(r'[^a-z0-9]+', '-', k.lower()).strip('-'), "count": len(v), "tools": v}
        for k, v in tag_map.items()]
tags.sort(key=lambda x: (-x['count'], x['name']))

# blog
blog_raw = json.load(open('/tmp/blog.json'))
blog = []
for p in blog_raw:
    h = p['html']
    # isolate article body
    m = re.search(r'<article[^>]*>(.*)</article>', h, re.S)
    body = m.group(1) if m else h
    # strip shiki style attributes and inline span colors
    body = re.sub(r'\s*style="[^"]*shiki[^"]*"', '', body)
    body = re.sub(r'<span[^>]*>', '', body)
    body = body.replace('</span>', '')
    body = re.sub(r'class="[^"]*"', '', body)
    body = re.sub(r'\sdata-[a-z-]+="[^"]*"', '', body)
    # drop the duplicated article header / back link / lede
    i = body.find('</header>')
    if i != -1:
        body = body[i + len('</header>'):]
    body = re.sub(r'^\s*<p\b[^>]*>.*?</p>', '', body, count=1, flags=re.S)
    body = body.strip()
    if body.startswith('<div'):
        body = body[body.find('>') + 1:]
        body = body.rstrip()
        if body.endswith('</div>'):
            body = body[:-6]
    body = body.strip()
    blog.append({"slug": p['slug'], "title": p['h1'], "body": body})

data = {
    "tools": tools,
    "categories": cats,
    "tags": tags,
    "blog": blog,
}
json.dump(data, open(os.path.join(ROOT, 'data', 'site.json'), 'w'), ensure_ascii=False, indent=1)
print('tools', len(tools), 'cats', len(cats), 'tags', len(tags))
print('featured', [t['slug'] for t in tools if t['featured']])
print('no-overview', [t['slug'] for t in tools if not t['overview']])
print('paid', [t['slug'] for t in tools if t['paid']])
