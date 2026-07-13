<script setup lang="ts">
// One-shot onboarding modal shown the first time the user opens the app.
// We mark "seen" in localStorage so it never re-appears on subsequent
// visits — Settings → Export All Data is the real recovery path, this is
// just a hello wave.

import { ref } from 'vue'
import { Modal, Button } from 'ant-design-vue'
import { RocketOutlined } from '@ant-design/icons-vue'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()

const STORAGE_KEY = 'mp2:onboarded'

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
</script>

<template>
  <Modal
    :open="open"
    :title="t.onboardingTitle"
    :footer="null"
    :closable="false"
    :mask-closable="false"
    width="480px"
    centered
  >
    <div class="onboarding">
      <div class="onboarding-hero">
        <RocketOutlined class="onboarding-icon" />
        <p class="onboarding-body">{{ t.onboardingBody }}</p>
      </div>
      <div class="onboarding-actions">
        <Button type="primary" @click="dismiss">{{ t.gotIt }}</Button>
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
}
</style>