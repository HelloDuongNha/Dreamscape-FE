<template>
  <div class="rule-review-page">
    <div v-if="isUnauthorized" class="empty-panel">
      <h3>{{ t('rules.accessDenied') }}</h3>
      <p>{{ t('rules.accessDeniedDescription') }}</p>
    </div>

    <template v-else>
      <header class="page-header">
        <div>
          <p class="eyebrow">{{ t('rules.eyebrow') }}</p>
          <h1>{{ t('rules.title') }}</h1>
          <p>{{ t('rules.subtitle') }}</p>
        </div>
        <div class="header-actions">
          <div v-if="activeStatus === 'pending' || activeStatus === 'rejected'" class="bulk-actions">
            <template v-if="activeStatus === 'pending'">
              <AppButton variant="danger-outline" @click="openBulkAction('reject_pending')">{{ t('rules.rejectAll') }}{{ sourceIdFilter ? t('rules.ofDocument') : '' }}</AppButton>
              <AppButton variant="smart" @click="openBulkAction('approve_pending')">{{ t('rules.approveAll') }}{{ sourceIdFilter ? t('rules.ofDocument') : '' }}</AppButton>
            </template>
            <template v-else>
              <AppButton variant="secondary" @click="openBulkAction('restore_rejected')">{{ t('rules.restoreAll') }}{{ sourceIdFilter ? t('rules.ofDocument') : '' }}</AppButton>
              <AppButton variant="danger-outline" @click="openBulkAction('delete_rejected')">{{ t('rules.deleteAll') }}{{ sourceIdFilter ? t('rules.ofDocument') : '' }}</AppButton>
            </template>
          </div>
          <div class="header-count">
            <strong>{{ candidates.length }}</strong>
            <span>{{ activeTabLabel.toLowerCase() }}</span>
          </div>
        </div>
      </header>

      <div v-if="sourceIdFilter" class="source-filter">
        <span>{{ t('rules.sourceFilter') }}</span>
        <button type="button" @click="clearSourceFilter">{{ t('rules.clearFilter') }}</button>
      </div>

      <nav class="status-tabs" :aria-label="t('rules.statusNavigation')">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          type="button"
          :class="{ active: activeStatus === tab.value }"
          @click="changeTab(tab.value)"
        >
          {{ tab.label }}
        </button>
      </nav>
      <div class="review-layout">
        <aside class="candidate-sidebar">
          <div v-if="isLoadingList" class="loading-state">
            <span class="spinner"></span>
            <span>{{ t('rules.loadingRules') }}</span>
          </div>
          <div v-else-if="candidates.length === 0" class="empty-panel compact">
            <h3>{{ t('rules.noData') }}</h3>
            <p>{{ sourceIdFilter ? t('rules.noRulesForSource') : t('rules.noRules') }}</p>
          </div>
          <div v-else class="candidate-list">
            <section v-for="(items, sourceTitle) in groupedCandidates" :key="sourceTitle" class="source-group" :style="sourceGroupStyle(String(sourceTitle))">
              <h2><span translate="no">{{ sourceTitle }}</span><small>{{ t('rules.ruleCount', { count: items.length }) }}</small></h2>
              <div class="source-rule-list">
                <button
                  v-for="candidate in items"
                  :key="candidate._id"
                  type="button"
                  :class="['candidate-card', { selected: selectedId === candidate._id }]"
                  @click="selectCandidate(candidate._id)"
                >
                  <span class="candidate-title">{{ ruleText(candidate, 'label', candidate.label) }}</span>
                  <span class="candidate-card-meta">
                    <span v-if="candidate.isComposite" class="composite-list-chip">{{ t('rules.compositeRule', { count: candidate.compositeComponents?.length || 0 }) }}</span>
                    <span :class="['status-chip', `status-${candidate.status}`]">{{ statusLabel(candidate.status) }}</span>
                    <span class="score-chip" :style="{ color: scoreColor(candidate.evidenceCredibilityScore) }">{{ candidate.evidenceCredibilityScore ?? 0 }}/100</span>
                    <span>{{ t('rules.evidenceGroupCount', { count: candidate.exactCitationCount ?? 0 }) }}</span>
                  </span>
                </button>
              </div>
            </section>
          </div>
        </aside>

        <main class="candidate-detail">
          <div v-if="isLoadingDetail" class="loading-state detail-loading">
            <span class="spinner"></span>
            <span>{{ t('rules.loadingDetail') }}</span>
          </div>
          <div v-else-if="!selectedCandidate" class="empty-panel detail-empty">
            <h3>{{ t('rules.selectRule') }}</h3>
            <p>{{ t('rules.selectRuleDescription') }}</p>
          </div>
          <article v-else class="rule-document">
            <section class="rule-hero">
              <div class="hero-topline">
                <span :class="['status-chip', `status-${selectedCandidate.status}`]">{{ statusLabel(selectedCandidate.status) }}</span>
                <span class="rule-code">{{ selectedCandidate.proposedRuleId }}</span>
              </div>
              <h2>{{ ruleText(selectedCandidate, 'label', selectedCandidate.label) }}</h2>
              <span v-if="selectedCandidate.isComposite" class="composite-badge">{{ t('rules.compositeRule', { count: selectedCandidate.compositeComponents?.length || 0 }) }}</span>
              <p class="source-line" translate="no">{{ formattedSource }}</p>
              <div v-if="selectedCandidate.qualityAccepted === false" class="quality-blocked">
                <strong>{{ t('rules.qualityFailed') }}</strong>
                <span>{{ ruleText(selectedCandidate, 'qualitySummary', selectedCandidate.qualitySummary || '') }}</span>
              </div>
            </section>

            <section class="content-card inference-card">
              <div class="section-heading">
                <div>
                  <h3>{{ t('rules.usableContent') }}</h3>
                  <p class="section-description">{{ t('rules.usableContentDescription') }}</p>
                </div>
              </div>
              <div v-if="selectedCandidate.isComposite" class="composite-claims">
                <article v-for="(component, index) in selectedCandidate.compositeComponents" :key="component.sourceRuleId" class="composite-claim">
                  <div class="composite-claim__header">
                    <strong>{{ t('rules.atomicClaim', { number: index + 1 }) }}</strong>
                    <span>
                      <span translate="no">{{ component.ruleCode }}</span><template v-if="component.evidenceScore !== undefined"> · {{ component.evidenceScore }}/100 · {{ t('rules.supportingEvidenceCount', { count: component.supportingCitationCount || 0 }) }}</template>
                    </span>
                  </div>
                  <div class="relationship-flow">
                    <div><span>{{ t('rules.factor') }}</span><strong>{{ ruleText(selectedCandidate, `component:${index}:subject`, component.subject) }}</strong></div>
                    <div class="relationship-arrow" aria-hidden="true">→</div>
                    <div><span>{{ t('rules.outcome') }}</span><strong>{{ ruleText(selectedCandidate, `component:${index}:outcome`, component.outcome) }}</strong></div>
                  </div>
                  <p class="rule-explanation">{{ localizedRuleExplanation(component.expandedExplanations, selectedCandidate, `component:${index}:explanation`, component.expandedExplanation || component.statement) }}</p>
                </article>
              </div>
              <div v-else class="relationship-flow">
                <div>
                  <span>{{ t('rules.factor') }}</span>
                  <strong>{{ selectedCandidate.factor ? ruleText(selectedCandidate, 'factor', selectedCandidate.factor) : t('rules.unknownValue') }}</strong>
                </div>
                <div class="relationship-arrow" aria-hidden="true">→</div>
                <div>
                  <span>{{ t('rules.outcome') }}</span>
                  <strong>{{ selectedCandidate.inputSource ? ruleText(selectedCandidate, 'outcome', selectedCandidate.inputSource) : t('rules.unknownValue') }}</strong>
                </div>
              </div>
              <p v-if="!selectedCandidate.isComposite && selectedCandidate.fullStatement" class="rule-explanation">{{ localizedRuleExplanation(selectedCandidate.expandedExplanations, selectedCandidate, 'explanation', selectedCandidate.expandedExplanation || selectedCandidate.fullStatement) }}</p>
              <ul class="rule-reading-guide">
                <li>
                  <strong>{{ t('rules.appliesOnlyWhen') }}</strong>
                  {{ reviewConditions.length ? punctuatedList(translatedRuleList(selectedCandidate, 'condition', reviewConditions), '; ') : t('rules.noSpecificContext') }}
                </li>
                <li>
                  <strong>{{ t('rules.dreamSignals') }}</strong>
                  {{ reviewDreamTags.length ? punctuatedList(translatedRuleList(selectedCandidate, 'dreamTag', reviewDreamTags), ', ') : t('rules.noDreamSignals') }}
                </li>
                <li>
                  <strong>{{ t('rules.limitations') }}</strong>
                  {{ reviewLimitations.length ? punctuatedList(translatedRuleList(selectedCandidate, 'limitation', reviewLimitations), '; ') : t('rules.noClearLimitations') }}
                </li>
              </ul>
            </section>

            <section class="assessment-grid">
              <div class="content-card assessment-card">
                <div class="score-header">
                  <div>
                    <h3 class="assessment-title">{{ t('rules.evidenceSupport') }}</h3>
                    <strong class="score-number" :style="{ color: scoreColor(selectedCandidate.evidenceCredibilityScore) }">{{ selectedCandidate.evidenceCredibilityScore ?? 0 }}/100</strong>
                  </div>
                  <span :class="['level-badge', scoreLevelClass(selectedCandidate.evidenceCredibilityScore)]">
                    {{ scoreLevelLabel(selectedCandidate.evidenceCredibilityScore) }}
                  </span>
                </div>
                <div class="score-track" role="progressbar" :aria-label="t('rules.evidenceSupportAria')" :aria-valuenow="selectedCandidate.evidenceCredibilityScore ?? 0" aria-valuemin="0" aria-valuemax="100">
                  <span :style="{ width: `${selectedCandidate.evidenceCredibilityScore ?? 0}%`, backgroundColor: scoreColor(selectedCandidate.evidenceCredibilityScore) }"></span>
                </div>
                <p class="score-conclusion">{{ evidenceScoreConclusion }}</p>
                <p class="score-note">{{ t('rules.scoreNote') }}</p>
                <dl v-if="selectedCandidate.validationStats" class="validation-stats">
                  <div><dt>{{ t('rules.validationSupports') }}</dt><dd>{{ selectedCandidate.validationStats.supports }}</dd></div>
                  <div><dt>{{ t('rules.validationWeakens') }}</dt><dd>{{ selectedCandidate.validationStats.weakens }}</dd></div>
                  <div><dt>{{ t('rules.validationUnsure') }}</dt><dd>{{ selectedCandidate.validationStats.unsure }}</dd></div>
                  <div>
                    <dt>{{ t('rules.validationAdjustment') }}</dt>
                    <dd :class="selectedCandidate.validationStats.netAdjustment >= 0 ? 'is-positive' : 'is-negative'">
                      {{ selectedCandidate.validationStats.netAdjustment > 0 ? '+' : '' }}{{ selectedCandidate.validationStats.netAdjustment }}
                    </dd>
                  </div>
                </dl>
                <p v-if="selectedCandidate.scoreAggregation" class="score-aggregation-note">
                  <strong>{{ selectedCandidate.scoreAggregation.method === 'pooled_equivalent_evidence' ? t('rules.pooledScoreMethod') : t('rules.compositeScoreMethod', { code: selectedCandidate.scoreAggregation.weakestRuleCode || '' }) }}</strong>
                  {{ selectedCandidate.scoreAggregation.method === 'pooled_equivalent_evidence' ? t('rules.pooledScoreExplanation') : t('rules.minimumScoreExplanation') }}
                </p>
                <dl class="criteria-list">
                  <div v-for="item in scoreCriteriaRows" :key="item.key" class="criterion-row">
                    <dt>
                      <span>{{ scoreCriterionLabel(item.key) }}</span>
                      <div class="criterion-help">
                        <button type="button" :aria-label="t('rules.criterionHelp')" @click.stop="toggleCriterionHelp(item.key)">?</button>
                        <div v-if="openCriterionKey === item.key" @click.stop>
                          <strong>{{ t('rules.scoreThreshold') }}</strong>
                          <ul><li v-for="line in rubricBullets(ruleText(selectedCandidate, `rubric:${item.key}`, item.rubric))" :key="line">{{ line }}</li></ul>
                          <strong>{{ t('rules.scoreReason', { score: item.score, maxScore: item.maxScore }) }}</strong>
                          <ul><li>{{ ruleText(selectedCandidate, `reason:${item.key}`, item.reason) }}</li></ul>
                        </div>
                      </div>
                    </dt>
                    <dd :style="{ color: scoreColor(item.maxScore ? item.score / item.maxScore * 100 : 0) }">{{ item.score }}/{{ item.maxScore }}</dd>
                  </div>
                </dl>
              </div>

            </section>

            <section v-if="resolvedEvidenceGapMatches.length" class="content-card evidence-gap-card">
              <div class="section-heading">
                <div>
                  <h3>{{ t('rules.evidenceGapMatches') }}</h3>
                  <p class="section-description">{{ t('rules.evidenceGapMatchesDescription') }}</p>
                </div>
                <span class="evidence-gap-count">{{ resolvedEvidenceGapMatches.length }}</span>
              </div>
              <div class="evidence-gap-list">
                <article v-for="match in resolvedEvidenceGapMatches" :key="match.gapId" class="evidence-gap-item">
                  <div class="evidence-gap-item__heading">
                    <span :class="['evidence-gap-state', {
                      'evidence-gap-state--resolved': match.resolvedByRule,
                      'evidence-gap-state--ready': !match.resolvedByRule && match.blockers.length === 0,
                    }]">
                      {{ evidenceGapStateLabel(match) }}
                    </span>
                    <span>{{ t('rules.evidenceGapOccurrences', { count: match.occurrenceCount }) }}</span>
                  </div>
                  <strong>{{ localizedEvidenceGapClaim(match) }}</strong>
                  <div class="evidence-gap-match-meter">
                    <span :style="{ width: `${Math.round(match.similarity * 100)}%` }"></span>
                  </div>
                  <p>{{ evidenceGapExplanation(match) }}</p>
                  <ul v-if="!match.resolvedByRule && match.blockers.length" class="evidence-gap-blockers">
                    <li v-for="blocker in match.blockers" :key="blocker">{{ evidenceGapBlockerLabel(blocker) }}</li>
                  </ul>
                </article>
              </div>
            </section>

            <section v-if="visibleRelationships.length" class="content-card relationship-card">
              <div class="section-heading">
                <div>
                  <h3>{{ t('rules.relationships') }}</h3>
                  <p class="section-description">{{ t('rules.relationshipsDescription') }}</p>
                </div>
              </div>
              <div class="relationship-group">
                <strong class="relationship-group__title">{{ t('rules.keepSeparateSection') }}</strong>
                <p>{{ t('rules.keepSeparateSectionDescription') }}</p>
                <button v-for="item in visibleRelationships" :key="item.ruleId" type="button" class="related-rule" @click="selectCandidate(item.ruleId)">
                  <span :class="['relation-kind', `relation-kind--${item.relationship}`]">{{ relationshipBadge(item) }}</span>
                  <span class="related-rule__content"><strong>{{ relatedRuleText(item) }}</strong><small>{{ relationshipWhyShown(item) }}</small><small>{{ ruleText(selectedCandidate, `related:${item.ruleId}:flow`, `${item.subject} → ${item.outcome}`) }}</small></span>
                  <small>{{ item.evidenceScore }}/100</small>
                </button>
              </div>
            </section>

            <section v-if="selectedCandidate.probeBlueprint" class="content-card probe-card">
              <div class="section-heading">
                <div>
                  <h3>{{ t('rules.probeTitle') }}</h3>
                  <p class="section-description">{{ t('rules.probeDescription') }}</p>
                </div>
              </div>
              <p v-if="selectedCandidate.probeBlueprint.checkable">{{ ruleText(selectedCandidate, 'probe:check', selectedCandidate.probeBlueprint.applicabilityCheck || '') }}</p>
              <p v-else>{{ ruleText(selectedCandidate, 'probe:explanation', selectedCandidate.probeBlueprint.explanation || '') }}</p>
              <div v-if="selectedCandidate.probeBlueprint.questionDimensions?.length" class="probe-question-list">
                <article v-for="(question, index) in selectedCandidate.probeBlueprint.questionDimensions" :key="`${question.type}:${index}`" class="probe-question-pattern">
                  <div class="probe-question-pattern__meta">
                    <strong>{{ t('rules.questionNumber', { number: index + 1 }) }}</strong>
                    <span>{{ questionTypeLabel(question.type) }}</span>
                    <span v-if="question.componentRuleCodes?.length">{{ t('rules.testsComponents', { codes: question.componentRuleCodes.join(', ') }) }}</span>
                  </div>
                  <p>{{ renderQuestionPattern(selectedCandidate, `probe:question:${index}`, question.questionPattern) }}</p>
                  <dl>
                    <div><dt>{{ t('rules.questionPurpose') }}</dt><dd>{{ ruleText(selectedCandidate, `probe:purpose:${index}`, question.purpose) }}</dd></div>
                    <div><dt>{{ t('rules.collectedData') }}</dt><dd>{{ collectedFieldLabel(question.collectedField) }}</dd></div>
                  </dl>
                </article>
              </div>
              <div v-if="selectedCandidate.probeBlueprint.requiredData" class="probe-question-pattern">
                <strong>{{ t('rules.requiredAggregateData') }}</strong>
                <p>{{ ruleText(selectedCandidate, 'probe:requiredData', selectedCandidate.probeBlueprint.requiredData) }}</p>
              </div>
              <div v-if="selectedCandidate.probeBlueprint.expectedPattern" class="probe-validation-contract">
                <div><strong>{{ t('rules.expectedPattern') }}</strong><p>{{ ruleText(selectedCandidate, 'probe:expectedPattern', selectedCandidate.probeBlueprint.expectedPattern) }}</p></div>
                <div v-if="selectedCandidate.probeBlueprint.supportCriterion" class="probe-validation-contract--supports"><strong>{{ t('rules.supportCriterion') }}</strong><p>{{ ruleText(selectedCandidate, 'probe:supportCriterion', selectedCandidate.probeBlueprint.supportCriterion) }}</p></div>
                <div v-if="selectedCandidate.probeBlueprint.weakeningCriterion" class="probe-validation-contract--weakens"><strong>{{ t('rules.weakeningCriterion') }}</strong><p>{{ ruleText(selectedCandidate, 'probe:weakeningCriterion', selectedCandidate.probeBlueprint.weakeningCriterion) }}</p></div>
                <div v-if="selectedCandidate.probeBlueprint.inconclusiveCriterion"><strong>{{ t('rules.inconclusiveCriterion') }}</strong><p>{{ ruleText(selectedCandidate, 'probe:inconclusiveCriterion', selectedCandidate.probeBlueprint.inconclusiveCriterion) }}</p></div>
              </div>
              <p v-if="selectedCandidate.probeBlueprint.checkable && !selectedCandidate.oracleEligible" class="probe-inactive">{{ t('rules.probeInactive') }}</p>
              <p v-if="selectedCandidate.probeBlueprint.conditionSummary"><strong>{{ t('rules.conditionInSource') }}</strong> {{ ruleText(selectedCandidate, 'probe:condition', selectedCandidate.probeBlueprint.conditionSummary) }}</p>
              <p class="section-description">{{ ruleText(selectedCandidate, 'probe:feedback', selectedCandidate.probeBlueprint.feedbackEffect) }}</p>
            </section>

            <section v-if="evidenceExcerpts.length" class="content-card citations-card">
              <div class="section-heading">
                <div>
                  <h3>{{ t('rules.verifiedEvidence') }}</h3>
                  <p class="section-description">{{ t('rules.verifiedEvidenceDescription') }}</p>
                </div>
              </div>
              <div class="citation-list">
                <article v-for="excerpt in evidenceExcerpts" :key="excerpt.evidenceGroupId" class="citation-item">
                  <div class="citation-meta">
                    <span translate="no">{{ excerpt.sourceTitle || t('rules.unknownSource') }} · {{ excerpt.sectionTitle || excerpt.sectionType || t('rules.paragraph') }}</span>
                    <span v-if="componentCodeForExcerpt(excerpt)">{{ t('rules.supportsComponent', { code: componentCodeForExcerpt(excerpt) }) }}</span>
                    <span v-if="excerpt.pageStart">{{ t('rules.page', { page: excerpt.pageStart }) }}<template v-if="excerpt.pageEnd && excerpt.pageEnd !== excerpt.pageStart">–{{ excerpt.pageEnd }}</template></span>
                  </div>
                  <blockquote translate="no">{{ excerpt.excerpt }}</blockquote>
                  <button
                    v-if="hasWiderContext(excerpt)"
                    type="button"
                    class="context-button"
                    @click="toggleContext(excerpt.evidenceGroupId)"
                  >
                    {{ visibleContexts[excerpt.evidenceGroupId] ? t('rules.hideContext') : t('rules.showContext') }}
                  </button>
                  <p v-if="visibleContexts[excerpt.evidenceGroupId]" class="context-text" translate="no">{{ chunkPreview(excerpt.chunkId) }}</p>
                </article>
              </div>
            </section>

            <section v-if="selectedCandidate.status === 'pending'" class="action-bar">
              <div>
                <strong>{{ t('rules.moderationDecision') }}</strong>
                <span>{{ selectedCandidate.qualityAccepted === false ? t('rules.cannotApprove') : t('rules.approvalGuidance') }}</span>
              </div>
              <div class="action-buttons">
                <AppButton variant="danger-outline" :loading="isRejecting" @click="showRejectModal = true">{{ t('rules.reject') }}</AppButton>
                <AppButton variant="smart" :disabled="selectedCandidate.qualityAccepted === false" :loading="isApproving" @click="showApproveModal = true">{{ t('rules.approve') }}</AppButton>
              </div>
            </section>
          </article>
        </main>
      </div>
    </template>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showApproveModal" class="modal-overlay" role="dialog" aria-modal="true" @click.self="showApproveModal = false">
          <div class="modal-container">
            <div class="modal-header"><h3>{{ t('rules.approveModalTitle') }}</h3><button @click="showApproveModal = false">×</button></div>
            <div class="modal-body"><p>{{ t('rules.approveModalMessage') }}</p></div>
            <div class="modal-footer">
              <AppButton variant="secondary" @click="showApproveModal = false">{{ t('rules.cancel') }}</AppButton>
              <AppButton variant="smart" :loading="isApproving" @click="confirmApproval">{{ t('rules.approve') }}</AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="bulkAction" class="modal-overlay" role="dialog" aria-modal="true" @click.self="bulkAction = null">
          <div class="modal-container">
            <div class="modal-header"><h3>{{ bulkActionCopy.title }}</h3><button @click="bulkAction = null">×</button></div>
            <div class="modal-body"><p>{{ bulkActionCopy.message }}</p></div>
            <div class="modal-footer">
              <AppButton variant="secondary" :disabled="isBulkRunning" @click="bulkAction = null">{{ t('rules.cancel') }}</AppButton>
              <AppButton :variant="bulkActionCopy.danger ? 'danger' : 'smart'" :loading="isBulkRunning" @click="confirmBulkAction">{{ bulkActionCopy.confirm }}</AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showRejectModal" class="modal-overlay" role="dialog" aria-modal="true" @click.self="showRejectModal = false">
          <div class="modal-container">
            <div class="modal-header"><h3>{{ t('rules.rejectModalTitle') }}</h3><button @click="showRejectModal = false">×</button></div>
            <div class="modal-body"><p>{{ t('rules.rejectModalMessage') }}</p></div>
            <div class="modal-footer">
              <AppButton variant="secondary" @click="showRejectModal = false">{{ t('rules.cancel') }}</AppButton>
              <AppButton variant="danger" :loading="isRejecting" @click="confirmRejection">{{ t('rules.reject') }}</AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/common/AppButton.vue'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import {
  createBrowserTranslator,
  translateBrowserText,
  type BrowserTranslatorInstance,
} from '@/features/library/services/browserReaderTranslation.service'
import {
  approveRuleCandidate,
  getRuleCandidateDetail,
  getRuleCandidates,
  rejectRuleCandidate,
  runRuleV3BulkAction,
  type RuleV3BulkAction,
  type CandidateDetailResponse,
  type EvidenceChunkPreview,
  type EvidenceExcerpt,
  type RuleCandidate
} from '@/api/ruleCandidateApi'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { t, locale } = useI18n({ useScope: 'global' })

