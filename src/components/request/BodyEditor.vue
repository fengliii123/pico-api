<script setup lang="ts">
// Body editor with three modes:
//   - urlencoded: x-www-form-urlencoded key/value rows
//   - formdata: multipart/form-data with text or file rows
//   - raw: free-form text with optional syntax mode (json / xml / text)
import { computed, nextTick, ref } from 'vue'
import { Input, Select, Button, Switch, message } from 'ant-design-vue'
import { DeleteOutlined, FileOutlined, PlusOutlined, FormatPainterOutlined, CompressOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons-vue'
import KeyValueTable from './KeyValueTable.vue'
import type {
  RequestBody,
  BodyMode,
  RawType,
  FormDataRow
} from '@/core/types'
import { useI18n } from '@/i18n/useI18n'
import { fmt } from '@/i18n'

const { t } = useI18n()
const props = defineProps<{
  modelValue: RequestBody
  // When true (e.g. method is GET/HEAD/OPTIONS), the entire body editor is
  // locked — radios + content area show a hint explaining why.
  disabled?: boolean
  // Method name shown in the locked hint, e.g. "GET".
  methodLabel?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: RequestBody): void
}>()

const mode = computed({
  get: () => props.modelValue.mode,
  set: (v: BodyMode) => {
    if (v === props.modelValue.mode) return
    if (v === 'urlencoded') {
      const rows = props.modelValue.urlencoded ?? []
      emit('update:modelValue', {
        ...props.modelValue,
        mode: 'urlencoded',
        urlencoded: rows.length ? rows : [{ key: '', value: '', enabled: true }]
      })
      return
    }
    if (v === 'formdata') {
      const rows = props.modelValue.formdata ?? []
      emit('update:modelValue', {
        ...props.modelValue,
        mode: 'formdata',
        formdata: rows.length ? rows : [{ key: '', kind: 'file', enabled: true, file: null }]
      })
      return
    }
    if (v === 'raw') {
      emit('update:modelValue', {
        ...props.modelValue,
        mode: 'raw',
        rawType: props.modelValue.rawType ?? 'json',
        rawText: props.modelValue.rawText ?? ''
      })
    }
  }
})

const rawType = computed({
  get: () => props.modelValue.rawType ?? 'json',
  set: (v: RawType) => emit('update:modelValue', { ...props.modelValue, rawType: v })
})

function onRawTypeChange(v: RawType) {
  rawType.value = v
}

const rawText = computed({
  get: () => props.modelValue.rawText ?? '',
  set: (v: string) => emit('update:modelValue', { ...props.modelValue, rawText: v })
})

const urlencodedRows = computed({
  get: () => props.modelValue.urlencoded ?? [],
  set: (rows) => emit('update:modelValue', { ...props.modelValue, urlencoded: rows })
})

const formdataRows = computed({
  get: () => props.modelValue.formdata ?? [],
  set: (rows: FormDataRow[]) => emit('update:modelValue', { ...props.modelValue, formdata: rows })
})


function addFormRow(kind: 'text' | 'file') {
  const next: FormDataRow =
    kind === 'text'
      ? { key: '', kind: 'text', enabled: true, value: '' }
      : { key: '', kind: 'file', enabled: true, file: null }
  formdataRows.value = [...formdataRows.value, next]
  // File rows exist solely to hold a file — pop the picker immediately
  // so the user doesn't have to click "Choose File" a second time.
  if (kind === 'file') {
    const newIdx = formdataRows.value.length - 1
    nextTick(() => pickFile(newIdx))
  }
}

function removeFormRow(idx: number) {
  const next = formdataRows.value.slice()
  next.splice(idx, 1)
  formdataRows.value = next
}

function updateFormKey(idx: number, key: string) {
  const next = formdataRows.value.slice()
  next[idx] = { ...next[idx], key }
  formdataRows.value = next
}

function updateFormTextValue(idx: number, value: string) {
  const next = formdataRows.value.slice()
  next[idx] = { ...next[idx], value }
  formdataRows.value = next
}

