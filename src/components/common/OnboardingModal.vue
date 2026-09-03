<script setup lang="ts">
// One-shot onboarding modal shown the first time the user opens the app.
// The primary CTA fills the URL bar with a live example endpoint so the
// user can send their first request within seconds — the fastest path to
// the "it works" moment. "Seen" is marked in localStorage so the modal
// never re-appears on subsequent visits.

import { nextTick, ref } from 'vue'
import { Modal, Button } from 'ant-design-vue'
import { RocketOutlined } from '@ant-design/icons-vue'
import { useI18n } from '@/i18n/useI18n'
import { useRequestStore } from '@/stores/request'

const { t } = useI18n()
const reqStore = useRequestStore()

const STORAGE_KEY = 'mp2:onboarded'
const EXAMPLE_URL = 'https://jsonplaceholder.typicode.com/users/1'

const open = ref(readInitial())

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1'
  } catch {
    return false
  }
}

function dismiss() {
  open.value = false
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // localStorage may be unavailable in private mode; the worst case
    // is the user sees the modal twice — acceptable.
  }
}

// Fill the example URL into the current draft and focus the URL bar; the
// user makes the final, deliberate click on Send.
async function tryExample() {
  dismiss()
  reqStore.setUrl(EXAMPLE_URL)
  await nextTick()
  const input = document.querySelector<HTMLInputElement>(
    'input[placeholder*="api.example.com"], input[placeholder*="路径"], input[placeholder*="url" i]'
  )
  input?.focus()
  input?.select()
}
</script>

<template>
  <Modal
    :open="open"
    :title="t.onboardingTitle"
    :footer="null"
    :closable="false"
    :mask-closable="false"
    width="min(480px, 92vw)"
    centered
  >
    <div class="onboarding">
      <div class="onboarding-hero">
        <RocketOutlined class="onboarding-icon" />
        <p class="onboarding-body">{{ t.onboardingBody }}</p>
      </div>
      <div class="onboarding-actions">
        <Button class="onboarding-skip" @click="dismiss">{{ t.skip }}</Button>
        <Button type="primary" @click="tryExample">{{ t.tryExample }}</Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.onboarding {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

.onboarding-hero {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.onboarding-icon {
  font-size: 24px;
  color: var(--accent);
  margin-top: 2px;
  flex-shrink: 0;
}

.onboarding-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
}

.onboarding-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.onboarding-skip {
  border: none;
  color: var(--text-tertiary);
}
</style>
