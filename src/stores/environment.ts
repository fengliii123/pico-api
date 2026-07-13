// Environment store: holds the list of environments + globals, tracks the
// active environment, and persists mutations to IndexedDB.
//
// `activeEnvironmentId` is persisted to localStorage (not IndexedDB) — it's
// lightweight UI state and we want it to load synchronously before the IDB
// pump spins up, so the first render shows the right selector.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Environment, Globals, EnvironmentVariable } from '@/core/types'
import { environments as envDb, globals as globalsDb, GLOBALS_ID } from '@/db'
import { uid } from '@/utils/id'

const LS_KEY = 'mp2:activeEnvironmentId'

export const useEnvironmentStore = defineStore('environment', () => {
  const environments = ref<Environment[]>([])
  const globals = ref<Globals>({ id: GLOBALS_ID, variables: [], updatedAt: 0 })
  const activeEnvironmentId = ref<string | null>(loadActive())
  const loaded = ref(false)

  const environmentsById = computed(() => {
    const m = new Map<string, Environment>()
    for (const e of environments.value) m.set(e.id, e)
    return m
  })

  const activeEnvironment = computed(() =>
    activeEnvironmentId.value ? environmentsById.value.get(activeEnvironmentId.value) : undefined
  )

  // Convenience: the variables to use right now for interpolation.
  // Empty array when no environment is active.
  const activeVariables = computed<EnvironmentVariable[]>(() =>
    activeEnvironment.value ? activeEnvironment.value.variables : []
  )

  function loadActive(): string | null {
    try {
      const v = localStorage.getItem(LS_KEY)
      return v ? JSON.parse(v) : null
    } catch {
      return null
    }
  }

  function persistActive() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(activeEnvironmentId.value))
    } catch {
      // ignore
    }
  }

  async function load() {
    const [envs, g] = await Promise.all([envDb.list(), globalsDb.get()])
    environments.value = envs.sort((a, b) => a.order - b.order)
    if (g) {
      globals.value = g
    } else {
      // First-run: seed an empty globals row so subsequent updates are
      // simple `put` operations.
      const seed: Globals = { id: GLOBALS_ID, variables: [], updatedAt: Date.now() }
      await globalsDb.put(seed)
      globals.value = seed
    }
    // If the persisted active id points to a deleted environment, fall back
    // to no active.
    if (activeEnvironmentId.value && !environmentsById.value.has(activeEnvironmentId.value)) {
      activeEnvironmentId.value = null
      persistActive()
    }
    loaded.value = true
  }

  function setActive(id: string | null) {
    activeEnvironmentId.value = id
    persistActive()
  }


  async function createEnvironment(name = 'New Environment'): Promise<Environment> {
    const e: Environment = {
      id: uid(),
      name,
      variables: [],
      order: environments.value.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    await envDb.put(e)
    environments.value = [...environments.value, e]
    // Auto-activate the new environment so the user can immediately
    // reference its variables in {{var}} placeholders. This matches
    // Postman, and avoids the silent "I added baseUrl but my URL still
    // says {{baseUrl}}" trap from before.
    setActive(e.id)
    return e
  }

  async function renameEnvironment(id: string, name: string) {
    const e = environmentsById.value.get(id)
    if (!e) return
    e.name = name
    e.updatedAt = Date.now()
    await envDb.put(e)
    environments.value = [...environments.value]
  }

  async function updateEnvironmentVariables(id: string, variables: EnvironmentVariable[]) {
    const e = environmentsById.value.get(id)
    if (!e) return
    e.variables = variables
    e.updatedAt = Date.now()
    await envDb.put(e)
    environments.value = [...environments.value]
  }

  async function deleteEnvironment(id: string) {
    await envDb.delete(id)
    environments.value = environments.value.filter(e => e.id !== id)
    if (activeEnvironmentId.value === id) {
      setActive(null)
    }
  }


  async function updateGlobals(variables: EnvironmentVariable[]) {
    globals.value = {
      ...globals.value,
      variables,
      updatedAt: Date.now()
    }
    await globalsDb.put(globals.value)
  }

  return {
    environments,
    globals,
    activeEnvironmentId,
    activeEnvironment,
    activeVariables,
    environmentsById,
    loaded,
    load,
    setActive,
    createEnvironment,
    renameEnvironment,
    updateEnvironmentVariables,
    deleteEnvironment,
    updateGlobals
  }
})
