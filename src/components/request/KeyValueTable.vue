<script setup lang="ts">
// Key/value editor for headers, params, and urlencoded rows. Autocomplete is
// hand-rolled — Ant AutoComplete conflicted with our cell focus / blur logic.

import { ref, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import { Button, Checkbox } from 'ant-design-vue'
import { DeleteOutlined, PlusOutlined, HolderOutlined } from '@ant-design/icons-vue'
import type { KeyValueRow } from '@/core/types'
import { commonHeaderKeys, commonHeaderValuesFor } from '@/core/headers'
import { useEnvironmentStore } from '@/stores/environment'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()
const envStore = useEnvironmentStore()

// All variable names the user can reference inside this row's value via
// `{{name}}` — we union EVERY environment (not just the active one) plus
// globals, so the autocomplete is useful even before the user has
// activated an environment. The resolver still only honours the active
// env at send time; this list is just a typing aid.
const variableNames = computed<string[]>(() => {
  const out = new Set<string>()
  for (const env of envStore.environments) {
    for (const v of env.variables) {
      if (v.enabled && v.key.trim()) out.add(v.key.trim())
    }
  }
  for (const v of envStore.globals.variables) {
    if (v.enabled && v.key.trim()) out.add(v.key.trim())
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b))
})

// Detect a half-typed `{{partial` at the END of the input string (no
// closing `}}` yet). Returns the partial var name, or null if the cursor
// isn't inside a variable placeholder.
function partialVarAt(value: string): string | null {
  const idx = value.lastIndexOf('{{')
  if (idx < 0) return null
  const after = value.slice(idx + 2)
  // If there's a `}}` after the last `{{`, the placeholder is closed —
  // we're not inside a variable.
  if (after.includes('}}')) return null
  return after
}

export interface VirtualKeyValueRow {
  key: string
  value: string
  // Free-form reason code (e.g. 'virtual:auto-multipart', 'dropped-by-browser:…').
  // Shown as the row's `title` tooltip so the user can hover to learn why
  // this row exists and why they can't edit it.
  reason: string
}

const props = withDefaults(defineProps<{
  rows: KeyValueRow[]
  keyPlaceholder?: string
  valuePlaceholder?: string
  disabled?: boolean
  // Read-only rows rendered above the user-editable rows. Used to surface
  // headers the framework injects on the user's behalf (e.g. multipart
  // Content-Type set by fetch) or headers stripped at send-time (browser-
  // banned headers). They cannot be edited, dragged, or deleted — the user
  // reads them and adjusts their own rows accordingly.
  virtualRows?: VirtualKeyValueRow[]
  // Hint about what kind of KV this is. Used to decide whether the key/
  // value cells should show an autocomplete dropdown.
  //   'header'    → suggest common header names + standard values
  //   otherwise   → plain text input
  rowKind?: 'header' | 'param' | 'urlencoded'
  emptyHint?: string
  /** Width in px of the key column. Default 220 — narrower is useful in
   *  environment managers where variable names are short but values are
   *  long URLs / tokens. */
  keyWidth?: number
  /** Hide the drag handle and disable row reordering. Used by callers
   *  where order doesn't matter (environment variable editors) and the
   *  drag affordance just gets in the way of text selection. */
  disableDrag?: boolean
}>(), {
  keyPlaceholder: 'Key',
  valuePlaceholder: 'Value',
  disabled: false,
  virtualRows: () => [],
  rowKind: undefined,
  emptyHint: 'This request has no parameters.',
  keyWidth: 220,
  disableDrag: true
})

const emit = defineEmits<{
  (e: 'update', rows: KeyValueRow[]): void
}>()

const isHeader = computed(() => props.rowKind === 'header')