const isUnauthorized = computed(() => {
  const ids = (import.meta.env.VITE_MODERATOR_USER_IDS || '').split(',').map((id: string) => id.trim().toLowerCase())
  return !authStore.user?._id || !ids.includes(authStore.user._id.toLowerCase())
})

const statusTabs = computed(() => [
  { value: 'pending', label: t('rules.statuses.pending') },
  { value: 'approved', label: t('rules.statuses.approved') },
  { value: 'rejected', label: t('rules.statuses.rejected') }
])
const activeStatus = ref('pending')
const sourceIdFilter = computed(() => route.query.sourceId ? String(route.query.sourceId) : null)
const candidates = ref<RuleCandidate[]>([])
const selectedId = ref<string | null>(null)
const selectedCandidate = ref<RuleCandidate | null>(null)
const evidenceChunks = ref<EvidenceChunkPreview[]>([])
const evidenceExcerpts = ref<EvidenceExcerpt[]>([])
type RuleRelationshipRow = NonNullable<CandidateDetailResponse['ruleRelationships']>[number]
type EvidenceGapMatchRow = NonNullable<CandidateDetailResponse['evidenceGapMatches']>[number]
const ruleRelationships = ref<RuleRelationshipRow[]>([])
const evidenceGapMatches = ref<EvidenceGapMatchRow[]>([])
const resolvedEvidenceGapMatches = computed(() =>
  evidenceGapMatches.value.filter((match) => match.resolvedByRule),
)
const visibleContexts = ref<Record<string, boolean>>({})
const isLoadingList = ref(false)
const isLoadingDetail = ref(false)
const isApproving = ref(false)
const isRejecting = ref(false)
const showApproveModal = ref(false)
const showRejectModal = ref(false)
const openCriterionKey = ref<string | null>(null)
const bulkAction = ref<RuleV3BulkAction | null>(null)
const isBulkRunning = ref(false)

