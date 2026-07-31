<template>
  <div class="evidence-page">
    <div v-if="isUnauthorized" class="empty-state">
      <AppIcon name="lock" :size="34" />
      <h3>{{ t('library.moderation.unauthorizedTitle') }}</h3>
      <p>{{ t('library.moderation.unauthorizedDesc') }}</p>
    </div>

    <main v-else class="evidence-workspace">
      <header class="workspace-header">
        <h2>{{ t('oracle.evidencePageTitle') }}</h2>
        <p>{{ t('oracle.evidencePageDescription') }}</p>
      </header>

      <nav class="status-tabs" :aria-label="t('oracle.evidenceStatus')">
        <button
          v-for="tab in tabs"
          :key="tab.status"
          type="button"
          :class="{ active: evidenceStatus === tab.status }"
          @click="changeStatus(tab.status)"
        >
          {{ t(tab.labelKey) }}
        </button>
      </nav>

      <div v-if="isLoading" class="loading-state">
        <span class="spinner" />
        <p>{{ t('oracle.evidenceLoading') }}</p>
      </div>

      <template v-else>
        <div v-if="evidenceStatus === 'active' && evidenceGaps.length" class="evidence-actions">
          <AppCopyButton
            :text="visibleResearchPrompts"
            :resolve-text="loadAllResearchPrompts"
            :label="t('oracle.evidenceCopyAll')"
            :copied-label="t('oracle.evidenceCopiedShort')"
            :success-message="t('oracle.evidenceCopiedAll', { count: pagination.total })"
            :error-message="t('oracle.evidenceCopyFailed')"
            show-label
          />
        </div>

        <div v-if="evidenceGaps.length === 0" class="empty-state">
          <AppIcon name="check" :size="28" />
          <h3>{{ t('oracle.evidenceEmptyTitle') }}</h3>
          <p>{{ t('oracle.evidenceEmptyDescription') }}</p>
        </div>

        <div v-else class="evidence-list">
          <article v-for="gap in evidenceGaps" :key="gap._id" class="evidence-card">
            <header class="evidence-card__header">
              <div>
                <span :class="['status-badge', `status-badge--${gap.status}`]">
                  {{ evidenceStatusLabel(gap.status) }}
                </span>
                <h3>{{ localizedClaim(gap) }}</h3>
              </div>

              <div v-if="gap.status !== 'resolved'" class="card-tools">
                <AppCopyButton
                  :text="researchPrompt(gap)"
                  :label="t('oracle.evidenceCopyOne')"
                  :copied-label="t('oracle.evidenceCopiedShort')"
                  :success-message="t('oracle.evidenceCopied')"
                  :error-message="t('oracle.evidenceCopyFailed')"
                />
                <button
                  type="button"
                  class="help-button"
                  :aria-expanded="helpGapId === gap._id"
                  :aria-label="t('oracle.evidencePromptHelpTitle')"
                  @click="toggleHelp(gap._id)"
                >
                  ?
                </button>
                <div v-if="helpGapId === gap._id" class="help-popover" role="tooltip">
                  <strong>{{ t('oracle.evidencePromptHelpTitle') }}</strong>
                  <p>{{ t('oracle.evidencePromptHelp') }}</p>
                </div>
              </div>
            </header>

            <section v-if="gap.status !== 'resolved'">
              <h4>{{ t('oracle.evidenceMeaning') }}</h4>
              <p>{{ t('oracle.evidenceMeaningText', { claim: localizedClaim(gap) }) }}</p>
            </section>

            <section v-if="gap.resolvedRules.length">
              <h4>{{ t('oracle.evidenceResolvedBy') }}</h4>
              <div v-for="rule in gap.resolvedRules" :key="rule._id" class="rule-row">
                <strong>{{ rule.ruleCode }}</strong>
                <span>{{ rule.statement }}</span>
                <small>{{ t('oracle.evidenceMatchedExcerpt') }}</small>
              </div>

              <button
                v-for="source in gap.resolvedSources"
                :key="source.sourceId"
                type="button"
                class="source-link"
                @click="openSource(source.sourceId)"
              >
                <span>
                  <strong>
                    {{ source.title }}
                    <small v-if="source.year">({{ source.year }})</small>
                  </strong>
                  <q>{{ source.excerpt }}</q>
                </span>
                <small>{{ t('oracle.evidenceInspectLinkedSource') }}</small>
              </button>
            </section>

            <details v-if="gap.usageExcerpts.length" class="usage-details">
              <summary>
                {{
                  t(
                    gap.status === 'resolved'
                      ? 'oracle.evidenceUsageTitle'
                      : 'oracle.evidencePendingUsageTitle',
                    { count: gap.usageExcerpts.length },
                  )
                }}
              </summary>
              <p>{{ t('oracle.evidenceUsagePrivacy') }}</p>
              <div class="usage-list">
                <article
                  v-for="(usage, index) in gap.usageExcerpts"
                  :key="`${usage.surfaceType}-${usage.citationIndex ?? 'pending'}-${index}`"
                >
                  <header>
                    <span>
                      {{
                        usage.surfaceType === 'oracle'
                          ? t('oracle.evidenceUsageOracle')
                          : t('oracle.evidenceUsageDream')
                      }}
                    </span>
                    <strong>[{{ usage.citationIndex ?? '?' }}]</strong>
                  </header>
                  <blockquote>{{ usage.excerpt }}</blockquote>
                </article>
              </div>
            </details>

            <details v-if="gap.status !== 'resolved'" class="prompt-preview">
              <summary>{{ t('oracle.evidenceViewPrompt') }}</summary>
              <div class="prompt-languages" :aria-label="t('oracle.evidencePromptLanguage')">
                <button
                  type="button"
                  :class="{ active: promptLanguage === 'vi' }"
                  @click.prevent="promptLanguage = 'vi'"
                >
                  {{ t('oracle.evidencePromptVietnamese') }}
                </button>
                <button
                  type="button"
                  :class="{ active: promptLanguage === 'en' }"
                  @click.prevent="promptLanguage = 'en'"
                >
                  {{ t('oracle.evidencePromptEnglish') }}
                </button>
              </div>
              <pre>{{ researchPrompt(gap) }}</pre>
            </details>
          </article>
        </div>

        <footer v-if="pagination.pages > 1" class="pagination">
          <button
            type="button"
            :disabled="pagination.page === 1"
            @click="changePage(pagination.page - 1)"
          >
            {{ t('library.moderation.pagination.previous') }}
          </button>
          <span>
            {{
              t('library.moderation.pagination.summary', {
                page: pagination.page,
                pages: pagination.pages,
                total: pagination.total,
                unit: t('library.moderation.pagination.unitGaps'),
              })
            }}
          </span>
          <button
            type="button"
            :disabled="pagination.page === pagination.pages"
            @click="changePage(pagination.page + 1)"
          >
            {{ t('library.moderation.pagination.next') }}
          </button>
        </footer>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { getOracleEvidenceGaps, type OracleEvidenceGapItem } from '@/api/moderationApi'
