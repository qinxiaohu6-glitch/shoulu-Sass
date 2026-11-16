-- Batch 2 taxonomy. Updates category blurbs and adds tags.
-- Does not move products, does not delete tags, and does not add a category.
-- Safe to re-run. A description an operator already rewrote is left alone.

UPDATE dir_category_tr
SET description = 'Assistants and other products currently listed in this category.'
WHERE slug = 'chatbots' AND locale = 'en'
  AND description IN ('', 'General-purpose assistants you can talk to.');

UPDATE dir_category_tr
SET description = '当前列在这一分类里的助手和其他产品。'
WHERE slug = 'chatbots' AND locale = 'zh'
  AND description IN ('', '通用对话助手，什么问题都能接。');

UPDATE dir_category_tr
SET description = 'Images, design utilities, and visual production tools.'
WHERE slug = 'image' AND locale = 'en'
  AND description IN ('', 'Image generation, UI and creative production.');

UPDATE dir_category_tr
SET description = '图像、设计工具和视觉生产工具。'
WHERE slug = 'image' AND locale = 'zh'
  AND description IN ('', '图像生成、界面与创意生产工具。');

UPDATE dir_category_tr
SET description = 'Video generation, editing, transcripts, and live video chat.'
WHERE slug = 'video' AND locale = 'en'
  AND description IN ('', 'Generate, edit and translate video.');

UPDATE dir_category_tr
SET description = '视频生成、剪辑、转录和实时视频聊天。'
WHERE slug = 'video' AND locale = 'zh'
  AND description IN ('', '视频生成、剪辑与翻译。');

UPDATE dir_category_tr
SET description = 'Audio tools, music utilities, and generated or edited sound.'
WHERE slug = 'audio' AND locale = 'en'
  AND description IN ('', 'Text-to-speech, voice cloning and AI music.');

UPDATE dir_category_tr
SET description = '音频工具、音乐工具，以及生成或编辑过的声音。'
WHERE slug = 'audio' AND locale = 'zh'
  AND description IN ('', '语音合成、声音克隆与音乐生成。');

UPDATE dir_category_tr
SET description = 'Everyday work tools, from documents and timers to utilities.'
WHERE slug = 'productivity' AND locale = 'en'
  AND description IN ('', 'Slides, notes and meetings, done faster.');

UPDATE dir_category_tr
SET description = '日常工作工具，从文档和计时器到实用小工具。'
WHERE slug = 'productivity' AND locale = 'zh'
  AND description IN ('', '幻灯片、笔记与会议，做得更快。');

UPDATE dir_category_tr
SET description = 'Data, lookup tools, and research products.'
WHERE slug = 'research' AND locale = 'en'
  AND description IN ('', 'Answer engines and research assistants.');

UPDATE dir_category_tr
SET description = '数据、查询工具和研究产品。'
WHERE slug = 'research' AND locale = 'zh'
  AND description IN ('', '答案引擎与研究助手。');

UPDATE dir_tag_tr
SET name = 'Video generation'
WHERE slug = 'video-generation' AND locale = 'en' AND name = 'Video Generation';

INSERT INTO dir_tag (slug, sort, updated_at) VALUES ('video-chat', 15, 1763251200) ON CONFLICT(slug) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('video-chat', 'en', 'Video chat') ON CONFLICT(slug, locale) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('video-chat', 'zh', '视频聊天') ON CONFLICT(slug, locale) DO NOTHING;

INSERT INTO dir_tag (slug, sort, updated_at) VALUES ('transcripts', 16, 1763251200) ON CONFLICT(slug) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('transcripts', 'en', 'Transcripts') ON CONFLICT(slug, locale) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('transcripts', 'zh', '转录') ON CONFLICT(slug, locale) DO NOTHING;

INSERT INTO dir_tag (slug, sort, updated_at) VALUES ('utilities', 17, 1763251200) ON CONFLICT(slug) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('utilities', 'en', 'Utilities') ON CONFLICT(slug, locale) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('utilities', 'zh', '实用工具') ON CONFLICT(slug, locale) DO NOTHING;

INSERT INTO dir_tag (slug, sort, updated_at) VALUES ('games', 18, 1763251200) ON CONFLICT(slug) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('games', 'en', 'Games') ON CONFLICT(slug, locale) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('games', 'zh', '游戏') ON CONFLICT(slug, locale) DO NOTHING;

INSERT INTO dir_tag (slug, sort, updated_at) VALUES ('data-lookup', 19, 1763251200) ON CONFLICT(slug) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('data-lookup', 'en', 'Data lookup') ON CONFLICT(slug, locale) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('data-lookup', 'zh', '数据查询') ON CONFLICT(slug, locale) DO NOTHING;

INSERT INTO dir_tag (slug, sort, updated_at) VALUES ('ecommerce', 20, 1763251200) ON CONFLICT(slug) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('ecommerce', 'en', 'Ecommerce') ON CONFLICT(slug, locale) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('ecommerce', 'zh', '电商') ON CONFLICT(slug, locale) DO NOTHING;

INSERT INTO dir_tag (slug, sort, updated_at) VALUES ('face-swap', 21, 1763251200) ON CONFLICT(slug) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('face-swap', 'en', 'Face swap') ON CONFLICT(slug, locale) DO NOTHING;
INSERT INTO dir_tag_tr (slug, locale, name) VALUES ('face-swap', 'zh', '换脸') ON CONFLICT(slug, locale) DO NOTHING;
