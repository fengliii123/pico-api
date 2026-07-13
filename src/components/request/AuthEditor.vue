<script setup lang="ts">
import { computed } from 'vue'
import { Select, Input, Radio } from 'ant-design-vue'
import type { AuthConfig, AuthType } from '@/core/types'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()
const props = defineProps<{
  modelValue: AuthConfig
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: AuthConfig): void
}>()

const authType = computed({
  get: () => props.modelValue.type,
  set: (type: AuthType) => {
    let next: AuthConfig
    if (type === 'apikey') {
      next = { type, addTo: 'header', key: '', value: '' }
    } else if (type === 'bearer') {
      next = { type, token: '' }
    } else if (type === 'basic') {
      next = { type, username: '', password: '' }
    } else {
      next = { type }
    }
    emit('update:modelValue', next)
  }
})

function onAuthTypeChange(value: any) {
  authType.value = String(value ?? 'none') as AuthType
}

const authOptions = computed(() => [
  { value: 'none', label: t.value.authNoAuth },
  { value: 'apikey', label: t.value.authApiKey },
  { value: 'bearer', label: t.value.authBearerToken },
  { value: 'basic', label: t.value.authBasicAuth }
])

const apikey = computed(() => props.modelValue.type === 'apikey' ? props.modelValue : null)
const bearer = computed(() => props.modelValue.type === 'bearer' ? props.modelValue : null)
const basic = computed(() => props.modelValue.type === 'basic' ? props.modelValue : null)

function updateApikey(key: string, value: string, addTo?: 'header' | 'query', prefix?: string) {
  emit('update:modelValue', { type: 'apikey', key, value, addTo: addTo ?? 'header', prefix })
}

function updateBearer(token: string, prefix?: string) {
  emit('update:modelValue', { type: 'bearer', token, prefix })
}

function updateBasic(username: string, password: string) {
  emit('update:modelValue', { type: 'basic', username, password })
}
</script>

<template>
  <div class="auth-editor">
    <div class="auth-type-row">
      <label class="auth-label">{{ t.authTypeLabel }}</label>
      <Select
        :value="authType"
        :options="authOptions"
        class="auth-type-select"
        @change="onAuthTypeChange"
      />
    </div>

    <div v-if="authType === 'none'" class="auth-hint">
      <p>{{ t.authNoAuthorizationHint }}</p>
    </div>

    <div v-else-if="authType === 'apikey'" class="auth-form">
      <div class="auth-field">
        <label class="auth-field-label">{{ t.authAddTo }}</label>
        <Radio.Group
          :value="apikey?.addTo ?? 'header'"
          @change="(e: any) => updateApikey(apikey?.key ?? '', apikey?.value ?? '', e.target.value, apikey?.prefix)"
        >
          <Radio.Button value="header">{{ t.authHeader }}</Radio.Button>
          <Radio.Button value="query">{{ t.authQueryParams }}</Radio.Button>
        </Radio.Group>
      </div>
      <div class="auth-field">
        <label class="auth-field-label">{{ t.key }}</label>
        <Input
          :value="apikey?.key ?? ''"
          placeholder="X-API-Key"
          @update:value="(v: string) => updateApikey(v, apikey?.value ?? '', apikey?.addTo, apikey?.prefix)"
        />
      </div>
      <div class="auth-field">
        <label class="auth-field-label">{{ t.value }}</label>
        <Input
          :value="apikey?.value ?? ''"
          placeholder="your-api-key"
          @update:value="(v: string) => updateApikey(apikey?.key ?? '', v, apikey?.addTo, apikey?.prefix)"
        />
      </div>
      <div class="auth-field">
        <label class="auth-field-label">{{ t.authPrefix }} <span class="auth-optional">{{ t.authPrefixOptional }}</span></label>
        <Input
          :value="apikey?.prefix ?? ''"
          placeholder="e.g. Token for Bearer, leave empty for none"
          @update:value="(v: string) => updateApikey(apikey?.key ?? '', apikey?.value ?? '', apikey?.addTo, v)"
        />
      </div>
    </div>

    <div v-else-if="authType === 'bearer'" class="auth-form">
      <div class="auth-field">
        <label class="auth-field-label">{{ t.authToken }}</label>
        <Input
          :value="bearer?.token ?? ''"
          placeholder="your-bearer-token"
          @update:value="(v: string) => updateBearer(v, bearer?.prefix)"
        />
      </div>
      <div class="auth-field">
        <label class="auth-field-label">{{ t.authPrefix }} <span class="auth-optional">{{ t.authPrefixOptional }}</span></label>
        <Input
          :value="bearer?.prefix ?? ''"
          placeholder="Bearer (default)"
          @update:value="(v: string) => updateBearer(bearer?.token ?? '', v)"
        />
      </div>
      <p class="auth-hint-inline">{{ t.authTokenSentAs }} <code>Authorization: {{ bearer?.prefix || 'Bearer' }} &#123;&#123;token&#125;&#125;</code></p>
    </div>

    <div v-else-if="authType === 'basic'" class="auth-form">
      <div class="auth-field">
        <label class="auth-field-label">{{ t.authUsername }}</label>
        <Input
          :value="basic?.username ?? ''"
          placeholder="username"
          @update:value="(v: string) => updateBasic(v, basic?.password ?? '')"
        />
      </div>
      <div class="auth-field">
        <label class="auth-field-label">{{ t.authPassword }}</label>
        <Input.Password
          :value="basic?.password ?? ''"
          placeholder="password"
          @update:value="(v: string) => updateBasic(basic?.username ?? '', v)"
        />
      </div>
      <p class="auth-hint-inline">{{ t.authBasicSentAs }} <code>Authorization: Basic &#123;base64(username:password)&#125;</code></p>
    </div>
  </div>
</template>

<style scoped>
.auth-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.auth-type-row {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.auth-label {
  font-size: var(--fs-base);
  font-weight: var(--fw-medium);
  color: var(--text-secondary);
  flex: 0 0 auto;
}

.auth-type-select {
  width: 200px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--bg-subtle);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-base);
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.auth-field-label {
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: var(--text-secondary);
}

.auth-optional {
  font-weight: var(--fw-regular);
  color: var(--text-tertiary);
}

.auth-hint {
  padding: var(--space-6);
  background: var(--bg-subtle);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  font-size: var(--fs-base);
}

.auth-hint p {
  margin: 0;
}

.auth-hint-inline {
  margin: var(--space-2) 0 0;
  font-size: var(--fs-sm);
  color: var(--text-tertiary);
}

.auth-hint-inline code {
  background: var(--bg-muted);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-base);
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: var(--fs-xs);
}
</style>