function toggleFormEnabled(idx: number, enabled: boolean) {
  const next = formdataRows.value.slice()
  next[idx] = { ...next[idx], enabled }
  formdataRows.value = next
}

// We can't easily make AntD's Upload component drive our data model because
// it manages its own file list — instead, hook into its beforeUpload to grab
// the raw File, suppress its default upload behavior, and stuff it into our
// row.
function onFileSelected(idx: number, file: File) {
  const next = formdataRows.value.slice()
  next[idx] = {
    ...next[idx],
    kind: 'file',
    file,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  }
  formdataRows.value = next
  return false // tell AntD Upload "I handled it"
}

function onFileRemoved(idx: number) {
  const next = formdataRows.value.slice()
  next[idx] = { ...next[idx], file: null, fileName: undefined, fileSize: undefined, fileType: undefined }
  formdataRows.value = next
}

function switchToFileRow(idx: number) {
  const next = formdataRows.value.slice()
  next[idx] = { ...next[idx], kind: 'file', file: null }
  formdataRows.value = next
}

function switchToTextRow(idx: number) {
  const next = formdataRows.value.slice()
  next[idx] = { ...next[idx], kind: 'text', value: '', file: null, fileName: undefined, fileSize: undefined, fileType: undefined }
  formdataRows.value = next
}

// Hidden <input type="file"> for each file row. We render it ourselves and
// trigger it from a plain Button click, instead of going through AntD's
// <Upload>, because the Upload's click delegation is unreliable in chrome
// extension options pages (the click event on the inner Button sometimes
// doesn't bubble to the Upload's handler).
const fileInputRefs = ref<HTMLInputElement[]>([])
function setFileInputRef(idx: number) {
  return (el: HTMLInputElement | null) => {
    if (el) fileInputRefs.value[idx] = el
  }
}
function pickFile(idx: number) {
  const el = fileInputRefs.value[idx]
  if (el) el.click()
}
function onFileInputChange(idx: number, e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) onFileSelected(idx, file)
  // Allow picking the same file again later.
  target.value = ''
}

function formatSize(n: number | undefined): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

//
// For rawType=json we surface:
//   - "Pretty": re-indent the textarea content (JSON.stringify with 2 spaces)
//   - "Minify": collapse to a single line
//   - inline validity indicator (green check / red X) with line+col of the
//     first syntax error.
//
// For rawType=xml we run a DOMParser round-trip via XMLSerializer, which
// will throw on malformed XML. For text we do nothing — text has no shape
// to validate.
const rawError = computed<{ message: string; line: number; col: number } | null>(() => {
  const t = rawText.value
  if (!t.trim()) return null
  if (rawType.value === 'json') {
    try {
      JSON.parse(t)
      return null
    } catch (e: any) {
      const m = String(e?.message ?? 'Parse error')
      const mm = /position\s+(\d+)/i.exec(m)
      let line = 1, col = 1
      if (mm) {
        const pos = Number(mm[1])
        const upto = t.slice(0, pos)
        line = upto.split('\n').length
        col = pos - upto.lastIndexOf('\n')
      }
      return { message: m, line, col }
    }
  }
  if (rawType.value === 'xml') {
    try {
      const doc = new DOMParser().parseFromString(t, 'text/xml')
      const errNode = doc.getElementsByTagName('parsererror')[0]
      if (errNode) return { message: errNode.textContent ?? 'XML parse error', line: 1, col: 1 }
      return null
    } catch (e: any) {
      return { message: String(e?.message ?? 'XML parse error'), line: 1, col: 1 }
    }
  }
  return null
})

