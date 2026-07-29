<template>
  <div class="composer">
    <UserAvatar
      v-if="user"
      :user="user"
      size="md"
      show-streak
      class="composer__avatar"
    />

    <div class="composer__body">
      <textarea
        id="composer-textarea"
        v-model="text"
        class="composer__textarea"
        :placeholder="t('home.composerPlaceholder')"
        rows="3"
        :aria-label="t('home.composerAria')"
        translate="no"
      />

      <div class="composer__footer">
        <div class="composer__options">
          <button
            id="visibility-toggle-btn"
            class="composer__visibility"
            :class="{ 'composer__visibility--private': !isPublic }"
            :aria-pressed="isPublic"
            :aria-label="isPublic ? t('home.visibilityPublicAria') : t('home.visibilityPrivateAria')"
            @click="isPublic = !isPublic"
          >
            <svg v-if="isPublic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {{ isPublic ? t('home.public') : t('home.private') }}
          </button>

          <AppSwitch
            v-model="aiAnalysisEnabled"
            :label="t('home.aiAnalysis')"
            :aria-label="t('home.aiAnalysisSwitchAria')"
          />
        </div>

        <AppButton
          id="post-dream-btn"
          size="sm"
          variant="primary"
          :disabled="text.trim().length === 0 || posting"
          @click="emit('submit')"
        >
          {{ posting ? t('home.posting') : t('home.post') }}
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ApiUser } from '@/api/types'
import AppButton from '@/components/common/AppButton.vue'
import AppSwitch from '@/components/common/AppSwitch.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'

defineProps<{
  user?: ApiUser | null
  posting: boolean
}>()

const emit = defineEmits<{
  submit: []
}>()

const text = defineModel<string>('text', { required: true })
const isPublic = defineModel<boolean>('public', { required: true })
const aiAnalysisEnabled = defineModel<boolean>('aiAnalysis', { required: true })
const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
.composer {
  display: flex;
  width: calc(100% + 48px);
  gap: var(--space-3);
  margin-left: -48px;
  padding: var(--space-4) 0 var(--space-3);
}

.composer__avatar {
  flex-shrink: 0;
  margin-top: 2px;
}

.composer__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2);
}

.composer__textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  resize: none;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-lg);
  color: var(--color-text-primary);
  background: var(--color-bg-elevated);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
  transition: border-color var(--transition-fast);
}

.composer__textarea::placeholder {
  color: var(--color-text-muted);
}

.composer__textarea:focus {
  border-color: #4a4a4a;
  outline: none;
}

.composer__footer,
.composer__options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.composer__footer {
  justify-content: space-between;
  gap: var(--space-4);
}

.composer__options {
  justify-content: flex-start;
  gap: var(--space-3);
}

.composer__visibility {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.composer__visibility:hover {
  border-color: #3a3a3a;
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

.composer__visibility--private {
  border-color: #3a3a3a;
  color: var(--color-text-secondary);
}

@media (max-width: 760px) {
  .composer {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 600px) {
  .composer {
    gap: 10px;
    padding-top: 12px;
  }

  .composer__avatar {
    margin-top: 4px;
    transform: scale(.9);
    transform-origin: top left;
  }

  .composer__textarea {
    min-height: 92px;
    padding: 11px 12px;
    border-radius: 12px;
    font-size: 16px;
  }

  .composer__footer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: end;
  }

  .composer__options {
    gap: 8px;
  }

  .composer__visibility {
    min-height: 32px;
    padding: 4px 9px;
    font-size: var(--font-size-xs);
  }
}

@media (max-width: 360px) {
  .composer {
    gap: 8px;
  }

  .composer__footer {
    grid-template-columns: 1fr;
  }

  .composer__footer :deep(.app-button) {
    justify-self: end;
  }
}
</style>