const activeTabLabel = computed(() => statusTabs.value.find(tab => tab.value === activeStatus.value)?.label || '')
const visibleRelationships = computed(() => ruleRelationships.value.filter(item => !item.mergeEligibility?.canMerge))
const bulkActionCopy = computed(() => ({
  approve_pending: { title: t('rules.bulk.approveTitle'), message: t('rules.bulk.approveMessage'), confirm: t('rules.approveAll'), danger: false },
  reject_pending: { title: t('rules.bulk.rejectTitle'), message: t('rules.bulk.rejectMessage'), confirm: t('rules.rejectAll'), danger: true },
  restore_rejected: { title: t('rules.bulk.restoreTitle'), message: t('rules.bulk.restoreMessage'), confirm: t('rules.restoreAll'), danger: false },
  delete_rejected: { title: t('rules.bulk.deleteTitle'), message: t('rules.bulk.deleteMessage'), confirm: t('rules.bulk.deleteConfirm'), danger: true }
} as const)[bulkAction.value || 'approve_pending'])
const groupedCandidates = computed(() => {
  const groups: Record<string, RuleCandidate[]> = {}
  for (const candidate of candidates.value) {
    const title = candidate.sourceTitle || t('rules.unknownSource')
    if (!groups[title]) groups[title] = []
    groups[title].push(candidate)
  }
  return groups
})