// Pass `browse=true` to ignore the query entirely (used by the ▾ button
// which opens the full dictionary regardless of what's already typed).
function keySuggestions(q: string, browse = false): string[] {
  if (!isHeader.value) return []
  const all = commonHeaderKeys
  if (browse || !q) return [...all].sort((a, b) => a.localeCompare(b))
  const lower = q.toLowerCase()
  const prefix: string[] = []
  const sub: string[] = []
  for (const k of all) {
    const lk = k.toLowerCase()
    if (lk.startsWith(lower)) prefix.push(k)
    else if (lk.includes(lower)) sub.push(k)
  }
  return [...prefix, ...sub].slice(0, 12)
}
function valueSuggestions(q: string, key: string, browse = false): string[] {
  // Variable mode takes priority over the header dictionary — even
  // headers can reference {{token}}, so we surface variable names
  // whenever the input ends in an unclosed `{{partial`.
  const partial = partialVarAt(q)
  if (partial !== null) {
    if (!partial) return variableNames.value.slice(0, 12)
    return variableNames.value.filter(v => v.toLowerCase().startsWith(partial.toLowerCase())).slice(0, 12)
  }

  if (!isHeader.value) return []
  const all = commonHeaderValuesFor(key)
  if (browse || !q) return all
  const lower = q.toLowerCase()
  return all.filter(v => v.toLowerCase().includes(lower)).slice(0, 12)
}

// We open the dropdown when the cell gets focus and the dictionary has
// entries to show. While open, the current cell owns `activeIndex` for
// keyboard nav (Up/Down to move, Enter to accept, Escape to dismiss).
// The dropdown is `position: fixed` and placed via getBoundingClientRect of
// the anchor cell so that ancestor overflow (kv-table, AntD Tabs) doesn't
// clip it. Re-measured on scroll, resize, and before each paint.
type SuggestCol = 'key' | 'value'
const openCell = ref<{ row: number; col: SuggestCol } | null>(null)
const activeIndex = ref(0)
const currentSuggests = ref<string[]>([])
const suggestRect = ref<{ left: number; top: number; width: number } | null>(null)
const suggestEl = ref<HTMLElement | null>(null)
const cellEl = ref<HTMLElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)

function openSuggest(row: number, col: SuggestCol, idx: number, key: string, browse = false) {
  if (props.disabled) return
  openCell.value = { row, col }
  activeIndex.value = 0
  const val = col === 'key' ? props.rows[row].key : props.rows[row].value
  currentSuggests.value = col === 'key'
    ? keySuggestions(val, browse)
    : valueSuggestions(val, key, browse)
  // Position is set after the anchor cell is laid out. nextTick + rAF covers
  // the first show; subsequent scroll/resize recompute via the listeners.
  nextTick(() => {
    if (!openCell.value || openCell.value.row !== row || openCell.value.col !== col) return
    measureSuggestPosition()
  })
}
function browseSuggest(row: number, col: SuggestCol) {
  openSuggest(row, col, row, props.rows[row].key, true)
  // Keep the input focused (mousedown on the button would otherwise blur
  // the input → blur handler would close the dropdown).
  queueMicrotask(() => focusCell(row, col))
}
function refreshOpenSuggest(idx: number, col: SuggestCol, key: string, value: string) {
  if (!openCell.value || openCell.value.row !== idx) return
  if (openCell.value.col === col) {
    currentSuggests.value = col === 'key'
      ? keySuggestions(key, false)
      : valueSuggestions(value, key, false)
  }
  nextTick(measureSuggestPosition)
}
function measureSuggestPosition() {
  if (!cellEl.value) return
  const r = cellEl.value.getBoundingClientRect()
  suggestRect.value = { left: r.left, top: r.bottom + 4, width: r.width }
}
function onSuggestScroll() {
  if (!openCell.value) return
  measureSuggestPosition()
}
function closeSuggest() {
  openCell.value = null
  activeIndex.value = 0
  currentSuggests.value = []
  suggestRect.value = null
}
watch(openCell, async open => {
  if (open) {
    // Find the anchor cell in the next tick (DOM is updated by then) and
    // measure before the dropdown paints to avoid a 1-frame flicker.
    // Scope the lookup to THIS table's root — otherwise we'd pick the
    // wrong cell when the Params and Headers tabs share row index 0.
    await nextTick()
    const root = rootEl.value
    const input = root?.querySelector(
      `input.kv-input[data-kv-row="${open.row}"][data-kv-col="${open.col}"]`
    ) as HTMLElement | null
    const cell = input?.closest('.kv-cell') as HTMLElement | null
    if (cell) cellEl.value = cell
    measureSuggestPosition()
    window.addEventListener('scroll', onSuggestScroll, true)
    window.addEventListener('resize', onSuggestScroll)
  } else {
    window.removeEventListener('scroll', onSuggestScroll, true)
    window.removeEventListener('resize', onSuggestScroll)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onSuggestScroll, true)
  window.removeEventListener('resize', onSuggestScroll)
})
function acceptsSuggest(s: string) {
  const cell = openCell.value
  if (!cell) return

  // Variable mode: if the current value ends in an unclosed `{{partial`,
  // the suggestion is a variable name — splice `{{name}}` into the value
  // at the cursor instead of replacing the whole input. This lets users
  // compose values like "Bearer {{token}}" without losing the prefix.
  if (cell.col === 'value') {
    const inputEl = document.querySelector<HTMLInputElement>(
      `input.kv-input[data-kv-row="${cell.row}"][data-kv-col="value"]`
    )
    const current = inputEl?.value ?? ''
    const partial = partialVarAt(current)
    if (partial !== null) {
      // Replace the trailing `{{partial` with the chosen `{{name}}` so
      // typing can continue after the closing braces.
      const newValue = current.replace(/\{\{[^}]*$/, `{{${s}}}`)
      updateValue(cell.row, newValue)
      queueMicrotask(() => {
        // Position cursor at end so the user can keep adding chars
        // after the inserted placeholder.
        focusCell(cell.row, 'value')
      })
      closeSuggest()
      return
    }
  }

  if (cell.col === 'key') {
    updateKey(cell.row, s)
    queueMicrotask(() => focusCell(cell.row, 'value'))
  } else {
    updateValue(cell.row, s)
    queueMicrotask(() => focusCell(cell.row, 'key'))
  }
  closeSuggest()
}
function moveSuggest(delta: number) {
  if (!currentSuggests.value.length) return
  const n = currentSuggests.value.length
  activeIndex.value = (activeIndex.value + delta + n) % n
}

const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, idx: number) {
  dragIndex.value = idx
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }
}
function onDragOver(e: DragEvent, idx: number) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  overIndex.value = idx
}
function onDragLeave(idx: number) {
  if (overIndex.value === idx) overIndex.value = null
}
function onDrop(e: DragEvent, idx: number) {
  e.preventDefault()
  const from = dragIndex.value
  if (from === null || from === idx) {
    dragIndex.value = null
    overIndex.value = null
    return
  }
  const next = props.rows.slice()
  const [moved] = next.splice(from, 1)
  next.splice(idx, 0, moved)
  emit('update', next)
  dragIndex.value = null
  overIndex.value = null
}
function onDragEnd() {
  dragIndex.value = null
  overIndex.value = null
}


