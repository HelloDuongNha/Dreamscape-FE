<template>
  <Teleport to="body">
    <div v-if="modelValue" class="oracle-connection-backdrop" @mousedown.self="close">
      <section class="oracle-connection-modal" role="dialog" aria-modal="true" :aria-label="t('oracle.modelConnections')">
        <header>
          <div>
            <h2>{{ t('oracle.modelConnections') }}</h2>
            <p>{{ t('oracle.modelConnectionsDescription') }}</p>
          </div>
          <button type="button" :aria-label="t('oracle.close')" @click="close">×</button>
        </header>

        <div v-if="credentials.length" class="oracle-connection-list">
          <article v-for="item in credentials" :key="item._id">
            <div>
              <strong>{{ item.label }}</strong>
              <span>{{ providerLabel(item.provider) }} · {{ item.modelName }}</span>
              <small>{{ item.keyHint || item.baseUrl }}</small>
            </div>
            <span :class="['oracle-connection-status', `oracle-connection-status--${item.status}`]">
              {{ statusLabel(item.status) }}
            </span>
            <div class="oracle-connection-actions">
              <button type="button" :disabled="busyId === item._id" @click="test(item._id)">
                {{ t('oracle.testConnection') }}
              </button>
              <button
                v-if="!item.active"
                type="button"
                :disabled="item.status !== 'active' || busyId === item._id"
                @click="activate(item._id)"
              >
                {{ t('oracle.useConnection') }}
              </button>
              <span v-else>{{ t('oracle.connectionInUse') }}</span>
              <button type="button" class="danger" :disabled="busyId === item._id" @click="remove(item._id)">
                {{ t('oracle.delete') }}
              </button>
            </div>
          </article>
        </div>

        <form @submit.prevent="save">
          <div class="oracle-connection-grid">
            <label>
              <span>{{ t('oracle.provider') }}</span>
              <select v-model="form.provider" @change="applyProviderDefaults">
                <option value="openai_compatible">{{ t('oracle.openAiCompatible') }}</option>
                <option value="ollama">{{ t('oracle.ollamaLocal') }}</option>
              </select>
            </label>
            <label>
              <span>{{ t('oracle.connectionName') }}</span>
              <input v-model="form.label" required maxlength="80" :placeholder="t('oracle.connectionNamePlaceholder')" />
            </label>
          </div>
          <label>
            <span>{{ t('oracle.endpointUrl') }}</span>
            <input v-model="form.baseUrl" required type="url" spellcheck="false" />
            <small v-if="form.provider === 'ollama'">{{ t('oracle.localEndpointNotice') }}</small>
          </label>
          <label>
            <span>{{ t('oracle.modelName') }}</span>
            <input v-model="form.modelName" required spellcheck="false" :placeholder="form.provider === 'ollama' ? 'qwen3.5:9b' : 'model-id'" />
          </label>
          <label v-if="form.provider === 'openai_compatible'">
            <span>{{ t('oracle.apiKey') }}</span>
            <span class="oracle-secret-field">
              <input
                v-model="form.apiKey"
                required
                :type="apiKeyVisible ? 'text' : 'password'"
                autocomplete="new-password"
                spellcheck="false"
                @input="detectProvider"
              />
              <button
                type="button"
                :aria-label="t(apiKeyVisible ? 'common.hidePassword' : 'common.showPassword')"
                :aria-pressed="apiKeyVisible"
                @click="apiKeyVisible = !apiKeyVisible"
              >
                <svg v-if="apiKeyVisible" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.2 9 5.2a14 14 0 0 1-2.1 2.6M6.2 6.2C4.2 7.5 3 9.2 3 9.2S6.5 16 12 16c1.3 0 2.5-.3 3.5-.7"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/>
                  <circle cx="12" cy="12" r="2.5"/>
                </svg>
              </button>
            </span>
            <small>{{ detectedHint }}</small>
          </label>
          <label class="oracle-connection-consent">
            <input v-model="form.privateContextAcknowledged" type="checkbox" />
            <span>{{ t('oracle.privateContextConsent') }}</span>
          </label>
          <p v-if="error" class="oracle-connection-error">{{ error }}</p>
          <footer>
            <AppButton type="button" variant="ghost" size="sm" @click="close">{{ t('oracle.cancel') }}</AppButton>
            <AppButton type="submit" variant="smart" size="sm" :disabled="saving || !canSave">
              {{ saving ? t('oracle.saving') : t('oracle.saveConnection') }}
            </AppButton>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getApiErrorMessage } from '@/utils/apiError'
import AppButton from '@/components/common/AppButton.vue'
import {
  activateOracleCredential,
  createOracleCredential,
  deleteOracleCredential,
  listOracleCredentials,
  testOracleCredential,
  type OracleCredentialDto,
} from '@/api/oracleApi'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()
const { t } = useI18n()
const credentials = ref<OracleCredentialDto[]>([])
const saving = ref(false)
const busyId = ref('')
const error = ref('')
const apiKeyVisible = ref(false)
const form = reactive({
  provider: 'openai_compatible' as OracleCredentialDto['provider'],
  label: '',
  baseUrl: 'https://api.openai.com/v1',
  modelName: '',
  apiKey: '',
  privateContextAcknowledged: false,
})
const detectedHint = computed(() => {
  if (!form.apiKey) return t('oracle.keyStoredEncrypted')
  if (/^sk-(?:proj-)?/u.test(form.apiKey)) return t('oracle.detectedOpenAi')
  return t('oracle.keyProviderUncertain')
})
const canSave = computed(() => Boolean(
  form.label.trim()
  && form.baseUrl.trim()
  && form.modelName.trim()
  && form.privateContextAcknowledged
  && (form.provider === 'ollama' || form.apiKey.trim()),
))