function formatJson() {
  if (rawType.value !== 'json') return
  try {
    const parsed = JSON.parse(rawText.value || '{}')
    rawText.value = JSON.stringify(parsed, null, 2)
  } catch (e: any) {
    message.error(fmt(t.value.cannotFormatJson, { reason: e?.message ?? t.value.invalidJson }))
  }
}
function minifyJson() {
  if (rawType.value !== 'json') return
  try {
    const parsed = JSON.parse(rawText.value || '{}')
    rawText.value = JSON.stringify(parsed)
  } catch (e: any) {
    message.error(fmt(t.value.cannotMinifyJson, { reason: e?.message ?? t.value.invalidJson }))
  }
}
function prettyXmlText() {
  if (rawType.value !== 'xml') return
  try {
    const doc = new DOMParser().parseFromString(rawText.value, 'text/xml')
    const ser = new XMLSerializer()
    rawText.value = ser.serializeToString(doc)
  } catch (e: any) {
    message.error(fmt(t.value.cannotFormatXml, { reason: e?.message ?? t.value.invalidXml }))
  }
}

// JSON syntax highlighter for the raw editor overlay. Mirrors the
// ResponseBodyRenderer implementation token-for-token (key/string/number/
// keyword/punctuation) so request body and response body look identical.
// We can't reuse CodeMirror here — @codemirror/lang-javascript's dist
// bundle is corrupted on this machine (npm reinstall doesn't help —
// some macOS-level process compresses the file), so we fall back to a
// textarea + transparent overlay technique.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function highlightJsonLike(s: string): string {
  const re = /("(?:\\.|[^"\\])*"\s*:?)|(\b(?:true|false)\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],])/g
  return escapeHtml(s).replace(re, (_m, str, bool, nul, num, punct) => {
    if (str !== undefined) {
      const isKey = /:\s*$/.test(str.replace(/&quot;/g, '"'))
      return isKey
        ? `<span class="tk-key">${str}</span>`
        : `<span class="tk-str">${str}</span>`
    }
    if (bool !== undefined) return `<span class="tk-kw">${bool}</span>`
    if (nul !== undefined) return `<span class="tk-kw">${nul}</span>`
    if (num !== undefined) return `<span class="tk-num">${num}</span>`
    if (punct !== undefined) return `<span class="tk-punc">${punct}</span>`
    return _m
  })
}
const highlightedRaw = computed(() => {
  // XML / Text mode: no tokenization, just escape so the overlay shows
  // the same text safely. JSON path uses the same highlighter as the
  // response panel.
  const text = rawText.value || ''
  return rawType.value === 'json' ? highlightJsonLike(text) : escapeHtml(text)
})

// Keep the overlay scroll in sync with the textarea — they're stacked on
// top of each other so any scroll offset must match.
const rawOverlayRef = ref<HTMLPreElement | null>(null)
const rawTextareaRef = ref<HTMLTextAreaElement | null>(null)
function syncRawScroll() {
  const ta = rawTextareaRef.value
  const pre = rawOverlayRef.value
  if (!ta || !pre) return
  pre.scrollTop = ta.scrollTop
  pre.scrollLeft = ta.scrollLeft
}

</script>