function relationshipSignalList(item: RuleRelationshipRow) {
  const labels: Record<string, string> = {
    same_source_document: t('rules.relationshipSignals.same_source_document'),
    same_canonical_paragraph: t('rules.relationshipSignals.same_canonical_paragraph'),
    related_subject: t('rules.relationshipSignals.related_subject'),
    related_outcome: t('rules.relationshipSignals.related_outcome'),
    similar_statement: t('rules.relationshipSignals.similar_statement'),
    same_question_kind: t('rules.relationshipSignals.same_question_kind'),
  }
  return (item.mergeEligibility?.signals || []).map(signal => labels[signal] || signal)
}

function relationshipBadge(item: RuleRelationshipRow) {
  if (item.relationship === 'contradictory') return t('rules.relationshipBadges.contradictory')
  if (item.relationship === 'reverse_direction') return t('rules.relationshipBadges.reverse_direction')
  if (item.relationship === 'scope_tension') return t('rules.relationshipBadges.scope_tension')
  const signals = item.mergeEligibility?.signals || []
  if (signals.includes('same_canonical_paragraph')) return t('rules.relationshipBadges.same_canonical_paragraph')
  if (signals.includes('related_subject') && signals.includes('related_outcome')) return t('rules.relationshipBadges.related_subject_outcome')
  if (signals.includes('related_subject')) return t('rules.relationshipBadges.related_subject')
  if (signals.includes('related_outcome')) return t('rules.relationshipBadges.related_outcome')
  if (signals.includes('same_question_kind')) return t('rules.relationshipBadges.same_question_kind')
  return t('rules.relationshipBadges.similar_content')
}

function relationshipWhyShown(item: RuleRelationshipRow) {
  const signals = relationshipSignalList(item)
  const similarity = signals.length
    ? t('rules.relatedBecause', { signals: signals.join(', ') })
    : t('rules.relatedBecauseFallback')
  const differences: Record<string, string> = {
    equivalent: t('rules.relationshipDifferences.equivalent'),
    overlapping: t('rules.relationshipDifferences.overlapping'),
    complementary: t('rules.relationshipDifferences.complementary'),
    scope_tension: t('rules.relationshipDifferences.scope_tension'),
    shared_context: t('rules.relationshipDifferences.shared_context'),
    contradictory: t('rules.relationshipDifferences.contradictory'),
    reverse_direction: t('rules.relationshipDifferences.reverse_direction'),
  }
  const difference = differences[item.relationship] || differences.complementary
  const boundary = item.mergeEligibility?.blockedByState === 'composite_review_boundary'
    ? ` ${t('rules.relationshipState.composite_review_boundary')}`
    : item.mergeEligibility?.blockedByState === 'different_status'
      ? ` ${t('rules.relationshipState.different_status')}`
      : ''
  return `${similarity} ${t('rules.keptSeparateBecause', { difference })}${boundary}`
}

const formattedSource = computed(() => {
  const candidate = selectedCandidate.value
  if (!candidate) return ''
  const authors = candidate.sourceAuthors?.length ? candidate.sourceAuthors.join(', ') : t('rules.unknownAuthor')
  const year = candidate.sourceYear ? ` (${candidate.sourceYear})` : ''
  const title = candidate.sourceTitle || t('rules.untitledSource')
  const doi = candidate.sourceDoi ? ` · DOI ${candidate.sourceDoi}` : ''
  return `${authors}${year} · ${title}${doi}`
})

const translatedRuleFields = ref(new Map<string, string>())
const translatorPromises = new Map<string, Promise<BrowserTranslatorInstance>>()
const unavailableLanguagePairs = new Set<string>()
let translationRunId = 0

