<script setup lang="ts">
/**
 * Source `shipany-dir/src/components/rich-text-editor.tsx` — Tiptap editor for
 * database posts.
 *
 * Storage format stays markdown: value in → markdown-it → HTML for editing;
 * edits out → turndown → markdown. The public rendering chain
 * (`MarkdownContent.vue`) is untouched.
 *
 * Two things differ from the source, both forced by the port:
 *
 *  · `describeUploadError` takes the translator as an argument here (see
 *    `utils/image-upload.ts`), and the upload itself goes through
 *    `uploadImageFile` rather than a bare `fetch` — same endpoint, same
 *    `{ code, message, data }` envelope.
 *  · `uploading` is a `ref` rather than a `useRef` holder. The source stored it
 *    in a ref object and read `uploadingRef.current` during render, which React
 *    never re-runs — the spinner was dead code. In Vue the same construct would
 *    be equally inert, so the state is reactive and the spinner the source
 *    intended actually shows.
 */
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TiptapImage from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extension-placeholder'
import MarkdownIt from 'markdown-it'
import TurndownService from 'turndown'
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo,
  SquareCode,
  Strikethrough,
  Undo,
  Unlink,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { cn } from '~/utils/ui'
import { MARKDOWN_STYLES } from '~/utils/markdown-styles'
import { uploadImageFile } from '~/utils/image-upload'

const props = withDefaults(
  defineProps<{
    /** markdown in */
    value: string
    /** markdown out */
    placeholder?: string
    class?: string
  }>(),
  { placeholder: '', class: '' },
)
const emit = defineEmits<{ change: [markdown: string] }>()

const { t } = useSettingsI18n()

const md = new MarkdownIt({ html: false, linkify: true })

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
})
turndown.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement: (content) => `~~${content}~~`,
})
// keep empty paragraphs from collapsing list/paragraph spacing
turndown.keep(['figure'])

const mdToHtml = (markdown: string) => (markdown ? md.render(markdown) : '')
const htmlToMd = (html: string) => turndown.turndown(html)

/**
 * Tracks the markdown this editor last emitted, so external value updates
 * (e.g. dialog reopened with another post) reset content without clobbering
 * in-progress edits on every keystroke round-trip.
 */
let lastEmitted = props.value

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      link: { openOnClick: false },
      heading: { levels: [1, 2, 3] },
    }),
    TiptapImage,
    Placeholder.configure({ placeholder: props.placeholder }),
  ],
  content: mdToHtml(props.value),
  // No `immediatelyRender` here: the Vue adapter constructs the editor inside
  // `onMounted`, so it never runs during SSR in the first place.
  editorProps: {
    attributes: {
      class: cn(MARKDOWN_STYLES, 'min-h-[280px] max-w-none p-4 focus:outline-none'),
    },
  },
  onUpdate: ({ editor: e }) => {
    const markdown = e.isEmpty ? '' : htmlToMd(e.getHTML())
    lastEmitted = markdown
    emit('change', markdown)
  },
})

watch(
  () => props.value,
  (value) => {
    const e = editor.value
    if (!e || value === lastEmitted) return
    lastEmitted = value
    e.commands.setContent(mdToHtml(value))
  },
)

function chain() {
  return editor.value!.chain().focus()
}

function setLink() {
  const e = editor.value
  if (!e) return
  const previous = e.getAttributes('link').href as string | undefined
  const url = window.prompt('URL', previous || 'https://')
  if (url === null) return
  if (url === '') {
    chain().extendMarkRange('link').unsetLink().run()
    return
  }
  chain().extendMarkRange('link').setLink({ href: url }).run()
}