<template>
  <div class="body-editor" :class="{ 'body-editor-locked': props.disabled }">
    <div v-if="props.disabled" class="body-mode-hint body-mode-blocked">
      <span class="block-icon">ⓘ</span>
      <span>
        <strong>{{ props.methodLabel }}</strong> {{ t.methodNoBodyHint }}
      </span>
    </div>

    <div class="body-mode-row">
      <Radio.Group
        :value="mode"
        :disabled="props.disabled"
        @update:value="(v) => mode = v"
      >
        <Radio.Button value="urlencoded">{{ t.bodyModeUrlencoded }}</Radio.Button>
        <Radio.Button value="formdata">{{ t.bodyModeFormdata }}</Radio.Button>
        <Radio.Button value="raw">{{ t.bodyModeRaw }}</Radio.Button>
      </Radio.Group>
    </div>

    <div v-if="mode === 'urlencoded'" class="body-mode-content">
      <KeyValueTable
        :rows="urlencodedRows"
        row-kind="urlencoded"
        @update="(rows) => urlencodedRows = rows"
      />
    </div>

    <div v-else-if="mode === 'formdata'" class="body-mode-content">
      <div class="fd-header">
        <span />
        <span>{{ t.fieldName }}</span>
        <span>{{ t.value }}</span>
        <span />
        <span />
      </div>
      <div
        v-for="(row, idx) in formdataRows"
        :key="idx"
        class="fd-row"
      >
        <Switch
          :checked="row.enabled"
          size="small"
          @update:checked="(v) => toggleFormEnabled(idx, !!v)"
        />
        <Input
          :value="row.key"
          :placeholder="t.fieldName"
          class="fd-key"
          @update:value="(v: string) => updateFormKey(idx, v)"
        />

        <template v-if="row.kind === 'text'">
          <Input
            :value="row.value ?? ''"
            :placeholder="t.textValue"
            class="fd-value"
            @update:value="(v: string) => updateFormTextValue(idx, v)"
          />
          <Button
            size="small"
            @click="() => switchToFileRow(idx)"
          >
            {{ t.fileButton }}
          </Button>
        </template>

        <template v-else>
          <div class="fd-file-cell">
            <FileOutlined v-if="row.file" />
            <span v-if="row.file" class="fd-file-name">{{ row.fileName }}</span>
            <span v-if="row.file" class="fd-file-size">{{ formatSize(row.fileSize) }}</span>
            <Button size="small" @click="() => pickFile(idx)">
              {{ row.file ? t.replaceFile : t.chooseFile }}
            </Button>
            <input
              type="file"
              :ref="setFileInputRef(idx)"
              class="fd-file-input"
              accept="*/*"
              @change="(e) => onFileInputChange(idx, e)"
            />
            <Button
              v-if="row.file"
              size="small"
              type="text"
              danger
              @click="() => onFileRemoved(idx)"
            >
              {{ t.clear }}
            </Button>
          </div>
          <Button
            size="small"
            @click="() => switchToTextRow(idx)"
          >
            {{ t.textMode }}
          </Button>
        </template>

        <Button
          type="text"
          danger
          class="fd-delete"
          @click="() => removeFormRow(idx)"
        >
          <template #icon><DeleteOutlined /></template>
        </Button>
      </div>

      <div class="fd-add-row">
        <Button block type="dashed" @click="() => addFormRow('text')">
          <template #icon><PlusOutlined /></template>
          {{ t.addTextField }}
        </Button>
        <Button block type="dashed" @click="() => addFormRow('file')">
          <template #icon><PlusOutlined /></template>
          {{ t.addFileField }}
        </Button>
      </div>

      <p class="fd-hint">
        {{ t.filesMemoryWarning }}
      </p>
    </div>

    <div v-else-if="mode === 'raw'" class="body-mode-content">
      <div class="raw-controls">
        <Select
          :value="rawType"
          style="width: 120px"
          :options="[
            { value: 'json', label: 'JSON' },
            { value: 'xml', label: 'XML' },
            { value: 'text', label: 'Text' }
          ]"
          @change="onRawTypeChange"
        />
        <template v-if="rawType === 'json'">
          <Button size="small" class="raw-action" @click="formatJson">
            <template #icon><FormatPainterOutlined /></template>
            {{ t.pretty }}
          </Button>
          <Button size="small" class="raw-action" @click="minifyJson">
            <template #icon><CompressOutlined /></template>
            {{ t.minify }}
          </Button>
        </template>
        <template v-else-if="rawType === 'xml'">
          <Button size="small" class="raw-action" @click="prettyXmlText">
            <template #icon><FormatPainterOutlined /></template>
            {{ t.pretty }}
          </Button>
        </template>
        <span
          v-if="rawError"
          class="raw-status raw-status-error"
          :title="rawError.message"
        >
          <CloseCircleFilled />
          {{ rawType === 'json' ? t.invalidJson : t.invalidXml }} · line {{ rawError.line }}:{{ rawError.col }}
        </span>
        <span v-else-if="rawText.trim()" class="raw-status raw-status-ok">
          <CheckCircleFilled />
          {{ rawType === 'json' ? t.validJson : t.validXml }}
        </span>
      </div>
      <div
        class="raw-editor-wrap"
        :class="{ 'raw-editor-error': rawError }"
      >
        <pre
          ref="rawOverlayRef"
          class="raw-editor-overlay"
          v-html="highlightedRaw"
          aria-hidden="true"
        />
        <textarea
          ref="rawTextareaRef"
          class="raw-editor-input"
          :value="rawText"
          :placeholder="t.requestBodyPlaceholder"
          :disabled="props.disabled"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          @input="(e: InputEvent) => rawText = (e.target as HTMLTextAreaElement).value"
          @scroll="syncRawScroll"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.body-editor { display: flex; flex-direction: column; gap: 12px; flex: 1 1 auto; min-height: 0; }
