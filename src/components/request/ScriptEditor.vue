<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from '@codemirror/language'
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import type { RequestScripts } from '@/core/types'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()
const props = defineProps<{
  modelValue: RequestScripts
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: RequestScripts): void
}>()

// Refs for editor containers
const preRequestRef = ref<HTMLDivElement | null>(null)
const postResponseRef = ref<HTMLDivElement | null>(null)

// Editor views
let preRequestView: EditorView | null = null
let postResponseView: EditorView | null = null

// Helper to create an editor
function createEditor(
  container: HTMLDivElement,
  value: string,
  onChange: (value: string) => void
): EditorView {
  const state = EditorState.create({
    doc: value,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...completionKeymap
      ]),
      javascript(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      }),
      // Theme-aware editor chrome. Background, foreground, gutter, and
      // active-line/selection all bind to the same CSS variables the rest
      // of the app uses, so switching theme (light/dark/sepia via
      // data-theme) repaints the editor automatically without a CodeMirror
      // reconfigure. We do NOT apply oneDark here — that would force a
      // fixed dark surface regardless of theme.
      EditorView.theme(
        {
          '&': {
            height: '100%',
            fontSize: '13px',
            backgroundColor: 'var(--bg-subtle)',
            color: 'var(--text-primary)'
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: '"SF Mono", "Menlo", "Monaco", "Consolas", monospace'
          },
          '.cm-content': {
            padding: '8px 0',
            caretColor: 'var(--accent)'
          },
          '.cm-gutters': {
            backgroundColor: 'var(--bg-base)',
            color: 'var(--text-tertiary)',
            borderRight: '1px solid var(--border-base)'
          },
          '.cm-lineNumbers .cm-gutterElement': {
            padding: '0 8px'
          },
          '.cm-activeLine': {
            backgroundColor: 'var(--bg-muted)'
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'var(--bg-muted)',
            color: 'var(--text-secondary)'
          },
          '.cm-selectionBackground, ::selection': {
            backgroundColor: 'var(--accent-soft-bg)'
          }
        },
        { dark: false }
      )
    ]
  })

  return new EditorView({ state, parent: container })
}

onMounted(() => {
  if (preRequestRef.value) {
    preRequestView = createEditor(
      preRequestRef.value,
      props.modelValue.preRequest,
      (value) => {
        emit('update:modelValue', { ...props.modelValue, preRequest: value })
      }
    )
  }

  if (postResponseRef.value) {
    postResponseView = createEditor(
      postResponseRef.value,
      props.modelValue.postResponse,
      (value) => {
        emit('update:modelValue', { ...props.modelValue, postResponse: value })
      }
    )
  }
})

onUnmounted(() => {
  preRequestView?.destroy()
  postResponseView?.destroy()
})

// Sync external changes to editor (e.g., when switching requests)
watch(() => props.modelValue, (newVal) => {
  if (preRequestView && newVal.preRequest !== preRequestView.state.doc.toString()) {
    preRequestView.dispatch({
      changes: { from: 0, to: preRequestView.state.doc.length, insert: newVal.preRequest }
    })
  }
  if (postResponseView && newVal.postResponse !== postResponseView.state.doc.toString()) {
    postResponseView.dispatch({
      changes: { from: 0, to: postResponseView.state.doc.length, insert: newVal.postResponse }
    })
  }
}, { deep: true })

function clearScript(which: 'preRequest' | 'postResponse') {
  if (which === 'preRequest' && preRequestView) {
    preRequestView.dispatch({
      changes: { from: 0, to: preRequestView.state.doc.length, insert: '' }
    })
    emit('update:modelValue', { ...props.modelValue, preRequest: '' })
  } else if (which === 'postResponse' && postResponseView) {
    postResponseView.dispatch({
      changes: { from: 0, to: postResponseView.state.doc.length, insert: '' }
    })
    emit('update:modelValue', { ...props.modelValue, postResponse: '' })
  }
}
</script>

<template>
  <div class="script-editor">
    <div class="security-banner" role="note">
      <span class="security-icon">⚠</span>
      <span class="security-text">{{ t.scriptSecurityWarning }}</span>
    </div>
    <div class="script-section">
      <div class="script-header">
        <div class="script-title">
          <span class="script-badge pre">Pre</span>
          <span>{{ t.preRequestScript }}</span>
        </div>
        <button class="clear-btn" @click="clearScript('preRequest')">{{ t.clear }}</button>
      </div>
      <p class="script-hint">{{ t.preRequestHint }}</p>
      <div ref="preRequestRef" class="editor-container" />
    </div>

    <div class="script-section">
      <div class="script-header">
        <div class="script-title">
          <span class="script-badge post">Post</span>
          <span>{{ t.postResponseScript }}</span>
        </div>
        <button class="clear-btn" @click="clearScript('postResponse')">{{ t.clear }}</button>
      </div>
      <p class="script-hint">{{ t.postResponseHint }}</p>
      <div ref="postResponseRef" class="editor-container" />
    </div>

    <div class="script-examples">
      <h4>{{ t.scriptExamplesTitle }}</h4>
      <div class="example-group">
        <h5>{{ t.scriptExampleSetVar }}</h5>
        <code v-pre>pm.variables.replaceIn('{{myVar}}')</code>
        <code>pm.environment.set('token', 'abc123')</code>
      </div>
      <div class="example-group">
        <h5>{{ t.scriptExampleTestResponse }}</h5>
        <code v-pre>pm.test('Status is 200', () => pm.response.to.have.status(200))</code>
        <code v-pre>pm.test('Response time &lt; 500ms', () => pm.expect(pm.response.responseTime).to.be.below(500))</code>
      </div>
    </div>
  </div>
</template>

<style scoped>
.script-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-6);
  height: 100%;
  overflow: auto;
}

.security-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--status-warning-bg);
  border: 1px solid var(--status-warning-bg);
  border-left-width: 3px;
  border-left-color: var(--status-warning);
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.security-icon {
  flex: 0 0 auto;
  color: var(--status-warning);
  font-weight: var(--fw-semibold);
}

.security-text {
  flex: 1;
}

.script-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.script-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.script-title {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  font-weight: var(--fw-medium);
}

.script-badge {
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-base);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
}

.script-badge.pre {
  background: #3b82f6;
  color: white;
}

.script-badge.post {
  background: #10b981;
  color: white;
}

.script-hint {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--text-tertiary);
}

.clear-btn {
  padding: var(--space-2) var(--space-5);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-base);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--fs-sm);
  cursor: pointer;
  transition: all var(--ease-fast);
}

.clear-btn:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.editor-container {
  height: 180px;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-base);
}

.script-examples {
  margin-top: var(--space-6);
  padding: var(--space-6);
  background: var(--bg-subtle);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-base);
}

.script-examples h4 {
  margin: 0 0 var(--space-5);
  font-size: var(--fs-base);
  font-weight: var(--fw-medium);
  color: var(--text-secondary);
}

.script-examples h5 {
  margin: var(--space-4) 0 var(--space-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}

.example-group {
  margin-bottom: var(--space-4);
}

.script-examples code {
  display: block;
  margin: var(--space-2) 0;
  padding: var(--space-2) var(--space-4);
  background: var(--bg-muted);
  border-radius: var(--radius-base);
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: var(--fs-xs);
  color: var(--text-secondary);
}
</style>