import AppCopyButton from '@/components/common/AppCopyButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { useSettingsStore } from '@/store/useSettingsStore'
import { getApiErrorStatus } from '@/utils/apiError'
import {
  buildEvidenceResearchPrompt,
  type EvidenceResearchLanguage,
} from './services/evidenceResearchPrompt.service'

type EvidenceStatus = 'active' | 'resolved'

const PAGE_SIZE = 20
const tabs: Array<{ status: EvidenceStatus; labelKey: string }> = [
  { status: 'active', labelKey: 'oracle.evidenceNeededTab' },
  { status: 'resolved', labelKey: 'oracle.evidenceAddedTab' },
]

const { locale, t } = useI18n()
const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()

const isUnauthorized = ref(false)
const isLoading = ref(false)
const evidenceStatus = ref<EvidenceStatus>('active')
const evidenceGaps = ref<OracleEvidenceGapItem[]>([])
const promptLanguage = ref<EvidenceResearchLanguage>(localeLanguage())
const helpGapId = ref<string | null>(null)
const pagination = ref({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 })

const visibleResearchPrompts = computed(() =>
  formatResearchPrompts(evidenceGaps.value.filter(gap => gap.status !== 'resolved')),
)

// Load one evidence status using the existing moderation API.
async function fetchEvidenceGaps(): Promise<void> {
  isLoading.value = true
  try {
    const result = await getOracleEvidenceGaps({
      status: evidenceStatus.value,
      page: pagination.value.page,
      limit: PAGE_SIZE,
    })
    evidenceGaps.value = result.gaps
    pagination.value = result.pagination
  } catch (error: unknown) {
    if (getApiErrorStatus(error) === 403) {
      isUnauthorized.value = true
      return
    }
    console.error('Failed to load evidence needs:', error)
    settingsStore.showToast(t('library.moderation.toast.evidenceLoadError'), 'error')
  } finally {
    isLoading.value = false
  }
}