function addRow() {
  emit('update', [...props.rows, { key: '', value: '', enabled: true }])
}
function removeRow(idx: number) {
  const next = props.rows.slice()
  next.splice(idx, 1)
  emit('update', next)
}
function updateKey(idx: number, key: string) {
  const next = props.rows.slice()
  next[idx] = { ...next[idx], key }
  emit('update', next)
  refreshOpenSuggest(idx, 'key', key, next[idx]!.value)
}
function updateValue(idx: number, value: string) {
  const next = props.rows.slice()
  next[idx] = { ...next[idx], value }
  emit('update', next)
  refreshOpenSuggest(idx, 'value', next[idx]!.key, value)
}
function toggleEnabled(idx: number, enabled: boolean) {
  const next = props.rows.slice()
  next[idx] = { ...next[idx], enabled }
  emit('update', next)
  if (openCell.value?.row === idx) nextTick(measureSuggestPosition)
}

// Visual signal: rows whose value contains a {{...}} placeholder get a
// subtle left border so users can spot "this row has a variable" at a
// glance. Plain rows stay neutral.
function rowHasVar(row: KeyValueRow): boolean {
  return /\{\{[^}]+\}\}/.test(row.value) || /\{\{[^}]+\}\}/.test(row.key)
}

// AntD wrappers around inputs made focus traversal brittle; with plain
// <input> elements we own the focus call directly.
function focusCell(row: number, col: 'key' | 'value') {
  const root = rootEl.value
  if (!root) return
  const el = root.querySelector<HTMLInputElement>(`[data-kv-row="${row}"][data-kv-col="${col}"]`)
  if (!el) return
  el.focus()
  const len = el.value.length
  el.setSelectionRange(len, len)
}

function onCellInput(e: Event, idx: number, col: 'key' | 'value') {
  const target = e.target as HTMLInputElement
  const val = target.value
  if (col === 'key') updateKey(idx, val)
  else updateValue(idx, val)
}

