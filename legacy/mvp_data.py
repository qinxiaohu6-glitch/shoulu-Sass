#!/usr/bin/env python3
"""Build data/mvp.json from the scraped site.json, shaped for PRD MVP v1.0 §5."""
import json
import os
import hashlib
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = json.load(open(os.path.join(ROOT, 'data', 'site.json'), encoding='utf-8'))
TODAY = date(2026, 10, 29)

ZH_NAME = {
    'chatgpt': 'ChatGPT', 'claude': 'Claude', 'cursor': 'Cursor', 'midjourney': 'Midjourney',
    'runway': 'Runway', 'elevenlabs': 'ElevenLabs', 'gamma': 'Gamma', 'perplexity': 'Perplexity',
    'gemini': 'Gemini', 'deepseek': 'DeepSeek', 'ollama': 'Ollama', 'claude-code': 'Claude Code',
    'github-copilot': 'GitHub Copilot', 'v0': 'v0', 'bolt': 'Bolt', 'replit': 'Replit',
    'ideogram': 'Ideogram', 'leonardo-ai': 'Leonardo.Ai', 'krea': 'Krea', 'pika': 'Pika',
    'heygen': 'HeyGen', 'synthesia': 'Synthesia', 'suno': 'Suno', 'udio': 'Udio',
    'grammarly': 'Grammarly', 'jasper': 'Jasper', 'notion-ai': 'Notion AI', 'otter': 'Otter.ai',
    'elicit': 'Elicit', 'consensus': 'Consensus',
}

ZH_SHORT = {
    'chatgpt': 'OpenAI 的对话助手，可用于写作、分析、编程和日常问答。',
    'claude': '注重思考的 AI 助手，擅长写作、研究、编程与长文档处理。',
    'cursor': 'AI 代码编辑器：跨代码库的自动补全、对话与智能体。',
    'midjourney': '用文字提示生成富有艺术感的图像。',
    'runway': '用前沿模型生成与编辑视频。',
    'elevenlabs': '拟真语音合成、声音克隆与配音。',
    'gamma': '一句话生成精美的演示文稿、文档与网页。',
    'perplexity': '会联网检索并标注来源的答案引擎。',
    'gemini': 'Google 的多模态助手，已接入搜索、Gmail 与文档。',
    'deepseek': '开放权重的推理模型，提供免费聊天应用与低成本 API。',
    'ollama': '一条命令在本地运行开源大模型。',
    'claude-code': '在终端、IDE 和浏览器中工作的智能编程工具。',
    'github-copilot': '内置在 VS Code、JetBrains 与 GitHub 中的 AI 结对程序员。',
    'v0': '描述界面或应用，直接得到可部署的 React 代码。',
    'bolt': '在浏览器里用提示词生成、运行、修改并部署全栈应用。',
    'replit': '用 AI 智能体从提示词构建并上线应用，托管内置。',
    'ideogram': '擅长文字与排版的图像生成工具。',
    'leonardo-ai': '生成可直接用于生产的插画与素材，控制精细。',
    'krea': '实时图像生成、放大与增强。',
    'pika': '把想法和图片变成简短有趣的视频。',
    'heygen': '会说话的数字人，支持任意语言的视频翻译。',
    'synthesia': '用脚本生成演播室级的主持人视频。',
    'suno': '用文字提示生成带人声的完整歌曲。',
    'udio': '创作与改编任意风格的音乐。',
    'grammarly': '在任何输入场景提供写作辅助。',
    'jasper': '面向团队的品牌一致性营销文案。',
    'notion-ai': '在 Notion 工作区内搜索、写作与总结。',
    'otter': '自动生成会议记录、转写与摘要。',
    'elicit': '检索、总结并从论文中提取数据。',
    'consensus': '基于科学文献的证据型答案。',
}