// Keep the selected tab and page restorable through browser history.
async function persistView(): Promise<void> {
  await router.replace({
    query: {
      status: evidenceStatus.value === 'resolved' ? 'added' : 'needed',
      page: String(pagination.value.page),
    },
  })
}

async function changeStatus(status: EvidenceStatus): Promise<void> {
  if (evidenceStatus.value === status) return
  evidenceStatus.value = status
  pagination.value.page = 1
  helpGapId.value = null
  await persistView()
  await fetchEvidenceGaps()
}

async function changePage(page: number): Promise<void> {
  pagination.value.page = page
  await persistView()
  await fetchEvidenceGaps()
}

function localizedClaim(gap: OracleEvidenceGapItem): string {
  const language = localeLanguage()
  return gap.localizedClaims?.[language] || gap.claim
}

function evidenceStatusLabel(status: OracleEvidenceGapItem['status']): string {
  if (status === 'resolved') return t('oracle.evidenceResolved')
  if (status === 'candidate_found') return t('oracle.evidenceCandidateFound')
  return t('oracle.evidenceNeedsSource')
}

function researchPrompt(gap: OracleEvidenceGapItem): string {
  return buildEvidenceResearchPrompt(gap, promptLanguage.value)
}

// Format the current evidence needs into one copyable research brief.
function formatResearchPrompts(gaps: OracleEvidenceGapItem[]): string {
  return gaps
    .map((gap, index) =>
      `${t('oracle.evidencePromptNumber', { number: index + 1 })}\n${researchPrompt(gap)}`,
    )
    .join('\n\n---\n\n')
}

// Fetch every unresolved page before the administrator copies all prompts.
async function loadAllResearchPrompts(): Promise<string> {
  const gaps: OracleEvidenceGapItem[] = []
  const limit = 50
  let page = 1
  let pages = 1

  do {
    const result = await getOracleEvidenceGaps({ status: 'active', page, limit })
    gaps.push(...result.gaps)
    pages = Math.max(1, result.pagination.pages)
    page += 1
  } while (page <= pages)

  return formatResearchPrompts(gaps.filter(gap => gap.status !== 'resolved'))
}

function toggleHelp(gapId: string): void {
  helpGapId.value = helpGapId.value === gapId ? null : gapId
}

function openSource(sourceId: string): void {
  router.push(`/library/sources/${sourceId}`)
}

function localeLanguage(): EvidenceResearchLanguage {
  return String(locale.value).startsWith('en') ? 'en' : 'vi'
}

watch(locale, () => {
  promptLanguage.value = localeLanguage()
})

// Restore the selected tab and page before loading the first result set.
onMounted(() => {
  evidenceStatus.value = route.query.status === 'added' ? 'resolved' : 'active'
  const requestedPage = Number(route.query.page)
  if (Number.isInteger(requestedPage) && requestedPage > 0) {
    pagination.value.page = requestedPage
  }
  fetchEvidenceGaps()
})
</script>

<style scoped>
.evidence-page {
  min-height: calc(100vh - var(--header-height) - var(--space-10));
  padding: var(--space-6);
}

.evidence-workspace {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}

.workspace-header {
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.workspace-header h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-xl);
}

.workspace-header p {
  margin: var(--space-2) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.status-tabs {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-6);
  overflow-x: auto;
  border-bottom: 1px solid var(--color-border);
}

.status-tabs button {
  margin-bottom: -1px;
  padding: var(--space-3) var(--space-4);
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.status-tabs button:hover {
  color: var(--color-text-secondary);
}

.status-tabs button.active {
  border-bottom-color: var(--color-text-primary);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

.evidence-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-4);
}