async function load() {
  try {
    credentials.value = await listOracleCredentials()
    error.value = ''
  } catch {
    error.value = t('oracle.connectionLoadFailed')
  }
}
function close() { emit('update:modelValue', false) }
function providerLabel(provider: OracleCredentialDto['provider']) {
  return provider === 'ollama' ? t('oracle.ollamaLocal') : t('oracle.openAiCompatible')
}
function statusLabel(status: OracleCredentialDto['status']) {
  if (status === 'active') return t('oracle.connectionAvailable')
  if (status === 'failed') return t('oracle.connectionFailed')
  return t('oracle.connectionUnchecked')
}
function applyProviderDefaults() {
  form.baseUrl = form.provider === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'
  if (form.provider === 'ollama') form.apiKey = ''
}
function detectProvider() {
  if (/^sk-(?:proj-)?/u.test(form.apiKey) && !form.label) form.label = 'OpenAI'
}
async function save() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  try {
    const created = await createOracleCredential({ ...form })
    credentials.value.unshift(created)
    form.apiKey = ''
    apiKeyVisible.value = false
    form.label = ''
    form.modelName = ''
    form.privateContextAcknowledged = false
  } catch (cause: unknown) {
    error.value = getApiErrorMessage(cause, t('oracle.connectionSaveFailed'))
  } finally {
    saving.value = false
  }
}
async function test(id: string) {
  busyId.value = id
  try {
    const updated = await testOracleCredential(id)
    credentials.value = credentials.value.map((item) => item._id === id ? updated : item)
  } finally { busyId.value = '' }
}
async function activate(id: string) {
  busyId.value = id
  try {
    const updated = await activateOracleCredential(id)
    credentials.value = credentials.value.map((item) => ({
      ...item,
      active: item._id === id ? updated.active : false,
    }))
  } finally { busyId.value = '' }
}
async function remove(id: string) {
  busyId.value = id
  try {
    await deleteOracleCredential(id)
    credentials.value = credentials.value.filter((item) => item._id !== id)
  } finally { busyId.value = '' }
}

watch(() => props.modelValue, (open) => { if (open) void load() })
onMounted(() => { if (props.modelValue) void load() })
</script>

<style scoped>
.oracle-connection-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.68);backdrop-filter:blur(8px)}
.oracle-connection-modal{width:min(680px,100%);max-height:min(760px,90vh);overflow:auto;border:1px solid var(--color-border);border-radius:18px;background:var(--color-bg-elevated);box-shadow:0 24px 80px rgba(0,0,0,.45);color:var(--color-text-primary)}
.oracle-connection-modal>header{display:flex;justify-content:space-between;gap:20px;padding:20px 22px;border-bottom:1px solid var(--color-border)}
.oracle-connection-modal h2{margin:0 0 5px;font-size:18px}.oracle-connection-modal p{margin:0;color:var(--color-text-muted);font-size:12px}.oracle-connection-modal>header button{border:0;background:transparent;color:var(--color-text-muted);font-size:24px;cursor:pointer}
.oracle-connection-list{display:grid;gap:8px;padding:16px 22px 0}.oracle-connection-list article{display:grid;grid-template-columns:1fr auto;gap:8px 14px;padding:12px;border:1px solid var(--color-border);border-radius:12px}.oracle-connection-list article>div:first-child{display:grid;gap:3px}.oracle-connection-list span,.oracle-connection-list small{color:var(--color-text-muted);font-size:11px}.oracle-connection-status--active{color:#54d98c!important}.oracle-connection-status--failed{color:#ff7b7b!important}.oracle-connection-actions{grid-column:1/-1;display:flex;align-items:center;gap:8px}.oracle-connection-actions button{padding:5px 9px;border:1px solid var(--color-border);border-radius:7px;background:transparent;color:var(--color-text-secondary);cursor:pointer}.oracle-connection-actions .danger{margin-left:auto;color:#ff8585}
.oracle-connection-modal form{display:grid;gap:13px;padding:20px 22px}.oracle-connection-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.oracle-connection-modal label{display:grid;gap:6px;color:var(--color-text-secondary);font-size:12px}.oracle-connection-modal input,.oracle-connection-modal select{width:100%;padding:10px 11px;border:1px solid var(--color-border-input);border-radius:9px;background:var(--color-bg-surface);color:var(--color-text-primary);outline:none}.oracle-connection-modal small{color:var(--color-text-muted)}.oracle-connection-consent{grid-template-columns:auto 1fr!important;align-items:start}.oracle-connection-consent input{width:auto;margin-top:2px}.oracle-connection-error{color:#ff8585!important}.oracle-connection-modal form footer{display:flex;justify-content:flex-end;gap:8px;margin-top:5px}@media(max-width:600px){.oracle-connection-grid{grid-template-columns:1fr}}
.oracle-secret-field{position:relative;display:block}.oracle-secret-field input{padding-right:44px}.oracle-secret-field button{position:absolute;top:50%;right:5px;display:grid;place-items:center;width:34px;height:34px;padding:0;transform:translateY(-50%);border:0;border-radius:7px;background:transparent;color:var(--color-text-muted);cursor:pointer}.oracle-secret-field button:hover,.oracle-secret-field button:focus-visible{background:var(--color-bg-hover);color:var(--color-text-primary);outline:none}.oracle-secret-field svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
</style>