ZH_LONG = {
    'chatgpt': ['ChatGPT 是 OpenAI 的对话式 AI 助手，用自然语言提问就能得到回答、改写、代码或分析结果，支持文字、语音与图片输入。',
                '免费版即可覆盖日常问答与写作；付费版开放更强的模型、更长的上下文与更多工具调用，适合把 AI 直接接进日常工作流。'],
    'claude': ['Claude 是 Anthropic 的 AI 助手，以长文档理解、稳健推理和自然的中文表达见长，适合研究、合同审阅与代码阅读。',
               '支持上传文档、图片与代码库，也能通过 API 接入自有产品；回答会尽量避免臆断，遇到不确定的信息通常会更谨慎。'],
    'cursor': ['Cursor 是基于 VS Code 的 AI 代码编辑器，把补全、对话与智能体放进同一个界面，可以跨整个代码库检索与修改。',
               '适合需要频繁重构、读陌生项目或批量改代码的开发者，也能直接用自然语言描述需求让它落地成可运行代码。'],
    'midjourney': ['Midjourney 以风格化、审美在线的出图效果著称，输入一句描述即可生成高质量的插画、概念图与摄影风格画面。',
                   '提供风格参考、局部重绘与放大等控制手段，适合做视觉探索、情绪板与营销素材的初稿。'],
    'runway': ['Runway 提供文生视频、图生视频与视频编辑的一整套工具，模型更新快，适合广告、短片与社媒内容的快速试错。',
               '除了生成，还能做抠像、运动追踪、镜头延展等后期处理，把 AI 素材直接接进剪辑流程。'],
    'elevenlabs': ['ElevenLabs 提供拟真的语音合成与声音克隆，支持多语言配音与情感控制，常用于有声书、播客与产品旁白。',
                   '提供 API，可把语音能力接进应用；克隆声音需要授权样本，平台对滥用有明确的使用条款约束。'],
    'gamma': ['Gamma 用一句话或一份大纲生成演示文稿、文档与网页，排版自动完成，省掉大量对齐与配图时间。',
              '适合做内部汇报、销售材料与课程讲义，生成后仍可逐页调整版式与内容，也支持导出为 PPT 与 PDF。'],
    'perplexity': ['Perplexity 是答案引擎：先联网检索，再用带引用的段落直接回答问题，省去逐个打开搜索结果的时间。',
                   '适合做资料速查、事实核对与选题调研，支持追问、聚焦特定来源，也能整理成可分享的页面。'],
    'gemini': ['Gemini 是 Google 的多模态模型，已经接入搜索、Gmail、文档与表格，能在原有工作流里直接调用。',
               '擅长图文混合理解、长上下文与代码，适合已经在用 Google 全家桶的团队。'],
    'deepseek': ['DeepSeek 提供开放权重的推理模型，聊天应用免费，API 价格低，适合做成本敏感的产品集成。',
                 '在数学、代码与逻辑推理任务上表现突出，权重开放也方便自行部署与微调。'],
    'ollama': ['Ollama 把开源大模型的下载、运行与接口封装成一条命令，本地即可跑起对话与嵌入模型。',
               '适合做隐私敏感的数据处理、离线环境与本地开发调试，也常被用来快速验证模型效果。'],
    'claude-code': ['Claude Code 是运行在终端里的智能编程代理，能读写项目文件、执行命令并根据结果继续推进任务。',
                    '适合处理跨文件的改造、批量修复与代码库理解，也可在 IDE 与浏览器中使用。'],
    'github-copilot': ['GitHub Copilot 是最早普及的 AI 结对编程工具，在编辑器里提供补全、对话与代码解释。',
                       '与 GitHub 深度集成，可以在 PR 里生成摘要、解释改动，团队版还能基于内部代码做定制。'],
    'v0': ['v0 用自然语言描述界面，直接生成可用的 React 与 Tailwind 代码，并支持迭代修改。',
           '适合快速做落地页、后台界面与组件原型，生成结果可以一键部署或复制进现有项目。'],
    'bolt': ['Bolt 在浏览器里完成全栈应用的生成、运行与部署，改代码、装依赖、看效果都在同一个页面。',
             '适合做 MVP 与内部工具，支持接入数据库与第三方服务，省去本地环境搭建。'],
    'replit': ['Replit 是云端 IDE，加上 AI 智能体后可以从一句需求直接生成并上线应用，托管与域名一并解决。',
               '适合教学、快速验证想法与小型团队协作，环境在浏览器里即开即用。'],
    'ideogram': ['Ideogram 的强项是画面中的文字：海报、Logo 与带标语的图都能把字写对，排版也相对规整。',
                 '提供多种风格预设与重绘能力，适合做社媒图、封面与品牌视觉草案。'],
    'leonardo-ai': ['Leonardo.Ai 面向生产场景，提供模型微调、风格参考、构图控制与批量出图。',
                    '适合游戏美术、电商素材与内容团队的稳定产出，生成结果版权归属清晰。'],
    'krea': ['Krea 主打实时生成：画布上边画边出图，适合做构图探索与风格试错。',
             '同时提供放大、增强与视频生成，能把草图快速推到可用精度。'],
    'pika': ['Pika 把文字或图片变成几秒钟的短片，操作简单，特效模板丰富。',
             '适合社媒内容、表情包与创意短片，也支持对已有视频做局部修改。'],
    'heygen': ['HeyGen 生成会说话的数字人视频，输入脚本即可得到口型同步的成片。',
               '支持多语言视频翻译与声音克隆，常用于产品介绍、培训与出海内容本地化。'],
    'synthesia': ['Synthesia 用脚本生成演播室级的主持人视频，提供大量数字人与模板。',
                  '适合企业培训、内部沟通与多语言版本批量产出，不需要拍摄与剪辑团队。'],
    'suno': ['Suno 输入一句描述就能生成带人声、编曲完整的歌曲，风格覆盖流行、摇滚、电子等。',
             '适合做短视频配乐、demo 与创意玩票，付费版可商用并支持更长的曲目。'],
    'udio': ['Udio 专注音乐生成，支持延长、重混与分段编辑，对结构的控制比同类工具更细。',
             '适合音乐人与内容创作者快速产出编曲草案与配乐。'],
    'grammarly': ['Grammarly 在浏览器、文档与邮件里实时检查语法、语气与表达清晰度。',
                  '除纠错外还能按场景改写、调整正式程度，团队版可统一品牌语气规范。'],
    'jasper': ['Jasper 面向营销团队，用品牌语气库与模板批量产出文案，保证多渠道口径一致。',
               '支持博客、广告、邮件与社媒内容，也能对接工作流做规模化生产。'],
    'notion-ai': ['Notion AI 在笔记与数据库里直接写作、总结、翻译与检索，不用切换工具。',
                  '适合把散落的会议记录、需求文档与知识库串起来，问答结果会标注来源页面。'],
    'otter': ['Otter.ai 自动加入会议并生成转写、要点与待办，支持多人发言区分。',
              '会后可直接搜索原话、导出摘要，适合访谈、周会与客户沟通的记录整理。'],
    'elicit': ['Elicit 面向学术研究：检索论文、提取结构化字段并生成文献综述草稿。',
               '适合做系统性综述与证据整理，能把几十篇论文的关键信息汇总成表格。'],
    'consensus': ['Consensus 用科学文献回答问题，给出研究结论的方向与一致程度。',
                  '适合快速判断某个说法是否有证据支持，并直接跳到原始论文核实。'],
}