.evidence-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.evidence-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-left: 3px solid #f59e0b;
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface, #1e1e1e);
}

.evidence-card__header {
  display: flex;
  position: relative;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.evidence-card h3 {
  margin: var(--space-2) 0 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  line-height: var(--line-height-relaxed);
}

.evidence-card h4 {
  margin: 0 0 var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  letter-spacing: .035em;
  text-transform: uppercase;
}

.evidence-card p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.status-badge {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  color: #fbbf24;
  background: rgb(245 158 11 / 12%);
  font-size: 10px;
  font-weight: 700;
}

.status-badge--candidate_found {
  color: #60a5fa;
  background: rgb(59 130 246 / 12%);
}

.status-badge--resolved {
  color: #34d399;
  background: rgb(52 211 153 / 12%);
}

.card-tools {
  display: inline-flex;
  position: relative;
  align-items: center;
  gap: 4px;
}

.help-button {
  display: inline-grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-text-muted);
  background: transparent;
  cursor: help;
  font-size: 11px;
}

.help-popover {
  position: absolute;
  z-index: 5;
  top: calc(100% + 8px);
  right: 0;
  width: min(320px, 80vw);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-relaxed);
}

.help-popover strong {
  color: var(--color-text-primary);
}

.help-popover p {
  margin-top: var(--space-1);
  font-size: inherit;
}

.rule-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  font-size: var(--font-size-xs);
}

.rule-row small {
  color: var(--color-text-muted);
}

.source-link {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
  padding: var(--space-3);
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-elevated));
  cursor: pointer;
  text-align: left;
}

.source-link:hover {
  border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-elevated));
}

.source-link > span {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.source-link q {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-link small {
  color: var(--color-text-muted);
}

.usage-details,
.prompt-preview {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.usage-details > summary,
.prompt-preview > summary {
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 650;
}

.usage-details > p {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.usage-list {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.usage-list article {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}

.usage-list header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.usage-list header strong {
  color: var(--color-primary);
}

.usage-list blockquote {
  margin: var(--space-2) 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.prompt-preview {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.prompt-preview pre {
  overflow-x: auto;
  margin: var(--space-3) 0;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  background: var(--color-bg-base);
  font: inherit;
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
}

.prompt-languages {
  display: inline-flex;
  gap: 4px;
  margin-top: var(--space-3);
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}

.prompt-languages button {
  padding: 5px 9px;
  border: 0;
  border-radius: calc(var(--radius-md) - 2px);
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  font-size: 11px;
}

.prompt-languages button.active {
  color: var(--color-text-primary);
  background: var(--color-bg-active);
}

.loading-state,
.empty-state {
  display: flex;
  min-height: 220px;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12) var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  background: var(--color-bg-elevated);
  text-align: center;
}

.loading-state p,
.empty-state h3,
.empty-state p {
  margin: 0;
}

.empty-state h3 {
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
}

.empty-state p {
  max-width: 420px;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgb(255 255 255 / 15%);
  border-top-color: var(--color-text-primary);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.pagination button {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  cursor: pointer;
}

.pagination button:disabled {
  cursor: not-allowed;
  opacity: .45;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .evidence-page {
    min-height: 100%;
    padding: var(--space-3);
  }

  .workspace-header {
    margin-bottom: var(--space-3);
  }

  .status-tabs {
    margin-inline: calc(-1 * var(--space-3));
    margin-bottom: var(--space-4);
    padding-inline: var(--space-3);
    scrollbar-width: none;
  }

  .status-tabs::-webkit-scrollbar {
    display: none;
  }

  .status-tabs button {
    min-height: 44px;
  }

  .evidence-actions,
  .evidence-actions :deep(button) {
    width: 100%;
  }

  .evidence-card {
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .evidence-card__header {
    flex-direction: column;
  }

  .rule-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .rule-row > :first-child {
    grid-column: 1 / -1;
  }

  .help-popover {
    position: fixed;
    inset: auto 12px calc(var(--mobile-nav-height) + var(--safe-area-bottom) + 12px);
    width: auto;
  }

  .pagination {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .pagination span {
    grid-column: 1 / -1;
    grid-row: 1;
    text-align: center;
  }
}
</style>