function onCellFocus(idx: number, col: 'key' | 'value') {
  if (!isHeader.value) return
  // Will open the dropdown after layout — small delay so focus settles.
  queueMicrotask(() => openSuggest(idx, col, idx, props.rows[idx].key))
}

function onCellBlur(e: FocusEvent, idx: number, col: 'key' | 'value') {
  // If the blur is moving to an element inside our open dropdown, keep the
  // dropdown open — the click handler on the item will fire next.
  const rt = e.relatedTarget as HTMLElement | null
  if (rt && rt.closest && rt.closest('.kv-suggest')) return
  // Defer slightly so mousedown on a suggest item can run BEFORE blur
  // completes (browsers fire mousedown first, then blur).
  setTimeout(() => {
    const cell = openCell.value
    if (!cell || cell.row !== idx || cell.col !== col) return
    closeSuggest()
  }, 120)
}

function onCellKeydown(e: KeyboardEvent, idx: number, col: 'key' | 'value') {
  // Suggestion keyboard nav (only when dropdown is open for THIS cell).
  const cell = openCell.value
  if (cell && cell.row === idx && cell.col === col && currentSuggests.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveSuggest(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveSuggest(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const pick = currentSuggests.value[activeIndex.value]
      acceptsSuggest(pick)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      closeSuggest()
      return
    }
  }

  if (e.key !== 'Enter') return
  e.preventDefault()
  const nextRow = e.shiftKey ? idx - 1 : idx + 1
  if (col === 'value' && (e.shiftKey || nextRow >= props.rows.length)) {
    // Add a new row and focus its key cell on the next tick.
    emit('update', [...props.rows, { key: '', value: '', enabled: true }])
    queueMicrotask(() => focusCell(props.rows.length, 'key'))
    return
  }
  if (nextRow >= 0 && nextRow < props.rows.length) {
    queueMicrotask(() => focusCell(nextRow, col === 'key' ? 'value' : 'key'))
  }
}
</script>

<template>
  <div
    ref="rootEl"
    class="kv-table"
    :style="{
      '--kv-key-width': props.keyWidth + 'px',
      '--kv-grid-cols': props.disableDrag
        ? '36px var(--kv-key-width, 220px) 1fr 36px'
        : '22px 36px var(--kv-key-width, 220px) 1fr 36px'
    }"
  >
    <div class="kv-header">
      <span v-if="!props.disableDrag" class="kv-col-drag" />
      <span class="kv-col-enabled" />
      <span class="kv-col-key">{{ t.key }}</span>
      <span class="kv-col-value">{{ t.value }}</span>
      <span class="kv-col-actions" />
    </div>

    <div
      v-if="rows.length === 0 && virtualRows.length === 0"
      class="kv-empty"
    >
      {{ emptyHint }}
    </div>

    <div
      v-for="(v, idx) in virtualRows"
      :key="'virtual-' + idx"
      class="kv-row kv-virtual-row"
      :title="v.reason"
    >
      <span v-if="!props.disableDrag" class="kv-col-drag" />
      <span class="kv-col-enabled" />
      <span class="kv-col-key">
        <div class="kv-cell kv-cell-key kv-virtual-cell">
          {{ v.key }}
        </div>
      </span>
      <span class="kv-col-value">
        <div class="kv-cell kv-cell-value kv-virtual-cell">
          {{ v.value }}
        </div>
      </span>
      <span class="kv-col-actions" />
    </div>

    <div
      v-for="(row, idx) in rows"
      :key="idx"
      class="kv-row"
      :class="{
        'kv-row-dragging': dragIndex === idx,
        'kv-row-over': overIndex === idx && dragIndex !== null && dragIndex !== idx,
        'kv-row-disabled': !row.enabled,
        'kv-row-has-var': rowHasVar(row)
      }"
      :data-kv-row="idx"
      :draggable="!disabled && !props.disableDrag"
      @dragstart="(!disabled && !props.disableDrag) ? (e: DragEvent) => onDragStart(e, idx) : undefined"
      @dragover="(e) => onDragOver(e, idx)"
      @dragleave="() => onDragLeave(idx)"
      @drop="(e) => onDrop(e, idx)"
      @dragend="onDragEnd"
    >
      <span v-if="!props.disableDrag" class="kv-col-drag kv-drag" :class="{ 'kv-drag-disabled': disabled }">
        <HolderOutlined />
      </span>
      <span class="kv-col-enabled">
        <Checkbox
          :checked="row.enabled"
          :disabled="disabled"
          @update:checked="(v: boolean) => toggleEnabled(idx, v)"
        />
      </span>
      <span class="kv-col-key">
        <div
          class="kv-cell kv-cell-key"
          :data-kv-row="idx"
        >
          <input
            type="text"
            class="kv-input"
            :value="row.key"
            :placeholder="keyPlaceholder"
            :disabled="disabled"
            :data-kv-row="idx"
            data-kv-col="key"
            autocomplete="off"
            spellcheck="false"
            @input="(e) => onCellInput(e, idx, 'key')"
            @focus="() => onCellFocus(idx, 'key')"
            @blur="(e: FocusEvent) => onCellBlur(e, idx, 'key')"
            @keydown="(e: KeyboardEvent) => onCellKeydown(e, idx, 'key')"
          />
          <button
            v-if="isHeader"
            type="button"
            class="kv-pick"
            :disabled="disabled"
            tabindex="-1"
            :title="t.browseHeaders"
            @mousedown.prevent="browseSuggest(idx, 'key')"
          >▾</button>
        </div>
      </span>
      <span class="kv-col-value">
        <div
          class="kv-cell kv-cell-value"
          :data-kv-row="idx"
        >
          <input
            type="text"
            class="kv-input"
            :value="row.value"
            :placeholder="valuePlaceholder"
            :disabled="disabled"
            :data-kv-row="idx"
            data-kv-col="value"
            autocomplete="off"
            spellcheck="false"
            @input="(e) => onCellInput(e, idx, 'value')"
            @focus="() => onCellFocus(idx, 'value')"
            @blur="(e: FocusEvent) => onCellBlur(e, idx, 'value')"
            @keydown="(e: KeyboardEvent) => onCellKeydown(e, idx, 'value')"
          />
          <button
            v-if="isHeader"
            type="button"
            class="kv-pick"
            :disabled="disabled"
            tabindex="-1"
            :title="t.browseValues"
            @mousedown.prevent="browseSuggest(idx, 'value')"
          >▾</button>
        </div>
      </span>
      <span class="kv-col-actions">
        <Button
          type="text"
          class="kv-delete"
          :disabled="disabled"
          @click="removeRow(idx)"
        >
          <template #icon><DeleteOutlined /></template>
        </Button>
      </span>
    </div>

    <div class="kv-add-wrap">
      <Button
        block
        type="dashed"
        class="kv-add"
        :disabled="disabled"
        @click="addRow"
      >
        <template #icon><PlusOutlined /></template>
        {{ t.addRow }}
      </Button>
    </div>

    <!-- Suggestion dropdown is teleported to <body> so that ancestor
         overflow / stacking-contexts (AntD Tabs, kv-table border-radius) can
         never clip it. Position is recomputed on scroll/resize via
         measureSuggestPosition(). -->
    <Teleport to="body">
      <div
        v-if="openCell && currentSuggests.length > 0 && suggestRect"
        ref="suggestEl"
        class="kv-suggest"
        :style="{
          left: suggestRect.left + 'px',
          top: suggestRect.top + 'px',
          width: suggestRect.width + 'px'
        }"
      >
        <div
          v-for="(s, i) in currentSuggests"
          :key="s"
          class="kv-suggest-item"
          :class="{ 'kv-suggest-active': i === activeIndex }"
          @mousedown.prevent="acceptsSuggest(s)"
          @mouseenter="activeIndex = i"
        >
          {{ s }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.kv-table {
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--bg-base);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  position: relative;
  /* overflow stays visible so the suggest dropdown can spill outside the
     table border without being clipped. The rounded corners still apply
     to the table itself; child elements just paint over the edge. */
}