CAT_ZH = {
    'chatbots': ('AI 聊天助手', '通用对话助手与问答产品。'),
    'coding': ('编程开发', '代码补全、编辑器与智能体开发工具。'),
    'image': ('图像生成', '文生图、修图与设计素材工具。'),
    'video': ('视频', '文生视频、数字人与视频剪辑。'),
    'audio': ('语音与音乐', '语音合成、配音与音乐生成。'),
    'writing': ('写作', '文案、润色与内容创作辅助。'),
    'productivity': ('效率工具', '演示、笔记与会议等日常工作流。'),
    'research': ('搜索与研究', '联网检索、学术搜索与资料整理。'),
}

TAG_ZH = {
    'API': 'API', 'Agent': '智能体', 'Chatbot': '聊天机器人', 'Video Generation': '视频生成',
    'Image Generation': '图像生成', 'Search': '搜索', 'App Builder': '应用构建',
    'Code Assistant': '代码助手', 'Writing': '写作', 'Avatar': '数字人', 'Music': '音乐',
    'Open Source': '开源', 'Meeting': '会议', 'Presentation': '演示', 'Text to Speech': '语音合成',
}


def seed(slug, salt=''):
    h = hashlib.md5((slug + salt).encode()).hexdigest()
    return int(h[:8], 16)


