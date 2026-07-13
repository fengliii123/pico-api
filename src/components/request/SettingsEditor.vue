<script setup lang="ts">
import { computed } from 'vue'
import { InputNumber, Switch, Divider } from 'ant-design-vue'
import type { RequestSettings } from '@/core/types'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()
const props = defineProps<{
  modelValue: RequestSettings
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: RequestSettings): void
}>()

const settings = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

function update<K extends keyof RequestSettings>(key: K, value: RequestSettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function onTimeoutChange(value: any) {
  update('timeout', Number(value) || 0)
}

function onFollowRedirectsChange(checked: any) {
  update('followRedirects', Boolean(checked))
}

function onMaxResponseSizeChange(value: any) {
  update('maxResponseSize', Number(value) || 0)
}
</script>

<template>
  <div class="settings-editor">
    <div class="settings-section">
      <h3 class="section-title">{{ t.requestTimeout }}</h3>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{{ t.timeoutMs }}</span>
          <span class="setting-hint">{{ t.timeoutHint }}</span>
        </div>
        <InputNumber
          :value="settings.timeout"
          :min="0"
          :max="300000"
          :step="1000"
          style="width: 120px"
          @change="onTimeoutChange"
        />
      </div>
    </div>

    <Divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t.redirects }}</h3>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{{ t.followRedirects }}</span>
          <span class="setting-hint">{{ t.followRedirectsHint }}</span>
        </div>
        <Switch
          :checked="settings.followRedirects"
          @change="onFollowRedirectsChange"
        />
      </div>
    </div>

    <Divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t.maxResponseSize }}</h3>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{{ t.maxResponseSizeMb }}</span>
          <span class="setting-hint">{{ t.maxResponseSizeHint }}</span>
        </div>
        <InputNumber
          :value="settings.maxResponseSize"
          :min="0"
          :max="1024"
          :step="10"
          style="width: 120px"
          @change="onMaxResponseSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-editor {
  padding: var(--space-6);
}

.settings-section {
  margin-bottom: var(--space-4);
}

.section-title {
  margin: 0 0 var(--space-6);
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) 0;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.setting-label {
  font-size: var(--fs-base);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

.setting-hint {
  font-size: var(--fs-sm);
  color: var(--text-tertiary);
}
</style>
