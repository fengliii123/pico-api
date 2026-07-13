// Undo/Redo store: maintains a history stack of request changes.
// Supports undo/redo for request edits (name, method, url, headers, params, body).
// Maximum 10 steps of history.
//
// Key invariant: `past` stores the BEFORE state of each edit (i.e. what
// the draft looked like before the change described by `description`).
// `previousSnapshot` is the most recent draft we've recorded — every
// push() compares the new draft against it; if different, the previous
// snapshot is what gets pushed (the user can undo back to it). After
// push(), previousSnapshot is updated to the new draft.
//
// This avoids the original bug where push() stored the AFTER state —
// undo() would pop the current state and reapply it, leaving the draft
// unchanged.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DraftRequest } from '@/core/types'
import { deepClone } from '@/utils/clone'

interface HistoryEntry {
  timestamp: number
  snapshot: DraftRequest
  description: string
}

const MAX_HISTORY = 10

function cloneDraft(draft: DraftRequest): DraftRequest {
  return deepClone(draft)
}

function sameDraft(a: DraftRequest, b: DraftRequest): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export const useUndoRedoStore = defineStore('undoRedo', () => {
  const past = ref<HistoryEntry[]>([])
  const future = ref<HistoryEntry[]>([])

  // Tracks the draft snapshot at the time of the last push. null until
  // reset() is called with the initial draft.
  const previousSnapshot = ref<DraftRequest | null>(null)

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  const undoDescription = computed(() =>
    past.value.length > 0 ? past.value[past.value.length - 1].description : null
  )
  const redoDescription = computed(() =>
    future.value.length > 0 ? future.value[future.value.length - 1].description : null
  )

  // Seed the baseline. Call this whenever the editor loads a fresh
  // request (newRequest / loadFromSaved / loadFromDraft) so the first
  // edit can be undone back to the loaded state.
  function reset(initial: DraftRequest) {
    past.value = []
    future.value = []
    previousSnapshot.value = cloneDraft(initial)
  }

  function push(currentDraft: DraftRequest, description: string) {
    // First push after reset: previousSnapshot is set, so we always have
    // a baseline to compare against. If currentDraft matches the
    // baseline, there's nothing to record.
    if (previousSnapshot.value === null) {
      previousSnapshot.value = cloneDraft(currentDraft)
      return
    }
    if (sameDraft(previousSnapshot.value, currentDraft)) return

    // Record the BEFORE state and advance the baseline.
    past.value.push({
      timestamp: Date.now(),
      snapshot: cloneDraft(previousSnapshot.value),
      description
    })
    previousSnapshot.value = cloneDraft(currentDraft)

    if (past.value.length > MAX_HISTORY) {
      past.value = past.value.slice(past.value.length - MAX_HISTORY)
    }

    // Standard undo semantics: any new edit discards the redo stack.
    future.value = []
  }

  function undo(current: DraftRequest): DraftRequest | null {
    if (past.value.length === 0) return null

    const entry = past.value.pop()!
    // Push the FROM state onto future so redo can restore it.
    future.value.push({
      timestamp: Date.now(),
      snapshot: cloneDraft(current),
      description: entry.description
    })
    // Rolling back means previousSnapshot becomes the entry's snapshot.
    previousSnapshot.value = cloneDraft(entry.snapshot)
    return entry.snapshot
  }

  function redo(current: DraftRequest): DraftRequest | null {
    if (future.value.length === 0) return null

    const entry = future.value.pop()!
    past.value.push({
      timestamp: Date.now(),
      snapshot: cloneDraft(current),
      description: entry.description
    })
    previousSnapshot.value = cloneDraft(entry.snapshot)
    return entry.snapshot
  }

  function clear() {
    past.value = []
    future.value = []
    previousSnapshot.value = null
  }

  return {
    past,
    future,
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    reset,
    push,
    undo,
    redo,
    clear
  }
})