def main():
    cats = []
    for c in SRC['categories']:
        zh = CAT_ZH.get(c['slug'], (c['name'], c['desc']))
        cats.append({
            'slug': c['slug'], 'icon': c['icon'], 'count': c['count'],
            'name_en': c['name'], 'name_zh': zh[0],
            'desc_en': c['desc'], 'desc_zh': zh[1],
        })

    tags = []
    for t in SRC['tags']:
        tags.append({'slug': t['slug'], 'count': t['count'],
                     'name_en': t['name'], 'name_zh': TAG_ZH.get(t['name'], t['name'])})

    tools = []
    for i, t in enumerate(SRC['tools']):
        s = seed(t['slug'])
        total = 180 + s % 1400
        week = 12 + s % 180
        if t['featured']:
            total += 600
        long_en = '\n\n'.join(t['overview']) if t['overview'] else t['desc']
        long_zh = '\n\n'.join(ZH_LONG.get(t['slug'], []))
        featured = bool(t['featured'])
        tools.append({
            'slug': t['slug'],
            'name_en': t['name'], 'name_zh': ZH_NAME.get(t['slug'], t['name']),
            'short_en': t['tagline'], 'short_zh': ZH_SHORT.get(t['slug'], t['tagline']),
            'long_en': long_en, 'long_zh': long_zh,
            'url': t['website'].split('?utm_')[0],
            'logo': t['icon'],
            'category': t['category']['slug'],
            'tags': t['tags'],
            'status': 'approved',
            'is_featured': featured,
            'is_paid': bool(t.get('paid')),
            # A pin is a rented window, so every pin needs an end date. Paid-only
            # rows used to get '' and were therefore pinned forever — which is not
            # what the pricing page sells, and not something a build can honour.
            'featured_until': ((TODAY + timedelta(days=14 + i * 3)).isoformat() if featured
                               else (TODAY + timedelta(days=7)).isoformat() if t.get('paid')
                               else ''),
            'votes_total': total,
            'votes_week': week,
            'created_at': t['listed'],
            'maker': t['maker'],
            'shots': t['shots'],
        })

    # weekly leaderboards: current week + 4 historical weeks
    weeks = []
    monday = TODAY - timedelta(days=TODAY.weekday())
    for back in range(0, 5):
        start = monday - timedelta(weeks=back)
        end = start + timedelta(days=6)
        ranking = []
        for t in tools:
            s = seed(t['slug'], f'w{back}')
            if back == 0:
                v = t['votes_week']
            else:
                v = max(3, int(t['votes_week'] * (0.55 + (s % 90) / 100)))
            ranking.append({'slug': t['slug'], 'votes': v})
        ranking.sort(key=lambda r: -r['votes'])
        weeks.append({
            'id': f'{start.isocalendar()[0]}-W{start.isocalendar()[1]:02d}',
            'start': start.isoformat(), 'end': end.isoformat(),
            'label_en': f'{start.strftime("%b %-d")} – {end.strftime("%b %-d, %Y")}',
            'label_zh': f'{start.month} 月 {start.day} 日 – {end.month} 月 {end.day} 日',
            'ranking': ranking,
        })

    out = {
        'site': {'name': 'AI Atlas', 'base': 'https://shipanydir.com'},
        'generated': TODAY.isoformat(),
        'categories': cats, 'tags': tags, 'tools': tools, 'weeks': weeks,
    }
    p = os.path.join(ROOT, 'data', 'mvp.json')
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('tools', len(tools), 'cats', len(cats), 'tags', len(tags), 'weeks', len(weeks))
    print('missing zh long:', [t['slug'] for t in tools if not t['long_zh']])


if __name__ == '__main__':
    main()