.kv-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  background: var(--bg-muted);
}

.kv-header {
  display: grid;
  grid-template-columns: var(--kv-grid-cols, 22px 36px var(--kv-key-width, 220px) 1fr 36px);
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-muted);
  border-bottom: 1px solid var(--border-strong);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.kv-col-drag { display: inline-block; }
.kv-col-enabled { display: inline-flex; align-items: center; justify-content: center; }

.kv-row {
  display: grid;
  grid-template-columns: var(--kv-grid-cols, 22px 36px var(--kv-key-width, 220px) 1fr 36px);
  align-items: stretch;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-base);
  transition: background-color 0.1s;
  min-height: 44px;
}
.kv-row:nth-child(even) { background: var(--bg-muted); }
.kv-row:last-of-type { border-bottom: none; }
.kv-row:hover { background: var(--accent-soft-bg); }
.kv-row-disabled .kv-input {
  color: var(--text-tertiary);
  text-decoration: line-through;
}

/* Rows that contain a {{var}} placeholder get a left accent stripe +
 * a subtle accent-tinted background so users can scan the table for
 * "this depends on the environment" without reading every cell. */
.kv-row-has-var {
  position: relative;
  background: var(--accent-soft-bg) !important;
}
.kv-row-has-var:hover {
  background: var(--accent-soft-bg) !important;
}
.kv-row-has-var::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent);
  z-index: 1;
}
/* Make the {{name}} inside the input visually pop so users see it's a
 * variable, not literal text. We can't style inside <input> directly,
 * but the row-level signal + the input's monospace font already make
 * the placeholder noticeable. */