.body-mode-hint { color: var(--text-tertiary); font-size: 13px; padding: 8px 0; }
.body-mode-blocked {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 4px;
  background: var(--bg-base)e6;
  border: 1px solid var(--status-warning);
  border-radius: 6px;
  color: var(--status-warning-fg);
  font-size: 13px;
}
.block-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--status-warning);
  color: var(--bg-base);
  font-size: 12px;
  font-weight: 700;
  flex: 0 0 auto;
}
.body-editor-locked :deep(.ant-radio-button-wrapper) {
  cursor: not-allowed !important;
  color: var(--text-tertiary);
}
.raw-controls {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.raw-action {
  font-size: 12px;
}
.raw-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 11px;
  font-family: 'SF Mono', 'Menlo', monospace;
}
.raw-status-ok {
  color: var(--status-success);
  background: var(--status-success-bg);
  border: 1px solid var(--status-success);
}
.raw-status-error {
  color: var(--tag-danger-fg);
  background: var(--status-danger-bg);
  border: 1px solid var(--status-danger);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.raw-editor-wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 150px;
  height: 100%;
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  overflow: auto;
}
.raw-editor-wrap.raw-editor-error {
  border-color: var(--status-danger);
}
/* Stack a transparent <textarea> on top of a <pre v-html> overlay. The
 * textarea carries the caret and selection but its text is invisible;
 * the overlay paints the colored tokens. Font, padding, line-height and
 * white-space must match exactly or the two layers drift. */
.raw-editor-overlay,
.raw-editor-input {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: var(--space-4);
  border: 0;
  font-family: 'SF Mono', 'Menlo', ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  overflow: auto;
  background: transparent;
  -webkit-text-fill-color: currentColor;
}
.raw-editor-overlay {
  pointer-events: none;
  color: var(--text-primary);
}
.raw-editor-overlay :deep(.tk-key) { color: var(--syntax-key, #2563eb); }
.raw-editor-overlay :deep(.tk-str) { color: var(--syntax-str, #16a34a); }
.raw-editor-overlay :deep(.tk-num) { color: var(--syntax-num, #ea580c); }
.raw-editor-overlay :deep(.tk-kw) { color: var(--syntax-kw, #dc2626); }
.raw-editor-overlay :deep(.tk-punc) { color: var(--text-tertiary); }
.raw-editor-input {
  color: transparent;
  caret-color: var(--text-primary);
  resize: none;
  outline: none;
}
.raw-editor-input::placeholder {
  color: var(--text-tertiary);
}
.raw-editor-input::selection {
  background: var(--accent-soft-bg);
}
.raw-editor-input:disabled {
  cursor: not-allowed;
}

.fd-row {
  display: grid;
  grid-template-columns: 28px 160px 1fr 80px 28px;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

/* Form-data header aligns with .fd-row grid */
.fd-header {
  display: grid;
  grid-template-columns: 28px 160px 1fr 80px 28px;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-base);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.fd-file-cell {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-base);
  border-radius: 4px;
  min-height: 32px;
}
.fd-file-name { font-weight: 500; }
.fd-file-size { color: var(--text-tertiary); font-size: 12px; }

/* Hidden file input. The visible "Choose File" button triggers its click()
   programmatically; the input itself can stay off-screen but must remain in
   the DOM and clickable. */
.fd-file-input {
  display: none;
}

.fd-add-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
}

.fd-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>