function inferContentLanguage(value: string, fallback?: string): 'vi' | 'en' | null {
  if (/[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/iu.test(value)) return 'vi'
  if (/\b(?:the|and|dream|sleep|memory|evidence|participants?|associated|future|source|condition|rule)\b/iu.test(value)) return 'en'
  return fallback === 'vi' || fallback === 'en' ? fallback : null
}

function dynamicRuleKey(ruleId: string, field: string, value: string): string {
  return `${locale.value}:${ruleId}:${field}:${value}`
}

function questionPlaceholderReplacements(): Record<string, string> {
  return {
    __DREAM_FEATURE__: t('rules.placeholders.dreamFeature'),
    __DREAM_REACTION__: t('rules.placeholders.dreamReaction'),
    __COMPARISON_CONTEXT__: t('rules.placeholders.comparisonContext'),
    __NEAR_TERM_EVENT__: t('rules.placeholders.nearTermEvent'),
    __LONG_TERM_PLAN__: t('rules.placeholders.longTermPlan'),
    __UPCOMING_EVENT__: t('rules.placeholders.upcomingEvent'),
    __CURRENT_PRESSURE__: t('rules.placeholders.currentPressure'),
    __MATCHED_PROBLEM__: t('rules.placeholders.matchedProblem'),
    __MATCHED_PERSON__: t('rules.placeholders.matchedPerson'),
    __MATCHED_FRAGMENTS__: t('rules.placeholders.matchedFragments'),
    __MATCHED_FUTURE_EVENT__: t('rules.placeholders.matchedFutureEvent'),
    __MATCHED_SOLUTION__: t('rules.placeholders.matchedSolution'),
    __SLEEP_STIMULUS__: t('rules.placeholders.sleepStimulus'),
  }
}

function materializeQuestionPlaceholders(value: string): string {
  let rendered = value
  for (const [marker, localized] of Object.entries(questionPlaceholderReplacements())) {
    rendered = rendered.replaceAll(marker, localized)
  }
  return rendered
}

function ruleText(candidate: RuleCandidate, field: string, value: string): string {
  if (!value) return value
  return translatedRuleFields.value.get(dynamicRuleKey(candidate._id, field, value)) || value
}

function localizedRuleExplanation(
  localized: Partial<Record<'vi' | 'en', string>> | undefined,
  candidate: RuleCandidate,
  field: string,
  fallback: string,
): string {
  const target = locale.value === 'en' ? 'en' : 'vi'
  return localized?.[target] || ruleText(candidate, field, fallback)
}

function translatedRuleList(candidate: RuleCandidate, field: string, values: string[]): string[] {
  return values.map((value, index) => ruleText(candidate, `${field}:${index}`, value))
}

function relatedRuleText(item: RuleRelationshipRow): string {
  return translatedRuleFields.value.get(dynamicRuleKey(item.ruleId, 'relationshipLabel', item.label)) || item.label
}

async function getBrowserRuleTranslator(source: 'vi' | 'en', target: 'vi' | 'en'): Promise<BrowserTranslatorInstance> {
  const pair = `${source}:${target}`
  if (unavailableLanguagePairs.has(pair)) throw new Error('browser_translation_unavailable')
  let pending = translatorPromises.get(pair)
  if (!pending) {
    pending = createBrowserTranslator(source, target).then(result => result.translator).catch(error => {
      unavailableLanguagePairs.add(pair)
      translatorPromises.delete(pair)
      throw error
    })
    translatorPromises.set(pair, pending)
  }
  return pending
}

async function translateRuleField(candidateId: string, field: string, value: string, fallbackLanguage?: string, runId = translationRunId) {
  // Replace machine-only markers before browser translation. Otherwise Chrome
  // interprets the surrounding underscores as formatting and can produce
  // broken strings such as "__matched_future_event..." in the review UI.
  const clean = materializeQuestionPlaceholders(String(value || '')).trim()
  if (!clean || !/[\p{L}]/u.test(clean)) return
  const target = locale.value === 'en' ? 'en' : 'vi'
  const sourceLanguage = inferContentLanguage(clean, fallbackLanguage)
  if (!sourceLanguage || sourceLanguage === target) return
  const key = dynamicRuleKey(candidateId, field, value)
  if (translatedRuleFields.value.has(key)) return
  try {
    const translator = await getBrowserRuleTranslator(sourceLanguage, target)
    const translated = await translateBrowserText(translator, clean, sourceLanguage, target)
    if (runId === translationRunId && translated.trim() && translated.trim() !== clean) {
      translatedRuleFields.value.set(key, translated)
    }
  } catch {
    // Browser translation is a presentation enhancement. The canonical rule
    // remains visible when this browser does not expose a translation model.
  }
}

async function translateVisibleRuleContent() {
  const runId = ++translationRunId
  const jobs: Promise<void>[] = []
  for (const candidate of candidates.value) {
    jobs.push(translateRuleField(candidate._id, 'label', candidate.label, candidate.sourceLanguage, runId))
  }
  const candidate = selectedCandidate.value
  if (candidate) {
    const fields: Array<[string, string]> = [
      ['label', candidate.label], ['statement', candidate.fullStatement || ''], ['factor', candidate.factor || ''],
      ['outcome', candidate.inputSource || ''], ['qualitySummary', candidate.qualitySummary || ''],
      ['explanation', candidate.expandedExplanation || candidate.fullStatement || ''],
      ['probe:check', candidate.probeBlueprint?.applicabilityCheck || ''], ['probe:explanation', candidate.probeBlueprint?.explanation || ''],
      ['probe:questionPattern', candidate.probeBlueprint?.questionPattern || ''],
      ['probe:requiredData', candidate.probeBlueprint?.requiredData || ''],
      ['probe:expectedPattern', candidate.probeBlueprint?.expectedPattern || ''],
      ['probe:supportCriterion', candidate.probeBlueprint?.supportCriterion || ''],
      ['probe:weakeningCriterion', candidate.probeBlueprint?.weakeningCriterion || ''],
      ['probe:inconclusiveCriterion', candidate.probeBlueprint?.inconclusiveCriterion || ''],
      ['probe:condition', candidate.probeBlueprint?.conditionSummary || ''], ['probe:feedback', candidate.probeBlueprint?.feedbackEffect || ''],
    ]
    candidate.probeBlueprint?.questionDimensions?.forEach((question, index) => {
      fields.push([`probe:question:${index}`, question.questionPattern], [`probe:purpose:${index}`, question.purpose])
    })
    candidate.compositeComponents?.forEach((component, index) => {
      fields.push(
        [`component:${index}:subject`, component.subject],
        [`component:${index}:outcome`, component.outcome],
        [`component:${index}:statement`, component.statement],
        [`component:${index}:explanation`, component.expandedExplanation || component.statement],
      )
    })
    candidate.conditionsList?.forEach((value, index) => fields.push([`condition:${index}`, value]))
    candidate.limitationsList?.forEach((value, index) => fields.push([`limitation:${index}`, value]))
    reviewDreamTags.value.forEach((value, index) => fields.push([`dreamTag:${index}`, value]))
    candidate.scoreCriteria?.forEach(item => {
      fields.push([`reason:${item.key}`, item.reason], [`rubric:${item.key}`, item.rubric])
    })
    for (const [field, value] of fields) jobs.push(translateRuleField(candidate._id, field, value, candidate.sourceLanguage, runId))
  }
  for (const item of ruleRelationships.value) jobs.push(translateRuleField(item.ruleId, 'relationshipLabel', item.label, undefined, runId))
  await Promise.all(jobs)
}

const scoreCriteriaRows = computed(() => selectedCandidate.value?.scoreCriteria || [])
const reviewConditions = computed(() => (selectedCandidate.value?.conditionsList || []).filter(item => {
  const value = item.trim()
  return value.split(/\s+/u).length >= 2 && !/^(?:function|effect|role|relationship)\s+of\b/iu.test(value)
}))
const reviewLimitations = computed(() => (selectedCandidate.value?.limitationsList || []).filter(item => item.trim().split(/\s+/u).length >= 2))
const reviewDreamTags = computed(() => (selectedCandidate.value?.dreamFeatureTags || [])
  .map(item => item.replace(/_/g, ' ').trim())
  .filter(item => item
    && !/^(?:memory|emotion|sleep|dream|dreams|dream content|trí nhớ|cảm xúc|giấc ngủ|giấc mơ)$/iu.test(item)
    && !/\b(?:neural|brain|cortex|cortical|EEG|activation|neuron)\b/iu.test(item)))

watch(
  [() => locale.value, candidates, selectedCandidate, ruleRelationships],
  () => { void translateVisibleRuleContent() },
  { flush: 'post' },
)

function punctuatedList(items: string[], separator: string) {
  const value = items.map(item => item.trim()).filter(Boolean).join(separator)
  return /[.!?]$/u.test(value) ? value : `${value}.`
}

const evidenceScoreConclusion = computed(() => {
  const candidate = selectedCandidate.value
  const score = candidate?.evidenceCredibilityScore || 0
  const citations = candidate?.supportingCitationCount || 0
  const sources = candidate?.independentSourceCount || 0
  if (score >= 80) return t('rules.scoreConclusions.strong', { citations, sources })
  if (score >= 60) return t('rules.scoreConclusions.moderate', { citations, sources })
  if (score >= 40) return t('rules.scoreConclusions.limited')
  return t('rules.scoreConclusions.weak')
})

watch(
  [() => route.query.sourceId, () => authStore.user?._id],
  () => { if (!isUnauthorized.value) void fetchCandidates() },
  { immediate: true }
)

function clearSourceFilter() {
  void router.push({ path: route.path })
}

function openBulkAction(action: RuleV3BulkAction) {
  if (candidates.value.length === 0) return
  bulkAction.value = action
}

async function confirmBulkAction() {
  if (!bulkAction.value) return
  const confirmations: Record<RuleV3BulkAction, string> = {
    approve_pending: 'APPROVE_ALL_PENDING_RULES', reject_pending: 'REJECT_ALL_PENDING_RULES',
    restore_rejected: 'RESTORE_ALL_REJECTED_RULES', delete_rejected: 'DELETE_ALL_REJECTED_RULES'
  }
  isBulkRunning.value = true
  try {
    const response = await runRuleV3BulkAction(bulkAction.value, confirmations[bulkAction.value], sourceIdFilter.value || undefined)
    const failed = response.data.failed
    settingsStore.showToast(failed
      ? t('rules.toasts.bulkPartial', { processed: response.data.processed, failed })
      : t('rules.toasts.bulkDone', { processed: response.data.processed }), failed ? 'error' : 'success')
    bulkAction.value = null
    await fetchCandidates()
  } catch (error: any) {
    settingsStore.showToast(error.response?.data?.message || t('rules.toasts.bulkFailed'), 'error')
  } finally {
    isBulkRunning.value = false
  }
}

function changeTab(status: string) {
  activeStatus.value = status
  selectedCandidate.value = null
  selectedId.value = null
  void fetchCandidates()
}

async function fetchCandidates() {
  isLoadingList.value = true
  try {
    const response = await getRuleCandidates({
      status: activeStatus.value,
      academicSourceId: sourceIdFilter.value || undefined
    })
    candidates.value = response.data || []
    if (candidates.value.length > 0) {
      const nextId = candidates.value.some(item => item._id === selectedId.value) ? selectedId.value! : candidates.value[0]._id
      await selectCandidate(nextId)
    } else {
      selectedId.value = null
      selectedCandidate.value = null
      evidenceChunks.value = []
      evidenceExcerpts.value = []
      ruleRelationships.value = []
      evidenceGapMatches.value = []
    }
  } catch {
    settingsStore.showToast(t('rules.toasts.listFailed'), 'error')
  } finally {
    isLoadingList.value = false
  }
}

async function selectCandidate(id: string) {
  selectedId.value = id
  isLoadingDetail.value = true
  try {
    const response = await getRuleCandidateDetail(id)
    selectedCandidate.value = response.data.candidate
    evidenceChunks.value = response.data.evidenceChunks || []
    evidenceExcerpts.value = (response.data.evidenceExcerpts || []).filter(item => item.excerpt?.trim())
    ruleRelationships.value = response.data.ruleRelationships || []
    evidenceGapMatches.value = response.data.evidenceGapMatches || []
    visibleContexts.value = {}
  } catch {
    selectedCandidate.value = null
    ruleRelationships.value = []
    evidenceGapMatches.value = []
    settingsStore.showToast(t('rules.toasts.detailFailed'), 'error')
  } finally {
    isLoadingDetail.value = false
  }
}

async function confirmApproval() {
  if (!selectedCandidate.value) return
  isApproving.value = true
  try {
    await approveRuleCandidate(selectedCandidate.value._id)
    showApproveModal.value = false
    settingsStore.showToast(t('rules.toasts.approved'), 'success')
    await fetchCandidates()
  } catch (error: any) {
    settingsStore.showToast(error.response?.data?.message || t('rules.toasts.approveFailed'), 'error')
  } finally {
    isApproving.value = false
  }
}

async function confirmRejection() {
  if (!selectedCandidate.value) return
  isRejecting.value = true
  try {
    await rejectRuleCandidate(selectedCandidate.value._id, '')
    showRejectModal.value = false
    settingsStore.showToast(t('rules.toasts.rejected'), 'success')
    await fetchCandidates()
  } catch (error: any) {
    settingsStore.showToast(error.response?.data?.message || t('rules.toasts.rejectFailed'), 'error')
  } finally {
    isRejecting.value = false
  }
}

function chunkPreview(chunkId: string) {
  return evidenceChunks.value.find(item => item.chunkId === chunkId)?.chunkPreview || ''
}

function componentCodeForExcerpt(excerpt: EvidenceExcerpt) {
  if (!selectedCandidate.value?.isComposite || !excerpt.ruleId) return ''
  return selectedCandidate.value.compositeComponents?.find(component => component.sourceRuleId === excerpt.ruleId)?.ruleCode || ''
}

function hasWiderContext(excerpt: EvidenceExcerpt) {
  const context = chunkPreview(excerpt.chunkId).replace(/\s+/g, ' ').trim()
  const quote = excerpt.excerpt.replace(/\s+/g, ' ').trim()
  return context.length >= quote.length + 30 && context !== quote
}

function toggleContext(evidenceGroupId: string) {
  visibleContexts.value[evidenceGroupId] = !visibleContexts.value[evidenceGroupId]
}

function toggleCriterionHelp(key: string) {
  openCriterionKey.value = openCriterionKey.value === key ? null : key
}

function rubricBullets(value: string) {
  return value
    .split(/(?<=[.;])\s+/u)
    .map(item => item.trim().replace(/[.;]$/u, ''))
    .filter(Boolean)
}

function closeCriterionHelp() {
  openCriterionKey.value = null
}

onMounted(() => document.addEventListener('click', closeCriterionHelp))
onBeforeUnmount(() => {
  document.removeEventListener('click', closeCriterionHelp)
  for (const pending of translatorPromises.values()) void pending.then(translator => translator.destroy?.()).catch(() => undefined)
  translatorPromises.clear()
})

function statusLabel(status: string) {
  return ({ pending: t('rules.statuses.pending'), approved: t('rules.statuses.approved'), rejected: t('rules.statuses.rejected') } as Record<string, string>)[status] || status
}

function scoreCriterionLabel(value: string) {
  return t(`rules.criteria.${value}`, value)
}

function questionTypeLabel(value: string) {
  const known = ['dream_feature_confirmation', 'dream_reaction_confirmation', 'comparison_group_context', 'multiple_future_horizons', 'recent_experience_incorporation', 'anticipated_event', 'current_stress', 'avoidance_pressure', 'attachment_support_under_stress', 'external_sleep_stimulus', 'waking_concern_incorporation', 'priority_pressure', 'recent_direct_exposure', 'preparation_behavior', 'stress_impact', 'approaching_consequence', 'recent_support_seeking', 'sleep_environment_context', 'recent_day_activity', 'weak_association_recombination', 'creative_problem_preoccupation', 'implausible_future_scenario', 'waking_prospective_difference', 'novel_solution_origin']
  return known.includes(value) ? t(`rules.questionTypes.${value}`) : value
}

function renderQuestionPattern(candidate: RuleCandidate, field: string, value: string) {
  return materializeQuestionPlaceholders(ruleText(candidate, field, value))
}

function collectedFieldLabel(value: string) {
  const prefix = value.split(':', 1)[0]
  return ({
    presence: t('rules.collectedFields.presence'),
    comparison_context: t('rules.collectedFields.comparisonContext'),
    case_applicability: t('rules.collectedFields.caseApplicability'),
  } as Record<string, string>)[prefix] || value
}

function sourceGroupStyle(title: string) {
  let hash = 0
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const hues = [218, 252, 176, 32, 326, 198]
  return { '--source-group-hue': String(hues[hash % hues.length]) }
}

function scoreLevelLabel(score?: number) {
  const value = score || 0
  return value >= 80 ? t('rules.scores.strong') : value >= 60 ? t('rules.scores.moderate') : value >= 40 ? t('rules.scores.limited') : t('rules.scores.weak')
}

function scoreLevelClass(score?: number) {
  const value = score || 0
  return value >= 80 ? 'level-good' : value >= 60 ? 'level-moderate' : 'level-caution'
}

function localizedEvidenceGapClaim(match: EvidenceGapMatchRow) {
  return locale.value === 'vi' ? match.claim.vi : match.claim.en
}

function evidenceGapStateLabel(match: EvidenceGapMatchRow) {
  if (match.resolvedByRule) return t('rules.evidenceGapResolved')
  if (match.blockers.length === 0) return t('rules.evidenceGapReady')
  return t('rules.evidenceGapCandidate')
}

function evidenceGapExplanation(match: EvidenceGapMatchRow) {
  if (match.resolvedByRule) return t('rules.evidenceGapResolvedDescription')
  if (match.blockers.length === 0) return t('rules.evidenceGapReadyDescription')
  return t('rules.evidenceGapCandidateDescription')
}

function evidenceGapBlockerLabel(blocker: EvidenceGapMatchRow['blockers'][number]) {
  const labels = {
    similarity: t('rules.evidenceGapBlockers.similarity'),
  }
  return labels[blocker]
}

function scoreColor(score?: number) {
  const value = Math.max(0, Math.min(100, Number(score) || 0))
  const hue = Math.round(value * 1.2)
  return `hsl(${hue} 72% 56%)`
}
</script>

<style scoped>
.rule-review-page { display: flex; flex-direction: column; gap: var(--space-4); height: calc(100dvh - 92px); min-height: 0; overflow: hidden; }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-5); }
.header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.page-header h1 { margin: 2px 0 6px; font-size: 1.75rem; color: var(--color-text-primary); }
.page-header > div > p:last-child { margin: 0; color: var(--color-text-secondary); }
.eyebrow { margin: 0; color: var(--accent); font-size: .72rem; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
.header-count { min-width: 92px; padding: 10px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); text-align: center; background: var(--color-bg-elevated); }
.header-count strong { display: block; font-size: 1.45rem; }.header-count span { color: var(--color-text-muted); font-size: .76rem; }
.source-filter { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border: 1px solid rgba(59,130,246,.28); border-radius: var(--radius-md); background: rgba(59,130,246,.06); font-size: .82rem; }
.source-filter button { border: 0; background: transparent; color: var(--accent); cursor: pointer; font-weight: 650; }
.status-tabs { display: flex; gap: 6px; padding: 4px; width: fit-content; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg-elevated); }
.status-tabs button { padding: 8px 14px; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--color-text-secondary); cursor: pointer; }
.status-tabs button.active { background: var(--color-bg-active); color: var(--color-text-primary); box-shadow: inset 0 0 0 1px var(--color-border); }
.bulk-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.review-layout { display: grid; grid-template-columns: minmax(290px, 340px) minmax(0, 1fr); gap: var(--space-4); flex: 1; min-height: 0; }
.candidate-sidebar, .candidate-detail { min-height: 0; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg-elevated); overflow: hidden; }
.candidate-sidebar { display: flex; flex-direction: column; padding: var(--space-3); }.candidate-detail { min-width: 0; display: flex; flex-direction: column; }
.candidate-list, .rule-document { flex: 1; height: 100%; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.source-group { margin: 8px 3px 14px; padding: 8px; border: 1px solid hsl(var(--source-group-hue) 42% 62% / .14); border-radius: var(--radius-lg); background: hsl(var(--source-group-hue) 45% 52% / .028); }
.source-group h2 { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin: 2px 3px 9px; color: var(--color-text-secondary); font-size: .72rem; line-height: 1.4; letter-spacing: .035em; }
.source-group h2 span { min-width: 0; }.source-group h2 small { flex: 0 0 auto; color: var(--color-text-muted); font-size: .66rem; font-weight: 600; white-space: nowrap; }
.source-rule-list { display: flex; flex-direction: column; gap: 6px; }
.candidate-card { width: 100%; display: flex; flex-direction: column; gap: 9px; padding: 12px; margin: 0; text-align: left; border: 1px solid transparent; border-radius: var(--radius-md); background: color-mix(in srgb, var(--color-bg-base) 98%, hsl(var(--source-group-hue) 45% 55%)); color: inherit; cursor: pointer; }
.candidate-card:hover { border-color: var(--color-border); background: var(--color-bg-hover); }.candidate-card.selected { border-color: var(--accent); background: rgba(59,130,246,.07); }
.candidate-title { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; font-size: .9rem; font-weight: 650; line-height: 1.4; color: var(--color-text-primary); }
.candidate-card-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--color-text-muted); font-size: .7rem; }
.composite-badge { display: inline-flex; width: fit-content; margin-top: 8px; padding: 4px 8px; border-radius: 999px; background: rgba(99,102,241,.12); color: #a5b4fc; font-size: .68rem; font-weight: 700; }.composite-claims { display: grid; gap: 12px; margin-top: 16px; }.composite-claim { padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); }.composite-claim__header { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px; color: var(--color-text-secondary); font-size: .7rem; }.composite-claim__header span { color: var(--color-text-muted); }.composite-claim .relationship-flow { margin-top: 0; }.composite-claim .rule-explanation { margin-top: 10px; }
.score-aggregation-note { margin: 10px 0 0; padding: 10px 12px; border: 1px solid rgba(245,158,11,.25); border-radius: var(--radius-sm); background: rgba(245,158,11,.06); color: var(--color-text-secondary); font-size: .74rem; line-height: 1.5; }.score-aggregation-note strong { color: #fbbf24; }
.score-chip { color: #93c5fd; font-weight: 700; }.status-chip { display: inline-flex; width: fit-content; padding: 3px 8px; border-radius: 999px; font-size: .68rem; font-weight: 700; }
.composite-list-chip { color: #a5b4fc; font-weight: 700; }
.status-pending { color: #fbbf24; background: rgba(245,158,11,.12); }.status-approved { color: #34d399; background: rgba(16,185,129,.12); }.status-rejected { color: #f87171; background: rgba(239,68,68,.12); }
.loading-state, .empty-panel { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; min-height: 180px; padding: var(--space-5); text-align: center; color: var(--color-text-muted); }
.empty-panel h3, .empty-panel p { margin: 0; }.empty-panel.compact { min-height: 320px; }.detail-empty, .detail-loading { height: 100%; min-height: 650px; }
.spinner { width: 22px; height: 22px; border: 2px solid var(--color-border); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.rule-document { padding: clamp(16px, 2.5vw, 30px); }
.rule-hero { padding: clamp(18px, 2vw, 26px); border: 1px solid #3730a3; border-radius: var(--radius-lg); background: rgba(30, 27, 75, .38); box-shadow: inset 4px 0 0 #7c3aed; }
.hero-topline, .section-heading, .score-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
.rule-code, .formula-version { color: var(--color-text-muted); font: 600 .68rem var(--font-family-mono), monospace; }
.rule-hero h2 { margin: 14px 0 10px; color: var(--color-text-primary); font-size: clamp(1.3rem, 2vw, 1.75rem); line-height: 1.35; }
.source-line { margin: 0; color: var(--color-text-secondary); font-size: .85rem; line-height: 1.5; }
.content-card { margin-top: var(--space-4); padding: clamp(16px, 2vw, 22px); border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg-base); }
.section-heading h3 { margin: 0; color: var(--color-text-primary); }.section-description { margin: 5px 0 0; color: var(--color-text-muted); font-size: .76rem; line-height: 1.45; }.rule-explanation { margin: 16px 0 0; padding: 13px 14px; border-left: 3px solid #818cf8; border-radius: 0 var(--radius-md) var(--radius-md) 0; background: rgba(49,46,129,.16); color: var(--color-text-primary); line-height: 1.6; }.relationship-flow { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: stretch; margin-top: 18px; }
.relationship-flow > div:not(.relationship-arrow) { padding: 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); }.relationship-flow span { display: block; margin-bottom: 6px; color: var(--color-text-muted); font-size: .7rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }.relationship-flow strong { color: var(--color-text-primary); line-height: 1.45; }.relationship-arrow { align-self: center; color: var(--accent); font-size: 1.4rem; }
.rule-reading-guide { display: grid; gap: 8px; margin: 15px 0 0; padding: 0; list-style: none; color: var(--color-text-secondary); font-size: .82rem; line-height: 1.5; }.rule-reading-guide li { padding-left: 15px; position: relative; }.rule-reading-guide li::before { content: '•'; position: absolute; left: 0; color: #818cf8; }.rule-reading-guide strong { color: var(--color-text-primary); }
.assessment-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }.assessment-card h3 { font-size: 1.45rem; }.level-badge { padding: 5px 9px; border-radius: 999px; font-size: .7rem; font-weight: 750; }.level-good { color: #34d399; background: rgba(16,185,129,.12); }.level-moderate { color: #60a5fa; background: rgba(59,130,246,.12); }.level-caution { color: #fbbf24; background: rgba(245,158,11,.12); }
.assessment-title { font-size: .95rem !important; }.score-number { display: block; margin-top: 5px; font-size: 1.65rem; line-height: 1; }.score-track { width: 100%; height: 9px; margin: 14px 0; border: 1px solid rgba(148,163,184,.16); border-radius: 999px; overflow: hidden; background: #111827; }.score-track span { display: block; min-width: 2px; height: 100%; border-radius: inherit; transition: width .25s ease; }.score-conclusion { margin: 0 0 7px; color: var(--color-text-primary); font-size: .8rem; line-height: 1.5; }.score-note { color: var(--color-text-muted); font-size: .76rem; line-height: 1.5; }
.validation-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:14px 0 0}.validation-stats div{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-bg-elevated);font-size:.74rem}.validation-stats dt{color:var(--color-text-muted)}.validation-stats dd{margin:0;color:var(--color-text-primary);font-weight:750}.validation-stats dd.is-positive{color:#79d6a3}.validation-stats dd.is-negative{color:#ef8a8a}
.criteria-list { display: flex; flex-direction: column; margin: 16px 0 0; border-top: 1px solid var(--color-border); }.criterion-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--color-border); font-size: .78rem; }.criterion-row dt { display: flex; align-items: center; gap: 7px; color: var(--color-text-secondary); }.criterion-row dd { margin: 0; color: var(--color-text-primary); font-weight: 700; }.criterion-help { position: relative; }.criterion-help button { display: grid; place-items: center; width: 18px; height: 18px; padding: 0; border: 1px solid var(--color-border); border-radius: 50%; background: transparent; color: var(--color-text-muted); cursor: pointer; font-size: .68rem; font-weight: 700; }.criterion-help > div { position: absolute; z-index: 20; top: 25px; left: 0; width: min(350px, 72vw); padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); box-shadow: 0 12px 30px rgba(0,0,0,.24); color: var(--color-text-secondary); font-size: .75rem; line-height: 1.45; }.criterion-help > div strong { color: var(--color-text-primary); }.criterion-help > div p { margin: 5px 0 0; }.criterion-help > div ul { margin: 7px 0 12px; padding-left: 20px; list-style: disc outside; }.criterion-help > div li { margin: 5px 0; padding-left: 2px; }.quality-blocked { display: flex; flex-direction: column; gap: 3px; margin-top: 15px; padding: 11px 13px; border: 1px solid rgba(239,68,68,.32); border-radius: var(--radius-md); color: #fca5a5; font-size: .78rem; }.quality-blocked span { color: var(--color-text-secondary); }
.evidence-gap-card { border-color: rgba(59,130,246,.28); background: color-mix(in srgb, var(--color-bg-base) 96%, #2563eb); }.evidence-gap-count { display: grid; place-items: center; min-width: 28px; height: 28px; padding: 0 8px; border-radius: 999px; background: rgba(59,130,246,.14); color: #93c5fd; font-size: .75rem; font-weight: 750; }.evidence-gap-list { display: grid; gap: 10px; margin-top: 16px; }.evidence-gap-item { padding: 13px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); }.evidence-gap-item__heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 9px; color: var(--color-text-muted); font-size: .68rem; }.evidence-gap-item > strong { display: block; color: var(--color-text-primary); font-size: .84rem; line-height: 1.5; }.evidence-gap-state { padding: 3px 7px; border-radius: 999px; background: rgba(245,158,11,.1); color: #fbbf24; font-weight: 750; }.evidence-gap-state--ready { background: rgba(59,130,246,.12); color: #93c5fd; }.evidence-gap-state--resolved { background: rgba(16,185,129,.12); color: #6ee7b7; }.evidence-gap-match-meter { height: 4px; margin: 11px 0 9px; overflow: hidden; border-radius: 999px; background: rgba(148,163,184,.12); }.evidence-gap-match-meter span { display: block; height: 100%; border-radius: inherit; background: #60a5fa; }.evidence-gap-item > p { margin: 0; color: var(--color-text-secondary); font-size: .74rem; line-height: 1.5; }.evidence-gap-blockers { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 0; padding: 0; list-style: none; }.evidence-gap-blockers li { padding: 4px 7px; border-radius: var(--radius-sm); background: rgba(148,163,184,.08); color: var(--color-text-muted); font-size: .68rem; }
.citation-list { display: flex; flex-direction: column; gap: 12px; margin-top: 17px; }.citation-item { padding: 15px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); }.citation-meta { display: flex; justify-content: space-between; gap: 10px; color: var(--color-text-muted); font-size: .7rem; }.citation-item blockquote { margin: 12px 0; padding-left: 14px; border-left: 3px solid var(--accent); color: var(--color-text-primary); font-size: .9rem; line-height: 1.65; }.context-button { padding: 0; border: 0; background: transparent; color: var(--accent); cursor: pointer; font-size: .76rem; }.context-text { margin: 12px 0 0; padding: 12px; border-radius: var(--radius-md); background: var(--color-bg-base); color: var(--color-text-secondary); font-size: .78rem; line-height: 1.55; white-space: pre-wrap; }
.relationship-card { display: grid; gap: 9px; }.related-rule { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); color: inherit; text-align: left; cursor: pointer; }.related-rule:hover { border-color: rgba(129,140,248,.42); }.related-rule strong { min-width: 0; color: var(--color-text-primary); font-size: .8rem; line-height: 1.4; }.related-rule small { color: var(--color-text-muted); white-space: nowrap; }.relation-kind { padding: 3px 7px; border-radius: 999px; color: #a5b4fc; background: rgba(99,102,241,.1); font-size: .65rem; font-weight: 700; }.relation-kind--contradictory { color: #fca5a5; background: rgba(239,68,68,.1); }.relation-kind--reverse_direction { color: #fcd34d; background: rgba(245,158,11,.1); }
.relationship-group { display: grid; gap: 8px; padding: 11px; border: 1px solid var(--color-border); border-radius: var(--radius-md); }.relationship-group--mergeable { border-color: rgba(52,211,153,.25); background: rgba(16,185,129,.035); }.relationship-group__title { color: var(--color-text-primary); font-size: .78rem; }.relationship-group > p { margin: -3px 0 2px; color: var(--color-text-muted); font-size: .7rem; line-height: 1.45; }.related-rule__content { display: grid; min-width: 0; gap: 3px; }.related-rule__content small { overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.35; }
.probe-card { display: grid; gap: 13px; }.probe-facts { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; margin: 0; }.probe-facts div { padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); }.probe-facts dt { color: var(--color-text-muted); font-size: .68rem; }.probe-facts dd { margin: 5px 0 0; color: var(--color-text-primary); font-size: .78rem; line-height: 1.45; }.probe-heading { color: var(--color-text-primary); font-size: .78rem; }.probe-questions { display: grid; gap: 7px; margin: 0; padding-left: 20px; color: var(--color-text-secondary); font-size: .78rem; line-height: 1.5; }
.probe-question-pattern { padding: 12px; border-left: 3px solid #3b82f6; border-radius: 0 var(--radius-md) var(--radius-md) 0; background: rgba(59,130,246,.08); }.probe-question-pattern strong { color: #93c5fd; font-size: .72rem; }.probe-question-pattern p { margin: 6px 0 0; color: var(--color-text-primary); font-size: .82rem; line-height: 1.55; }.probe-inactive { margin: 0; padding: 10px 12px; border: 1px solid rgba(245,158,11,.28); border-radius: var(--radius-md); background: rgba(245,158,11,.07); color: #fbbf24; font-size: .76rem; line-height: 1.5; }
.probe-question-list { display: grid; gap: 10px; }.probe-question-pattern__meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.probe-question-pattern__meta span { padding: 3px 7px; border-radius: 999px; background: rgba(59,130,246,.14); color: #bfdbfe; font-size: .66rem; }.probe-question-pattern dl { display: grid; gap: 6px; margin: 10px 0 0; }.probe-question-pattern dl div { display: grid; grid-template-columns: 118px 1fr; gap: 8px; }.probe-question-pattern dt { color: var(--color-text-muted); font-size: .68rem; font-weight: 700; }.probe-question-pattern dd { margin: 0; color: var(--color-text-secondary); font-size: .72rem; line-height: 1.45; }
.probe-validation-contract { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }.probe-validation-contract > div { padding: 11px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); }.probe-validation-contract strong { color: var(--color-text-secondary); font-size: .7rem; }.probe-validation-contract p { margin: 6px 0 0; color: var(--color-text-secondary); font-size: .74rem; line-height: 1.5; }.probe-validation-contract .probe-validation-contract--supports { border-color: rgba(16,185,129,.3); background: rgba(16,185,129,.06); }.probe-validation-contract .probe-validation-contract--supports strong { color: #6ee7b7; }.probe-validation-contract .probe-validation-contract--weakens { border-color: rgba(239,68,68,.3); background: rgba(239,68,68,.06); }.probe-validation-contract .probe-validation-contract--weakens strong { color: #fca5a5; }
.action-bar { position: sticky; bottom: -30px; display: flex; align-items: center; justify-content: space-between; gap: 18px; margin: var(--space-5) -30px -30px; padding: 14px 30px; border-top: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-bg-elevated) 94%, transparent); backdrop-filter: blur(10px); }.action-bar strong, .action-bar span { display: block; }.action-bar span { margin-top: 3px; color: var(--color-text-muted); font-size: .72rem; }.action-buttons { display: flex; gap: 10px; }
.modal-overlay { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.64); }.modal-container { width: min(440px,100%); border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg-elevated); box-shadow: 0 20px 60px rgba(0,0,0,.35); }.modal-header, .modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; }.modal-header { border-bottom: 1px solid var(--color-border); }.modal-header h3 { margin: 0; }.modal-header button { border: 0; background: transparent; color: var(--color-text-muted); font-size: 1.5rem; cursor: pointer; }.modal-body { padding: 18px; color: var(--color-text-secondary); }.modal-body p { margin: 0; line-height: 1.55; }.modal-footer { justify-content: flex-end; border-top: 1px solid var(--color-border); }
@media (max-width: 1050px) { .review-layout { grid-template-columns: 280px minmax(0,1fr); }.assessment-grid { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .rule-review-page { height: auto; min-height: calc(100dvh - 72px); overflow: visible; }.page-header { align-items: flex-start; flex-direction: column; }.header-actions { width: 100%; justify-content: flex-start; }.bulk-actions { justify-content: flex-start; }.header-count { display: none; }.review-layout { grid-template-columns: 1fr; }.candidate-list { height: 300px; min-height: 300px; }.rule-document { height: auto; min-height: 620px; }.relationship-flow, .probe-facts, .probe-validation-contract { grid-template-columns: 1fr; }.relationship-arrow { transform: rotate(90deg); justify-self: center; }.action-bar { position: static; flex-direction: column; align-items: stretch; margin: var(--space-5) 0 0; padding: 14px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); }.action-buttons { justify-content: flex-end; } }
</style>