.kv-row-has-var .kv-input {
  background: var(--bg-base);
}

.kv-virtual-row {
  background: var(--bg-muted) !important;
  cursor: help;
}
.kv-virtual-row:hover { background: var(--bg-muted) !important; }
.kv-virtual-cell {
  font-family: "SF Mono", "Menlo", "Consolas", monospace;
  font-size: 12px;
  color: var(--text-tertiary);
  font-style: italic;
  padding: 6px 10px;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kv-row-dragging { opacity: 0.4; }
.kv-row-over {
  background: var(--accent-soft-bg) !important;
  box-shadow: inset 0 0 0 1px var(--accent);
}

.kv-drag {
  cursor: grab;
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.kv-drag:active { cursor: grabbing; }
.kv-drag-disabled { cursor: default; opacity: 0.4; }

.kv-cell {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}
.kv-cell-key,
.kv-cell-value {
  width: 100%;
}

.kv-pick {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, color 0.1s;
}
.kv-pick:hover:not(:disabled) {
  background: var(--accent-soft-bg);
  color: var(--accent);
}
.kv-pick:disabled { opacity: 0; pointer-events: none; }
.kv-cell:focus-within .kv-pick { color: var(--accent); }

.kv-input {
  width: 100%;
  min-width: 0;
  padding: 6px 30px 6px 10px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background: var(--bg-base);
  font-family: "SF Mono", "Menlo", "Consolas", monospace;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.1s, box-shadow 0.1s;
  box-sizing: border-box;
}
.kv-input::placeholder {
  color: var(--text-tertiary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.kv-input:hover:not(:disabled) { border-color: var(--accent); }
.kv-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.18);
}
.kv-input:disabled { background: var(--bg-muted); cursor: not-allowed; }

/* Suggestion dropdown — teleported to <body> so no ancestor can clip it.
   Position is set via inline left/top/width in the template, measured
   from the active cell's getBoundingClientRect. */
.kv-suggest {
  position: fixed;
  z-index: 9999;
  background: var(--bg-base);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  max-height: 280px;
  overflow-y: auto;
}
.kv-suggest-item {
  padding: 8px 12px;
  font-family: "SF Mono", "Menlo", "Consolas", monospace;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kv-suggest-item:hover,
.kv-suggest-active {
  background: var(--accent-soft-bg);
  color: var(--accent-soft-fg);
}

.kv-delete {
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
}
.kv-delete:hover:not(:disabled) {
  color: var(--status-danger);
  background: var(--status-danger-bg);
}

.kv-add-wrap {
  padding: 6px 12px;
  border-top: 1px solid var(--border-base);
  background: var(--bg-muted);
}
.kv-add {
  width: 100%;
  height: 32px;
  border: none !important;
  background: var(--bg-muted);
  color: var(--accent);
  font-weight: 500;
  border-radius: 4px;
  transition: background-color 0.1s, color 0.1s;
}
.kv-add:hover {
  background: var(--accent-soft-bg) !important;
  color: var(--accent-soft-fg) !important;
}
</style>