async function handleFiles(files: FileList | null) {
  const e = editor.value
  if (!e || !files?.length || uploading.value) return
  uploading.value = true
  try {
    const url = await uploadImageFile(files[0]!, t)
    e.chain().focus().setImage({ src: url }).run()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div
    v-if="!editor"
    :class="cn('border-input min-h-[330px] rounded-md border bg-transparent', props.class)"
  />

  <div
    v-else
    :class="
      cn(
        'border-input focus-within:border-ring focus-within:ring-ring/50 overflow-hidden rounded-md border bg-transparent focus-within:ring-[3px]',
        props.class,
      )
    "
  >
    <div class="border-border bg-muted/30 flex flex-wrap items-center gap-0.5 border-b p-1">
      <UiButton
        type="button"
        :variant="editor.isActive('bold') ? 'secondary' : 'ghost'"
        size="icon"
        class="size-8"
        aria-label="Bold"
        title="Bold"
        @click="chain().toggleBold().run()"
      >
        <Bold class="size-4" />
      </UiButton>
      <UiButton
        type="button"
        :variant="editor.isActive('italic') ? 'secondary' : 'ghost'"
        size="icon"
        class="size-8"
        aria-label="Italic"
        title="Italic"
        @click="chain().toggleItalic().run()"
      >
        <Italic class="size-4" />
      </UiButton>
      <UiButton
        type="button"
        :variant="editor.isActive('strike') ? 'secondary' : 'ghost'"
        size="icon"
        class="size-8"
        aria-label="Strikethrough"
        title="Strikethrough"
        @click="chain().toggleStrike().run()"
      >
        <Strikethrough class="size-4" />
      </UiButton>
      <UiButton
        type="button"
        :variant="editor.isActive('code') ? 'secondary' : 'ghost'"
        size="icon"
        class="size-8"
        aria-label="Inline code"
        title="Inline code"
        @click="chain().toggleCode().run()"
      >
        <Code class="size-4" />
      </UiButton>

      <span class="bg-border mx-1 h-5 w-px" />

      <UiButton
        type="button"
        :variant="editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'"
        size="icon"
        class="size-8"
        aria-label="Heading 2"
        title="Heading 2"
        @click="chain().toggleHeading({ level: 2 }).run()"
      >
        <Heading2 class="size-4" />
      </UiButton>
      <UiButton
        type="button"
        :variant="editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'"
        size="icon"
        class="size-8"
        aria-label="Heading 3"
        title="Heading 3"
        @click="chain().toggleHeading({ level: 3 }).run()"
      >
        <Heading3 class="size-4" />
      </UiButton>

      <span class="bg-border mx-1 h-5 w-px" />

      <UiButton
        type="button"
        :variant="editor.isActive('bulletList') ? 'secondary' : 'ghost'"
        size="icon"
        class="size-8"
        aria-label="Bullet list"
        title="Bullet list"
        @click="chain().toggleBulletList().run()"
      >
        <List class="size-4" />
      </UiButton>
      <UiButton
        type="button"
        :variant="editor.isActive('orderedList') ? 'secondary' : 'ghost'"
        size="icon"
        class="size-8"
        aria-label="Ordered list"
        title="Ordered list"
        @click="chain().toggleOrderedList().run()"
      >
        <ListOrdered class="size-4" />
      </UiButton>
      <UiButton
        type="button"
        :variant="editor.isActive('blockquote') ? 'secondary' : 'ghost'"
        size="icon"
        class="size-8"
        aria-label="Blockquote"
        title="Blockquote"
        @click="chain().toggleBlockquote().run()"
      >
        <Quote class="size-4" />
      </UiButton>
      <UiButton
        type="button"
        :variant="editor.isActive('codeBlock') ? 'secondary' : 'ghost'"
        size="icon"
        class="size-8"
        aria-label="Code block"
        title="Code block"
        @click="chain().toggleCodeBlock().run()"
      >
        <SquareCode class="size-4" />
      </UiButton>

      <span class="bg-border mx-1 h-5 w-px" />

      <UiButton
        type="button"
        :variant="editor.isActive('link') ? 'secondary' : 'ghost'"
        size="icon"
        class="size-8"
        aria-label="Link"
        title="Link"
        @click="setLink"
      >
        <LinkIcon class="size-4" />
      </UiButton>
      <UiButton
        type="button"
        variant="ghost"
        size="icon"
        class="size-8"
        aria-label="Remove link"
        title="Remove link"
        :disabled="!editor.isActive('link')"
        @click="chain().unsetLink().run()"
      >
        <Unlink class="size-4" />
      </UiButton>
      <UiButton
        type="button"
        variant="ghost"
        size="icon"
        class="size-8"
        aria-label="Insert image"
        title="Insert image"
        :disabled="uploading"
        @click="fileInput?.click()"
      >
        <Loader2 v-if="uploading" class="size-4 animate-spin" />
        <ImageIcon v-else class="size-4" />
      </UiButton>
      <UiButton
        type="button"
        variant="ghost"
        size="icon"
        class="size-8"
        aria-label="Horizontal rule"
        title="Horizontal rule"
        @click="chain().setHorizontalRule().run()"
      >
        <Minus class="size-4" />
      </UiButton>

      <span class="bg-border mx-1 h-5 w-px" />

      <UiButton
        type="button"
        variant="ghost"
        size="icon"
        class="size-8"
        aria-label="Undo"
        title="Undo"
        :disabled="!editor.can().undo()"
        @click="chain().undo().run()"
      >
        <Undo class="size-4" />
      </UiButton>
      <UiButton
        type="button"
        variant="ghost"
        size="icon"
        class="size-8"
        aria-label="Redo"
        title="Redo"
        :disabled="!editor.can().redo()"
        @click="chain().redo().run()"
      >
        <Redo class="size-4" />
      </UiButton>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFiles(($event.target as HTMLInputElement).files)"
    />

    <div class="max-h-[50vh] overflow-y-auto">
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>
