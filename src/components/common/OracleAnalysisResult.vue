<template>
  <div v-if="analysis" :class="['oracle-result', { 'oracle-result--compact': activeMode === 'compact' }]">
    <!-- ── COMPACT MODE ── -->
    <div v-if="activeMode === 'compact'" class="oracle-compact" @click="handleCompactClick">
      <div class="oracle-compact__header">
        <span class="oracle-compact__icon" aria-hidden="true">◈</span>
        <h4 class="oracle-compact__title">{{ analysis.title }}</h4>
      </div>
      <p class="oracle-compact__summary">{{ analysis.summary }}</p>
      <div class="oracle-compact__footer">
        <span class="oracle-compact__hint">{{ t('oracle.dreamAnalysisCompactHint') }}</span>
      </div>
    </div>

    <!-- ── COLLAPSED PREVIEW MODE (when not expanded) ── -->
    <div v-else-if="activeMode === 'collapsed' && !isExpanded" class="oracle-collapsed" @click="isExpanded = true">
      <div class="oracle-collapsed__header">
        <span class="oracle-collapsed__icon" aria-hidden="true">◈</span>
        <h4 class="oracle-collapsed__title">{{ t('oracle.dreamAnalysisTitle') }}</h4>
      </div>
      <p class="oracle-collapsed__summary">{{ analysis.summary }}</p>
      <div class="oracle-collapsed__footer">
        <button class="oracle-toggle-btn" @click.stop="isExpanded = true">
          {{ t('oracle.dreamAnalysisExpand') }} <span class="arrow">↓</span>
        </button>
      </div>
    </div>

    <!-- ── FULL MODE or EXPANDED COLLAPSED MODE ── -->
    <div v-else class="oracle-full">
      <section v-if="verificationQuestions.length" class="oracle-verification-panel">
        <div class="oracle-verification-panel__intro">
          <span>{{ t('oracle.dreamVerificationTitle') }}</span>
          <p>{{ t('oracle.dreamVerificationDescription') }}</p>
        </div>
        <article v-for="entry in verificationQuestions" :key="questionKey(entry.item, entry.hypothesisIndex)" class="oracle-verification-card">
          <span v-if="entry.item.questionType" class="oracle-feedback__timeframe">{{ formatQuestionType(entry.item) }}</span>
          <p class="oracle-verification-card__question">{{ localizedText(entry.item.localizedFollowUpQuestion, entry.item.followUpQuestion) }}</p>
          <p v-if="localizedText(entry.item.localizedReasonForAsking, entry.item.reasonForAsking)" class="oracle-verification-card__reason">{{ localizedText(entry.item.localizedReasonForAsking, entry.item.reasonForAsking) }}</p>
          <div v-if="entry.item.sources?.length" class="oracle-item__sources oracle-item__sources--inline">
            <span v-for="(src, srcIdx) in entry.item.sources" :key="srcIdx" class="source-citation-wrap">
              <span v-if="srcIdx === 0">{{ t('oracle.dreamVerificationBasis') }}: </span><span v-else class="source-separator">; </span>
              <button type="button" class="source-citation-link" @click="openCitationBySource(src.sourceId)">
                {{ sourceMarker(src.sourceId) }} {{ formatInlineCitation(src) }}
              </button>
            </span>
          </div>
          <div v-if="showHypothesisActions" class="oracle-feedback__actions">
            <AppFeedbackChoiceGroup
              :model-value="(feedbackSelections[questionKey(entry.item, entry.hypothesisIndex)] as 'yes' | 'no' | 'unsure' | undefined)"
              @update:model-value="selectFeedback(entry.hypothesisIndex, $event)"
            />
          </div>
          <p v-if="feedbackSelections[questionKey(entry.item, entry.hypothesisIndex)] === 'yes' && localizedText(entry.item.localizedIfYesMeaning, entry.item.ifYesMeaning)" class="oracle-verification-card__result">{{ localizedText(entry.item.localizedIfYesMeaning, entry.item.ifYesMeaning) }}</p>
          <p v-else-if="feedbackSelections[questionKey(entry.item, entry.hypothesisIndex)] === 'no' && localizedText(entry.item.localizedIfNoMeaning, entry.item.ifNoMeaning)" class="oracle-verification-card__result">{{ localizedText(entry.item.localizedIfNoMeaning, entry.item.ifNoMeaning) }}</p>
          <p v-else-if="feedbackSelections[questionKey(entry.item, entry.hypothesisIndex)] === 'unsure'" class="oracle-verification-card__result">{{ t('oracle.dreamVerificationUnsure') }}</p>
          <span
            v-if="entry.item.ruleScore !== undefined && scoreDelta(entry.item)"
            class="oracle-rule-score-change"
            :class="{ 'oracle-rule-score-change--down': scoreDelta(entry.item) < 0 }"
          >
            {{ scoreDelta(entry.item) > 0 ? '+' : '' }}{{ scoreDelta(entry.item) }} · {{ entry.item.ruleScore }}/100
          </span>
        </article>
      </section>

      <!-- Header -->
      <header class="oracle-full__header">
        <div class="oracle-full__title-row">
          <div class="oracle-full__title-wrap">
            <span class="oracle-full__icon" aria-hidden="true">◈</span>
            <h2 class="oracle-full__title">{{ analysis.title }}</h2>
          </div>
          <!-- Collapse Button in Header -->
          <button v-if="activeMode === 'collapsed'" class="oracle-toggle-btn oracle-toggle-btn--header" @click="isExpanded = false">
            {{ t('oracle.dreamAnalysisCollapse') }} <span class="arrow">↑</span>
          </button>
        </div>
      </header>

      <!-- Summary -->
      <section class="oracle-section">
        <h3 class="oracle-section__title">{{ t('oracle.dreamSummaryTitle') }}</h3>
        <p class="oracle-section__text">
          <template v-for="(part, partIdx) in splitOracleInlineParts(analysis.summary)" :key="`summary-${partIdx}`">
            <button
              v-if="part.citationIndex"
              type="button"
              class="source-citation-link oracle-inline-marker"
              @click="openCitationByIndex(part.citationIndex)"
            >[{{ part.citationIndex }}]</button>
            <span
              v-else-if="part.unsupported"
              class="oracle-inline-marker oracle-inline-marker--unsupported"
              :title="t('oracle.unsupportedClaimHelp')"
            >[?]</span>
            <strong v-else-if="part.strong">{{ part.text }}</strong>
            <span v-else>{{ part.text }}</span>
          </template>
        </p>
      </section>

      <!-- Core Analysis -->
      <section class="oracle-section">
        <h3 class="oracle-section__title">{{ t('oracle.dreamReasoningTitle') }}</h3>
        <p class="oracle-section__text oracle-section__text--spaced">
          <template v-for="(segment, segmentIdx) in feedbackSegments(analysis.core_analysis, 'core_analysis')" :key="`core-${segmentIdx}`">
            <template v-for="(part, partIdx) in splitOracleInlineParts(segment.text)" :key="`core-${segmentIdx}-${partIdx}`">
              <button
                v-if="part.citationIndex"
                type="button"
                class="source-citation-link oracle-inline-marker"
                @click="openCitationByIndex(part.citationIndex)"
              >[{{ part.citationIndex }}]</button>
              <span
                v-else-if="part.unsupported"
                class="oracle-inline-marker oracle-inline-marker--unsupported"
                :title="t('oracle.unsupportedClaimHelp')"
              >[?]</span>
              <mark v-else-if="segment.changed" class="oracle-text--feedback-changed">{{ part.text }}</mark>
              <strong v-else-if="part.strong">{{ part.text }}</strong>
              <span v-else>{{ part.text }}</span>
            </template>
          </template>
        </p>
      </section>

      <section v-if="analysis.interpretive_threads?.length" class="oracle-section">
        <h3 class="oracle-section__title">{{ t('oracle.dreamThreadsTitle') }}</h3>
        <ul class="oracle-list oracle-list--threads">
          <li v-for="(thread, idx) in analysis.interpretive_threads" :key="idx" class="oracle-item oracle-thread">
            <div class="oracle-item__header">
              <span class="oracle-item__name">{{ thread.title }}</span>
            </div>
            <p class="oracle-item__desc">
              <template v-for="(segment, segmentIdx) in feedbackSegments(thread.reasoning, `interpretive_threads.${idx}.reasoning`)" :key="`thread-reason-${idx}-${segmentIdx}`">
                <template v-for="(part, partIdx) in splitOracleInlineParts(segment.text)" :key="`thread-${idx}-${segmentIdx}-${partIdx}`">
                  <button
                    v-if="part.citationIndex"
                    type="button"
                    class="source-citation-link oracle-inline-marker"
                    @click="openCitationByIndex(part.citationIndex)"
                  >[{{ part.citationIndex }}]</button>
                  <span
                    v-else-if="part.unsupported"
                    class="oracle-inline-marker oracle-inline-marker--unsupported"
                    :title="t('oracle.unsupportedClaimHelp')"
                  >[?]</span>
                  <mark v-else-if="segment.changed" class="oracle-text--feedback-changed">{{ part.text }}</mark>
                  <strong v-else-if="part.strong">{{ part.text }}</strong>
                  <span v-else>{{ part.text }}</span>
                </template>
              </template>
            </p>
            <div class="oracle-item__evidence">
              <span class="evidence-label">{{ t('oracle.dreamConnectedDetails') }}</span>
              <span v-for="(ev, evIdx) in thread.dreamEvidence" :key="evIdx" class="evidence-tag">“{{ ev }}”</span>
            </div>
            <p class="oracle-thread__alternative"><strong>{{ t('oracle.dreamAlternativeMeaning') }}</strong>
              <template v-for="(segment, segmentIdx) in feedbackSegments(thread.alternativeExplanation, `interpretive_threads.${idx}.alternativeExplanation`)" :key="`thread-alt-${idx}-${segmentIdx}`">
                <mark v-if="segment.changed" class="oracle-text--feedback-changed">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span>
              </template>
            </p>
          </li>
        </ul>
      </section>

      <!-- Symbolic Notes -->
      <section class="oracle-section">
        <h3 class="oracle-section__title">{{ t('oracle.dreamMotifsTitle') }}</h3>
        <div v-if="!analysis.symbolic_notes || analysis.symbolic_notes.length === 0" class="oracle-section__empty">
          {{ t('oracle.dreamMotifsEmpty') }}
        </div>
        <ul v-else class="oracle-list oracle-list--motifs">
          <li v-for="(note, idx) in analysis.symbolic_notes" :key="idx" class="oracle-item oracle-motif-card">
            <div class="oracle-motif-card__label">
              <span class="oracle-item__name">{{ note.symbol }}</span>
              <span class="oracle-motif-card__origin">
                {{ motifOriginLabel(note) }}
              </span>
              <span v-if="note.contextualTone && note.contextualTone !== 'neutral'" class="oracle-context-tone">
                {{ t('oracle.dreamSceneEmotion', { tone: getContextToneLabel(note.contextualTone) }) }}
              </span>
            </div>
            <div class="oracle-motif-card__body">
              <p class="oracle-item__desc">
                <template v-for="(segment, segmentIdx) in feedbackSegments(note.meaning, `symbolic_notes.${idx}.meaning`)" :key="`motif-${idx}-${segmentIdx}`">
                  <mark v-if="segment.changed" class="oracle-text--feedback-changed">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span>
                </template>
              </p>
              <p v-if="note.dreamEvidence" class="oracle-item__grounding">
                <span>{{ t('oracle.dreamInNarrative') }}</span>
                “{{ note.dreamEvidence }}”
              </p>
              <div v-if="hasMotifHistory(note)" class="oracle-motif-card__history">
                <span>{{ t('oracle.dreamObservedCases') }}</span>
                <div>
                  <span v-if="note.motifStats?.previousPersonalDreamCount">{{ t('oracle.dreamPersonalMotifCount', { count: note.motifStats.previousPersonalDreamCount }) }}</span>
                  <span v-if="note.motifStats?.similarDreamCount">{{ t('oracle.dreamSimilarMotifCount', { count: note.motifStats.similarDreamCount }) }}</span>
                  <span v-if="note.motifStats?.sameSequenceCount">{{ t('oracle.dreamSequenceMotifCount', { count: note.motifStats.sameSequenceCount }) }}</span>
                  <span v-if="note.motifStats?.confirmedContextCount">{{ t('oracle.dreamConfirmedMotifCount', { count: note.motifStats.confirmedContextCount }) }}</span>
                  <span v-if="note.motifStats?.observedPublicDreamCount">{{ t('oracle.dreamPublicMotifCount', { count: note.motifStats.observedPublicDreamCount }) }}</span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="referenceSources.length" class="oracle-section oracle-sources">
        <h3 class="oracle-section__title">{{ t('oracle.references') }}</h3>
        <div class="oracle-sources__list">
          <button
            v-for="source in referenceSources"
            :key="source.key"
            type="button"
            class="oracle-source-card"
            @click="openCitation(source)"
          >
            <span class="oracle-source-card__index">[{{ source.index }}]</span>
            <span class="oracle-source-card__content">
              <strong>{{ source.title || t('oracle.academicSource') }}</strong>
              <small>{{ source.year || '' }}<template v-if="source.doi"> · {{ source.doi }}</template></small>
            </span>
            <AppIcon class="oracle-source-card__open" name="external-link" :size="14" />
          </button>
        </div>
      </section>

      <!-- Cultural Symbolic Notes -->
      <section v-if="culturalNotesToShow.length > 0" class="oracle-section">
        <h3 class="oracle-section__title">{{ t('oracle.dreamCulturalTitle') }}</h3>
        <ul class="oracle-list">
          <li v-for="(note, idx) in culturalNotesToShow" :key="idx" class="oracle-item">
            <div v-if="hasRealSource(note.source)" class="oracle-item__header">
              <span class="oracle-item__name">{{ t('oracle.dreamSourceLabel') }}: {{ note.source }}</span>
            </div>
            <p class="oracle-item__desc">{{ note.note }}</p>
          </li>
        </ul>
      </section>

      <section v-if="analysis.practical_reflections?.length" class="oracle-section">
        <div class="oracle-section-heading">
          <h3 class="oracle-section__title">{{ t('oracle.dreamPracticalTitle') }}</h3>
          <p>{{ t('oracle.dreamPracticalDescription') }}</p>
        </div>
        <ol class="oracle-reflections">
          <li v-for="(item, idx) in analysis.practical_reflections" :key="idx" class="oracle-reflection">
            <div class="oracle-reflection__number">{{ idx + 1 }}</div>
            <div>
              <p>
                <template v-for="(segment, segmentIdx) in feedbackSegments(item.suggestion, `practical_reflections.${idx}.suggestion`)" :key="`reflection-${idx}-${segmentIdx}`">
                  <mark v-if="segment.changed" class="oracle-text--feedback-changed">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span>
                </template>
              </p>
              <span>{{ t('oracle.dreamPracticalReason') }}
                <template v-for="(segment, segmentIdx) in feedbackSegments(item.rationale, `practical_reflections.${idx}.rationale`)" :key="`rationale-${idx}-${segmentIdx}`">
                  <mark v-if="segment.changed" class="oracle-text--feedback-changed">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span>
                </template>
              </span>
            </div>
          </li>
        </ol>
      </section>

      <details v-if="analysis.grounding_summary" class="oracle-grounding-audit">
        <summary>{{ t('oracle.dreamGroundingTitle') }}</summary>
        <div class="oracle-grounding-audit__grid">
          <span>{{ t('oracle.dreamGroundingNarrative') }} <strong>{{ analysis.grounding_summary.narrativeUsed ? t('oracle.used') : t('oracle.none') }}</strong></span>
          <span>{{ t('oracle.dreamGroundingResolved') }} <strong>{{ analysis.grounding_summary.resolvedContextCount }}</strong></span>
          <span>{{ t('oracle.dreamGroundingOpen') }} <strong>{{ analysis.grounding_summary.unresolvedContextCount }}</strong></span>
          <span>{{ t('oracle.dreamGroundingDictionary') }} <strong>{{ analysis.grounding_summary.dictionaryMotifCount }}</strong></span>
          <span>{{ t('oracle.dreamGroundingContextual') }} <strong>{{ analysis.grounding_summary.contextualMotifCount }}</strong></span>
          <span>{{ t('oracle.dreamGroundingRules') }} <strong>{{ analysis.grounding_summary.appliedRuleCount }}</strong></span>
          <span>{{ t('oracle.dreamGroundingMechanisms') }} <strong>{{ analysis.grounding_summary.explanatoryRuleCount }}</strong></span>
          <span>{{ t('oracle.dreamGroundingExploratory') }} <strong>{{ analysis.grounding_summary.exploratoryRuleCount ?? 0 }}</strong></span>
          <span>{{ t('oracle.dreamGroundingSimilar') }} <strong>{{ analysis.grounding_summary.similarDreamCount }}</strong></span>
          <span>{{ t('oracle.dreamGroundingSleep') }} <strong>{{ analysis.grounding_summary.sleepContextFactCount ?? 0 }}</strong></span>
        </div>
        <p v-if="analysis.grounding_summary.explanatoryRuleCount === 0 && (analysis.grounding_summary.exploratoryRuleCount ?? 0) > 0">
          {{ t('oracle.dreamGroundingWeak') }}
        </p>
        <p v-else-if="analysis.grounding_summary.explanatoryRuleCount === 0">
          {{ t('oracle.dreamGroundingWithoutRule') }}
        </p>
        <p v-else>
          {{ t('oracle.dreamGroundingWithRule') }}
        </p>
      </details>

      <section v-if="analysis.similar_dreams?.length" class="oracle-section oracle-similar">
        <div class="oracle-section-heading">
          <h3 class="oracle-section__title">{{ t('oracle.dreamSimilarTitle') }}</h3>
          <p>{{ t('oracle.dreamSimilarDescription') }}</p>
        </div>
        <div class="oracle-similar__rail">
          <button
            v-for="item in analysis.similar_dreams"
            :key="item.dreamId"
            type="button"
            class="oracle-similar__card"
            @click="openSimilarDream(item.dreamId)"
          >
            <div class="oracle-similar__topline">
              <span>{{ item.sameAuthor ? t('oracle.dreamPreviousOwn') : item.authorDisplayName }}</span>
              <strong>{{ item.similarity }}%</strong>
            </div>
            <h4>{{ item.title }}</h4>
            <p>{{ item.excerpt }}</p>
            <span class="oracle-similar__open">{{ t('oracle.dreamOpenPost') }} <span aria-hidden="true">→</span></span>
          </button>
        </div>
      </section>

      <!-- Disclaimer -->
      <footer class="oracle-disclaimer">
        <p>{{ analysis.disclaimer }}</p>
        <!-- Collapse Button at bottom of disclaimer -->
        <div v-if="activeMode === 'collapsed'" class="oracle-full__footer">
          <button class="oracle-toggle-btn" @click="isExpanded = false">
            {{ t('oracle.dreamAnalysisCollapse') }} <span class="arrow">↑</span>
          </button>
        </div>
      </footer>

      <section v-if="analysis.creative_continuation || continuationPending" class="oracle-continuation">
        <header class="oracle-continuation__header">
          <span>{{ t('oracle.dreamContinuationTitle') }}</span>
          <small>{{ t('oracle.dreamContinuationSubtitle') }}</small>
        </header>
        <div class="oracle-continuation__body">
          <div v-if="continuationPending" class="oracle-continuation__progress-state">
            <div class="oracle-continuation__progress" :aria-label="t('oracle.continuationProgressLabel')">
              <span :style="{ width: `${continuationProgress}%` }"></span>
            </div>
            <span>{{ continuationProgress }}%</span>
            <p v-if="!displayedContinuation" class="oracle-continuation__status">
              {{ continuationStatusMessage }}
            </p>
          </div>
          <template v-if="displayedContinuation">
            <h3>{{ displayedContinuation.title }}</h3>
            <div
              class="oracle-continuation__story-wrap"
              :class="{ 'oracle-continuation__story-wrap--collapsed': continuationCanCollapse && !continuationExpanded }"
            >
              <p class="oracle-continuation__story" translate="no">{{ displayedContinuation.continuation }}</p>
            </div>
            <button
              v-if="continuationCanCollapse"
              type="button"
              class="oracle-continuation__expand"
              @click="continuationExpanded = !continuationExpanded"
            >
              <span>{{ t(continuationExpanded ? 'oracle.continuationCollapse' : 'oracle.continuationExpand') }}</span>
              <span class="oracle-continuation__expand-icon" aria-hidden="true">
                {{ continuationExpanded ? '⌃' : '⌄' }}
              </span>
            </button>
            <p class="oracle-continuation__connection"><strong>{{ t('oracle.dreamContinuationConnection') }}</strong> {{ displayedContinuation.connectionToCurrentDream }}</p>
            <div v-if="displayedContinuation.inspirations?.length" class="oracle-continuation__inspirations">
              <strong>{{ t('oracle.dreamContinuationInspirations') }}</strong>
              <button
                v-for="item in displayedContinuation.inspirations"
                :key="item.dreamId"
                type="button"
                @click="openSimilarDream(item.dreamId)"
              >
                {{ item.title }} · {{ item.similarity }}%
              </button>
            </div>
            <small>{{ displayedContinuation.disclaimer }}</small>
          </template>
          <div v-if="canManageContinuation && displayedContinuation" class="oracle-continuation__controls">
            <nav :aria-label="t('oracle.dreamContinuationHistory')">
              <button type="button" :disabled="continuationIndex === 0" @click="continuationIndex--">‹</button>
              <span>{{ continuationIndex + 1 }} / {{ continuationVersions.length }}</span>
              <button type="button" :disabled="continuationIndex === continuationVersions.length - 1" @click="continuationIndex++">›</button>
            </nav>
            <button
              type="button"
              class="oracle-continuation__reload"
              :title="continuationLoading ? t('oracle.continuationRegenerating') : t('oracle.dreamContinuationRegenerate')"
              :aria-label="continuationLoading ? t('oracle.continuationRegenerating') : t('oracle.dreamContinuationRegenerate')"
              :disabled="continuationLoading"
              @click="regenerateContinuation"
            >
              <span
                aria-hidden="true"
                :class="{ 'oracle-continuation__spinner': continuationLoading }"
              >↻</span>
            </button>
          </div>
        </div>
      </section>
    </div>
    <OracleCitationModal
      v-model="citationModalOpen"
      message-id=""
      feedback-origin="dream"
      :dream-id="dreamId"
      :citation="selectedCitation"
      @open-source="navigateToSource"
      @feedback-updated="applyCitationFeedback"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type {
  AiDreamAnalysisResult,
  AiRealLifeHypothesis,
  AiSymbolicNote,
  ApiDream,
} from '@/api/types'
import { useSettingsStore } from '@/store/useSettingsStore'
import { usePostStore } from '@/store/usePostStore'
import { useDreamStore } from '@/store/useDreamStore'
import apiClient from '@/api/client'
import AppFeedbackChoiceGroup, { type FeedbackChoice } from '@/components/common/AppFeedbackChoiceGroup.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import OracleCitationModal from '@/features/oracle/components/OracleCitationModal.vue'
import type {
  DreamHypothesisFeedbackResponse,
  OracleCitationDto,
  OracleRuleScoreUpdateDto,
} from '@/api/oracleApi'
import { useDreamContinuationStore } from '@/store/useDreamContinuationStore'
import { splitOracleInlineParts } from '@/features/oracle/services/oracleInlineContent.service'
import {
  buildDreamCitationSources,
  selectDreamVerificationQuestions,
  type DreamCitationSource,
} from '@/features/oracle/services/dreamCitationPresentation.service'

const props = withDefaults(defineProps<{
  analysis: AiDreamAnalysisResult | null | undefined
  compact?: boolean
  showHypothesisActions?: boolean
  mode?: 'compact' | 'collapsed' | 'full'
  dreamId?: string
  canManageContinuation?: boolean
}>(), {
  compact: false,
  showHypothesisActions: false,
  mode: 'full',
  canManageContinuation: false,
})

const emit = defineEmits<{
  'view-details': []
}>()

// Active Mode computed: maps compact prop to mode string
const activeMode = computed(() => {
  if (props.compact) return 'compact'
  return props.mode
})

const router = useRouter()
const { t, locale } = useI18n({ useScope: 'global' })

interface CitationDisplaySource {
  authors?: string[] | string
  title?: string
  year?: number
}

function localizedText(
  localized: { vi?: string; en?: string } | undefined,
  fallback?: string,
): string {
  const language = locale.value.toLowerCase().startsWith('vi') ? 'vi' : 'en'
  return String(localized?.[language] || fallback || '')
}

function formatCitationText(src: CitationDisplaySource | null | undefined): string {
  if (!src) return t('oracle.academicSource')
  let citation = ''
  const authors = src.authors
  if (authors && (Array.isArray(authors) ? authors.length > 0 : String(authors).trim() !== '')) {
    if (Array.isArray(authors)) {
      const cleanAuthors = authors.filter(a => a && a !== 'N/A' && a !== 'null')
      if (cleanAuthors.length === 0) {
        citation = ''
      } else if (cleanAuthors.length <= 2) {
        citation = cleanAuthors.join(', ')
      } else {
        citation = `${cleanAuthors[0]} et al.`
      }
    } else {
      citation = String(authors)
    }
  }
  
  if (!citation && src.title) {
    const cleanTitle = src.title.trim()
    const words = cleanTitle.split(/\s+/)
    if (words.length > 4) {
      citation = `"${words.slice(0, 4).join(' ')}..."`
    } else {
      citation = `"${cleanTitle}"`
    }
  }
  
  if (!citation) {
    citation = t('oracle.academicSource')
  }
  
  if (src.year) {
    citation += ` (${src.year})`
  }
  
  return citation
}

function formatInlineCitation(src: CitationDisplaySource): string {
  return formatCitationText(src).replace(/^"|"$/g, '')
}

function navigateToSource(sourceId: string) {
  if (!sourceId) return
  if (!router) return
  router.push(`/library/sources/${sourceId}`).catch(() => {
    settingsStore.showToast(t('oracle.sourceDetailsLoadFailed'), 'error')
  })
}

async function openSimilarDream(dreamId: string) {
  if (!dreamId) return
  await postStore.openPost(dreamId)
}

function formatQuestionType(item: AiRealLifeHypothesis): string {
  if (item?.questionBasis === 'sleep_context') return t('oracle.dreamQuestionSleepContext')
  const type = item?.questionType as 'past' | 'present' | 'future'
  if (type === 'past') return t('oracle.dreamQuestionPast')
  if (type === 'future') return t('oracle.dreamQuestionFuture')
  return t('oracle.dreamQuestionPresent')
}

// Expanded state
const isExpanded = ref(activeMode.value === 'full')
const feedbackSelections = ref<Record<string, string>>({})

// A feedback response replaces the analysis payload. Watching that object made
// the open result collapse after every answer. Only a different post or mode
// may reset expansion state.
watch(() => props.dreamId, () => {
  isExpanded.value = activeMode.value === 'full'
})

watch(() => props.mode, (newMode) => {
  isExpanded.value = newMode === 'full'
})

function questionKey(item: AiRealLifeHypothesis | undefined, idx: number): string {
  return String(item?.verificationKey || `question-${idx}`)
}

function feedbackSegments(value: unknown, path: string): Array<{ text: string; changed: boolean }> {
  const text = String(value || '')
  const fragments = (props.analysis?.feedback_changed_fragments?.[path] || [])
    .map(fragment => String(fragment || '').trim())
    .filter(Boolean)
  if (!text || fragments.length === 0) return [{ text, changed: false }]

  const segments: Array<{ text: string; changed: boolean }> = []
  let cursor = 0
  while (cursor < text.length) {
    const matches = fragments
      .map(fragment => ({ fragment, index: text.indexOf(fragment, cursor) }))
      .filter(match => match.index >= cursor)
      .sort((left, right) => left.index - right.index || right.fragment.length - left.fragment.length)
    const next = matches[0]
    if (!next) {
      segments.push({ text: text.slice(cursor), changed: false })
      break
    }
    if (next.index > cursor) segments.push({ text: text.slice(cursor, next.index), changed: false })
    segments.push({ text: next.fragment, changed: true })
    cursor = next.index + next.fragment.length
  }
  return segments.length ? segments : [{ text, changed: false }]
}

const verificationQuestions = computed(() =>
  selectDreamVerificationQuestions(props.analysis))
const referenceSources = computed(() =>
  buildDreamCitationSources(props.analysis, t('oracle.academicSource')))

const selectedCitation = ref<OracleCitationDto | null>(null)
const citationModalOpen = ref(false)

watch(referenceSources, sources => {
  if (!citationModalOpen.value || !selectedCitation.value) return
  const sourceStillExists = sources.some(source =>
    source.sourceId === selectedCitation.value?.sourceId
    && source.index === selectedCitation.value?.index)
  if (sourceStillExists) return
  citationModalOpen.value = false
  selectedCitation.value = null
})

function sourceMarker(sourceId: string): string {
  const source = referenceSources.value.find(item => item.sourceId === sourceId)
  return source ? `[${source.index}]` : ''
}

function scoreDelta(item: AiRealLifeHypothesis): number {
  return Number(item?.ruleVoteDelta ?? item?.ruleScoreDelta) || 0
}

function openCitation(source: DreamCitationSource) {
  selectedCitation.value = {
    index: Number(source.index) || 1,
    sourceType: source.sourceType || 'academic_source',
    sourceId: String(source.sourceId || ''),
    title: String(source.title || t('oracle.academicSource')),
    year: source.year,
    excerpt: String(source.quote || ''),
    ruleLinks: source.ruleLinks || [],
  }
  citationModalOpen.value = true
}

function openCitationBySource(sourceId: string) {
  const source = referenceSources.value.find(item => item.sourceId === sourceId)
  if (source) openCitation(source)
}

function openCitationByIndex(index: number) {
  const source = referenceSources.value.find(item => item.index === index)
  if (source) openCitation(source)
}

function applyCitationFeedback(payload: { analysis?: AiDreamAnalysisResult }) {
  if (payload?.analysis) applyDreamAnalysisUpdate(payload.analysis)
}

function hasMotifHistory(note: AiSymbolicNote): boolean {
  const stats = note?.motifStats
  return Boolean(stats && (
    stats.previousPersonalDreamCount
    || stats.similarDreamCount
    || stats.sameSequenceCount
    || stats.confirmedContextCount
    || stats.observedPersonalDreamCount
    || stats.observedPublicDreamCount
  ))
}

function syncFeedbackSelections(analysis: AiDreamAnalysisResult | null | undefined) {
  const selections: Record<string, string> = {}
  for (const [index, item] of (analysis?.real_life_hypotheses || []).entries()) {
    if (item.userFeedback) selections[questionKey(item, index)] = item.userFeedback
  }
  feedbackSelections.value = selections
}

watch(() => props.analysis, syncFeedbackSelections, { immediate: true })

const settingsStore = useSettingsStore()
const postStore = usePostStore()
const dreamStore = useDreamStore()
const continuationStore = useDreamContinuationStore()
const continuationTask = computed(() => props.dreamId
  ? continuationStore.findTask(props.dreamId)
  : undefined)

function applyDreamAnalysisUpdate(refreshedAnalysis: AiDreamAnalysisResult) {
  if (props.analysis) Object.assign(props.analysis, refreshedAnalysis)
  syncFeedbackSelections(refreshedAnalysis)

  const targetDreamId = props.dreamId || postStore.focusedDream?._id
  if (!targetDreamId) return
  if (postStore.focusedDream?._id === targetDreamId) {
    postStore.focusedDream.ai_result = refreshedAnalysis
    postStore.focusedDream.aiAnalysis = refreshedAnalysis
  }
  const storedDream = dreamStore.dreams.find(dream => dream._id === targetDreamId)
  if (storedDream) {
    storedDream.ai_result = refreshedAnalysis
    storedDream.aiAnalysis = refreshedAnalysis
  }
}
const continuationLoading = computed(() => continuationTask.value?.status === 'pending')
const continuationProgress = computed(() => continuationTask.value?.progress || 0)
const continuationPending = computed(() =>
  continuationLoading.value
  || ['queued', 'running'].includes(String(props.analysis?.continuationMetadata?.status || '')),
)
const continuationStatusMessage = computed(() =>
  continuationTask.value?.statusMessage
  || String(props.analysis?.continuationMetadata?.statusMessage || t('oracle.continuationReturning')),
)
const continuationIndex = ref(0)
const continuationExpanded = ref(false)
const continuationVersions = computed(() => {
  const stored = props.analysis?.creative_continuation_history || []
  if (stored.length) return stored
  return props.analysis?.creative_continuation ? [props.analysis.creative_continuation] : []
})
const displayedContinuation = computed(() =>
  continuationVersions.value[continuationIndex.value]
  || props.analysis?.creative_continuation,
)
const continuationCanCollapse = computed(() =>
  String(displayedContinuation.value?.continuation || '').length > 650)

watch(continuationVersions, (versions) => {
  const storedIndex = Number(props.analysis?.creative_continuation_index)
  continuationIndex.value = Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < versions.length
    ? storedIndex
    : Math.max(0, versions.length - 1)
}, { immediate: true })

watch([() => props.dreamId, continuationIndex], () => {
  continuationExpanded.value = false
})

watch(() => continuationTask.value?.dream, dream => {
  if (!dream?.ai_result || !props.analysis) return
  Object.assign(props.analysis, dream.ai_result)
}, { deep: false })

watch(
  () => props.analysis?.continuationMetadata,
  metadata => {
    if (!props.dreamId || !metadata || !['queued', 'running'].includes(String(metadata.status))) return
    continuationStore.track({
      _id: props.dreamId,
      ai_result: props.analysis,
      continuationMetadata: metadata,
    } as ApiDream, 'dialog')
  },
  { immediate: true, deep: true },
)

watch(() => continuationTask.value?.status, (status, previous) => {
  if (status === 'completed' && previous === 'pending') {
    settingsStore.showToast(t('oracle.continuationRegenerated'), 'success')
  } else if (status === 'failed' && previous === 'pending') {
    settingsStore.showToast(t('oracle.continuationRegenerateFailed'), 'error')
  }
})

onUnmounted(() => {
  if (props.dreamId) continuationStore.pin(props.dreamId)
})

async function selectFeedback(hypothesisIdx: number, val: FeedbackChoice | null) {
  const targetDreamId = props.dreamId || postStore.focusedDream?._id
  if (!targetDreamId) {
    settingsStore.showToast(t('oracle.dreamFeedbackSaveFailed'), 'error')
    return
  }

  const hypothesisItem = props.analysis?.real_life_hypotheses?.[hypothesisIdx]
  const feedbackKey = questionKey(hypothesisItem, hypothesisIdx)
  const questionText = hypothesisItem?.followUpQuestion || ''
  const submittedAnswer = val

  try {
    const response = await apiClient.post<DreamHypothesisFeedbackResponse>(
      `/dreams/${targetDreamId}/hypothesis-feedback`,
      {
      hypothesisIndex: hypothesisIdx,
      verificationKey: hypothesisItem?.verificationKey,
      answer: submittedAnswer,
      questionText
      },
    )

    if (response.data.success) {
      if (submittedAnswer === null) delete feedbackSelections.value[feedbackKey]
      else feedbackSelections.value[feedbackKey] = submittedAnswer
      const refreshedAnalysis = response.data.data?.analysis
      if (refreshedAnalysis) {
        applyDreamAnalysisUpdate(refreshedAnalysis)
      } else if (props.analysis) {
        props.analysis.feedback_revision = response.data.data?.feedbackRevision || []
        props.analysis.feedback_conclusion = response.data.data?.feedbackConclusion || null
      }
      const scoreUpdates = Array.isArray(response.data.data?.ruleScoreUpdates)
        ? response.data.data.ruleScoreUpdates
        : []
      const directDelta = scoreUpdates
        .filter((item: OracleRuleScoreUpdateDto) => item.relation === 'direct')
        .reduce((total, item) => total + (Number(item.voteDelta ?? item.scoreDelta) || 0), 0)
      const scoreMessage = directDelta > 0
        ? t('oracle.dreamFeedbackScoreAdded', { score: directDelta })
        : directDelta < 0
          ? t('oracle.dreamFeedbackScoreRemoved', { score: Math.abs(directDelta) })
          : submittedAnswer === null
            ? t('oracle.dreamFeedbackCleared')
            : t('oracle.dreamFeedbackSaved')
      settingsStore.showToast(scoreMessage, 'success')

    }
  } catch (error: unknown) {
    console.error('Failed to save dream feedback:', error)
    settingsStore.showToast(t('oracle.dreamFeedbackSaveFailed'), 'error')
  }
}

async function regenerateContinuation() {
  if (!props.dreamId || continuationLoading.value) return
  try {
    continuationExpanded.value = false
    await continuationStore.start(props.dreamId)
  } catch {
    settingsStore.showToast(t('oracle.continuationRegenerateFailed'), 'error')
  }
}

function handleCompactClick() {
  emit('view-details')
}

function getContextToneLabel(tone?: string): string {
  if (tone === 'reassuring') return t('oracle.dreamToneReassuring')
  if (tone === 'threatening') return t('oracle.dreamToneThreatening')
  if (tone === 'ambivalent') return t('oracle.dreamToneAmbivalent')
  return t('oracle.dreamToneUnclear')
}

function motifOriginLabel(note: AiSymbolicNote): string {
  if (note.origin === 'dictionary') {
    return note.dictionarySymbol
      ? t('oracle.dreamMotifDictionaryNamed', { symbol: note.dictionarySymbol })
      : t('oracle.dreamMotifDictionary')
  }
  return hasMotifHistory(note)
    ? t('oracle.dreamMotifObserved')
    : t('oracle.dreamMotifContextual')
}

const culturalNotesToShow = computed(() => {
  const notes = props.analysis?.cultural_symbolic_notes
  if (!notes) return []
  return notes.filter(note => {
    if (!note.note) return false
    const noteText = note.note.trim()
    const sourceText = (note.source || '').trim()
    
    // Identify fallback indicators
    const isFallbackNote = noteText.toLowerCase().includes('không có thông tin cụ thể') || 
                           noteText.toLowerCase().includes('khó kết nối') ||
                           noteText.toLowerCase().includes('không tìm thấy giải mã') ||
                           noteText.toLowerCase().includes('không có giải mã văn hóa');
    
    // Identify fallback sources
    const isFallbackSource = !sourceText || 
                             sourceText.toLowerCase() === 'n/a' || 
                             sourceText.toLowerCase() === 'unknown' || 
                             sourceText.toLowerCase() === 'chưa rõ' ||
                             sourceText.toLowerCase() === 'không có';
                             
    if (isFallbackNote && isFallbackSource) {
      return false
    }
    return true
  })
})

function hasRealSource(source: string | undefined | null): boolean {
  if (!source) return false
  const src = source.trim().toLowerCase()
  return src !== '' && src !== 'n/a' && src !== 'unknown' && src !== 'chưa rõ' && src !== 'không có'
}
</script>

<style scoped>
.oracle-result {
  color: var(--color-text-primary);
  width: 100%;
}

/* ══════════════════════════════════════════
   COMPACT MODE
   Matches the existing .dream-card__oracle style
   but handles multiline nicely.
   ═══════════════════════════════════════════ */
.oracle-compact {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg, 8px);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.oracle-compact:hover {
  border-color: #3a3a3a;
  background: var(--color-bg-hover);
}

.oracle-compact__header {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
}

.oracle-compact__icon {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1;
}

.oracle-compact__title {
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
  margin: 0;
}

.oracle-compact__summary {
  font-size: var(--font-size-xs, 0.75rem);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal, 1.5);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.oracle-compact__footer {
  display: flex;
  align-items: center;
  margin-top: 2px;
}

.oracle-compact__hint {
  font-size: var(--font-size-xs, 0.75rem);
  color: var(--color-text-muted);
  font-style: italic;
  text-decoration: underline;
}

/* ══════════════════════════════════════════
   COLLAPSED PREVIEW MODE
   ═══════════════════════════════════════════ */
.oracle-collapsed {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  padding: var(--space-4, 16px);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg, 8px);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.oracle-collapsed:hover {
  border-color: #3a3a3a;
  background: var(--color-bg-hover);
}

.oracle-collapsed__header {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
}

.oracle-collapsed__icon {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1;
}

.oracle-collapsed__title {
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
  margin: 0;
}

.oracle-collapsed__summary {
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal, 1.5);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.oracle-collapsed__footer {
  display: flex;
  align-items: center;
  margin-top: 2px;
}

/* Toggle buttons */
.oracle-toggle-btn {
  background: transparent;
  border: none;
  color: var(--color-primary, #60a5fa);
  cursor: pointer;
  font-size: var(--font-size-xs, 0.75rem);
  font-weight: var(--font-weight-semibold, 600);
  padding: var(--space-1) 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color var(--transition-fast);
}
.oracle-toggle-btn:hover {
  color: #3b82f6;
}
.oracle-toggle-btn .arrow {
  transition: transform var(--transition-fast);
}

.oracle-toggle-btn--header {
  padding: var(--space-1) var(--space-3);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
}
.oracle-toggle-btn--header:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: #3a3a3a;
}

.oracle-full__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-4);
}

/* ══════════════════════════════════════════
   FULL MODE
   Clean, strictly flat, no glows or gradients.
   ═══════════════════════════════════════════ */
.oracle-full {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
}

.oracle-verification-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  margin-bottom: var(--space-5, 20px);
  padding: var(--space-4, 16px);
  border: 1px solid #2b4054;
  border-radius: var(--radius-lg, 8px);
  background: #111923;
}

.oracle-verification-panel__intro span {
  color: #a9c8e8;
  font-size: var(--font-size-sm, .875rem);
  font-weight: 700;
}

.oracle-verification-panel__intro p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs, .75rem);
  line-height: 1.5;
}

.oracle-verification-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  padding-top: var(--space-3, 12px);
  border-top: 1px solid #263544;
}

.oracle-verification-card__question {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm, .875rem);
  font-weight: 650;
  line-height: 1.55;
}

.oracle-verification-card__reason,
.oracle-verification-card__result {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs, .75rem);
  line-height: 1.55;
}

.oracle-verification-card__result {
  padding-left: 10px;
  border-left: 2px solid #4d779f;
  color: #b8cde0;
}

.oracle-full__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  padding-bottom: var(--space-4, 16px);
  border-bottom: 1px solid var(--color-border);
}

.oracle-full__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 12px);
  width: 100%;
}

.oracle-full__title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
}

.oracle-full__icon {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  line-height: 1;
}

.oracle-full__title {
  font-size: var(--font-size-lg, 1.125rem);
  font-weight: var(--font-weight-bold, 700);
  color: var(--color-text-primary);
  margin: 0;
}

/* Sections */
.oracle-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  padding: var(--space-5, 20px) 0;
  border-bottom: 1px solid var(--color-border);
}
.oracle-section:last-child {
  border-bottom: none;
}

.oracle-section__title {
  font-size: var(--font-size-xs, 0.75rem);
  font-weight: var(--font-weight-bold, 700);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide, 0.05em);
  margin: 0 0 var(--space-1);
}

.oracle-section-heading p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs, .75rem);
  line-height: 1.5;
}

.oracle-section__text {
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed, 1.6);
  margin: 0;
}

.oracle-section__text--spaced {
  white-space: pre-wrap;
}

.oracle-section__empty {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
}

/* Detailed Lists */
.oracle-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.oracle-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.oracle-item__header {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
}

.oracle-item__name {
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
}

.oracle-item__sub {
  font-size: var(--font-size-xs, 0.75rem);
  color: var(--color-text-muted);
}

.oracle-item__desc {
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed, 1.6);
  margin: 0;
}

.oracle-item__grounding {
  margin: 6px 0 0;
  padding-left: 10px;
  border-left: 2px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: 1.55;
}

.oracle-item__grounding span {
  display: block;
  margin-bottom: 2px;
  color: var(--color-text-secondary);
  font-style: normal;
  font-weight: 600;
}
.oracle-text--feedback-changed {
  display: inline;
  margin: 0;
  padding: 1px 2px;
  border-radius: 4px;
  color: inherit;
  background: rgba(111, 103, 178, .12);
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  transition: background .25s ease;
}

.oracle-list--motifs { gap: 10px; }
.oracle-motif-card {
  display: grid;
  grid-template-columns: minmax(120px, 24%) minmax(0, 1fr);
  gap: 14px;
  padding: 13px 14px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  background: rgba(255, 255, 255, .012);
}
.oracle-motif-card__label {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding-right: 12px;
  border-right: 1px solid var(--color-border-subtle);
}
.oracle-motif-card__origin {
  color: #9299bd;
  font-size: 10px;
  font-weight: 550;
  line-height: 1.35;
}
.oracle-motif-card__body { min-width: 0; }
.oracle-motif-card__body .oracle-item__desc { line-height: 1.7; }
.oracle-motif-card__body .oracle-item__grounding {
  margin-top: 9px;
  padding: 8px 10px;
  border-left: 0;
  border-radius: 7px;
  background: rgba(255, 255, 255, .025);
}
.oracle-motif-card__history {
  margin-top: 10px;
  padding: 9px 11px;
  border: 1px solid rgba(148, 163, 184, .13);
  border-radius: 9px;
  background: rgba(148, 163, 184, .035);
}
.oracle-motif-card__history > span {
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 600;
}
.oracle-motif-card__history > div {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 7px;
}
.oracle-motif-card__history > div > span {
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, .07);
  color: var(--color-text-muted);
  font-size: 10px;
  line-height: 1.35;
}

@media (max-width: 640px) {
  .oracle-motif-card { grid-template-columns: 1fr; gap: 9px; }
  .oracle-motif-card__label { padding-right: 0; padding-bottom: 8px; border-right: 0; border-bottom: 1px solid var(--color-border-subtle); }
}

/* Valence Tag */
.valence-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-sm, 4px);
  text-transform: uppercase;
  line-height: 1.2;
}
.valence-badge--positive {
  background: #0e2a1c;
  color: #4ade80;
  border: 1px solid #1a3d2e;
}
.valence-badge--negative {
  background: #2d1010;
  color: #ed4956;
  border: 1px solid #3d1515;
}
.valence-badge--neutral {
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}
.valence-badge--ambivalent {
  background: #2b2411;
  color: #f0c86a;
  border: 1px solid #493b16;
}

.oracle-list--threads {
  gap: var(--space-3, 12px);
}

.oracle-thread {
  padding: var(--space-3, 12px);
  border-left: 2px solid var(--color-border);
  background: color-mix(in srgb, var(--color-bg-elevated) 55%, transparent);
}

.oracle-thread__alternative {
  margin: 2px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs, .75rem);
  line-height: 1.55;
}

.oracle-reflections {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.oracle-continuation {
  margin-top: 24px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-bg-elevated) 70%, var(--color-bg-surface));
  overflow: hidden;
}

.oracle-continuation__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-primary);
  font-weight: 700;
}

.oracle-continuation__header small,
.oracle-continuation__body > small {
  color: var(--color-text-muted);
  font-size: 10px;
  font-weight: 500;
}

.oracle-continuation__body {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.oracle-continuation__body h3,
.oracle-continuation__body p {
  margin: 0;
}

.oracle-continuation__story {
  white-space: pre-line;
  color: var(--color-text-primary);
  line-height: 1.75;
}

.oracle-continuation__story-wrap {
  position: relative;
}

.oracle-continuation__story-wrap--collapsed {
  max-height: 12.25rem;
  overflow: hidden;
}

.oracle-continuation__story-wrap--collapsed::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3.5rem;
  background: linear-gradient(transparent, var(--color-bg-elevated));
  content: '';
  pointer-events: none;
}

.oracle-continuation__expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: stretch;
  gap: 7px;
  min-height: 36px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-bg-surface) 82%, var(--color-primary) 18%);
  color: var(--color-text-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color .16s ease, background .16s ease;
}

.oracle-continuation__expand:hover {
  border-color: color-mix(in srgb, var(--color-primary) 60%, var(--color-border));
  background: color-mix(in srgb, var(--color-bg-surface) 72%, var(--color-primary) 28%);
}

.oracle-continuation__expand-icon {
  font-size: 16px;
  line-height: 1;
}

.oracle-continuation__connection {
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.oracle-continuation__inspirations {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.oracle-continuation__inspirations strong {
  width: 100%;
  color: var(--color-text-secondary);
  font-size: 11px;
}

.oracle-continuation__inspirations button {
  padding: 6px 9px;
  border: 1px solid rgba(168, 85, 247, .28);
  border-radius: 999px;
  background: rgba(88, 28, 135, .12);
  color: #d8b4fe;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.oracle-reflection {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: var(--space-2, 8px);
  padding-left: var(--space-1, 4px);
  color: var(--color-text-secondary);
}

.oracle-reflection__number {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid #35495e;
  border-radius: 50%;
  color: #9fbad4;
  font-size: 11px;
  font-weight: 700;
}

.oracle-reflection p {
  margin: 0 0 4px;
  font-size: var(--font-size-sm, .875rem);
  line-height: 1.55;
}

.oracle-reflection span {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs, .75rem);
  line-height: 1.5;
}

.oracle-list--science {
  gap: var(--space-3, 12px);
}

.oracle-science-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  border: 1px solid #283747;
  border-radius: var(--radius-lg, 8px);
  background: #121820;
}

.oracle-science-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.oracle-science-card__index {
  color: #7595b5;
  font: 700 11px/1 var(--font-family-mono, monospace);
}

.oracle-science-card__header h4 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm, .875rem);
  font-weight: 700;
  line-height: 1.4;
}

.oracle-science-card__tier {
  margin-left: auto;
  padding: 4px 8px;
  border: 1px solid rgba(245, 158, 11, 0.32);
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.08);
  color: #fbbf24;
  font-size: 0.68rem;
  font-weight: 700;
}

.oracle-science-card__explanation {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm, .875rem);
  line-height: 1.7;
}

.oracle-science-card__matches {
  padding: 10px 12px;
  border: 1px solid #263442;
  border-radius: 7px;
  background: rgba(19, 29, 39, .62);
}

.oracle-science-card__matches > span {
  display: block;
  margin-bottom: 6px;
  color: #8ca9c4;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .03em;
  text-transform: uppercase;
}

.oracle-science-card__matches blockquote {
  margin: 5px 0 0;
  color: #c4ccd4;
  font-size: 12px;
  line-height: 1.55;
}

.oracle-science-card__evidence {
  border-top: 1px solid #26313d;
  padding-top: 10px;
}

.oracle-science-card__evidence summary {
  color: #9db8d2;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}

.oracle-science-card__evidence > div {
  margin-top: 10px;
}

.oracle-science-card__evidence > div > span {
  color: var(--color-text-muted);
  font-size: 11px;
}

.oracle-science-card__evidence blockquote {
  margin: 5px 0 0;
  padding-left: 10px;
  border-left: 2px solid #3a5874;
  color: #c2c9d1;
  font-size: 12px;
  line-height: 1.6;
}

.oracle-science-card__boundary {
  padding-top: var(--space-2, 8px);
  border-top: 1px solid #26313d;
}

.oracle-science-card__applicability {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid rgba(139, 92, 246, .32);
  border-radius: 10px;
  background: rgba(139, 92, 246, .08);
}

.oracle-science-card__applicability > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.oracle-science-card__applicability span,
.oracle-science-card__applicability small {
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.oracle-science-card__applicability strong {
  color: #c4b5fd;
  font-size: 12px;
}

.oracle-science-card__applicability p {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 12px;
  line-height: 1.5;
}

.oracle-science-card__boundary > span {
  color: #aaadb3;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .03em;
  text-transform: uppercase;
}

.oracle-science-card__boundary p {
  margin: 5px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs, .75rem);
  line-height: 1.55;
}

/* Evidence Tags */
.oracle-item__evidence {
  display: flex;
  align-items: baseline;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
  margin-top: 2px;
}

.evidence-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
}

.evidence-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: var(--color-bg-elevated);
  padding: 2px 8px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-style: italic;
}

/* Hypothesis Confirmation Panel */
.oracle-feedback {
  margin-top: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.oracle-feedback__question {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
  margin: 0;
}

.oracle-feedback__timeframe {
  align-self: flex-start;
  color: var(--color-text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.oracle-feedback__actions {
  display: flex;
  gap: var(--space-2);
}

.oracle-similar__rail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 58%);
  gap: 12px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scroll-snap-type: inline mandatory;
  padding: 2px 2px 10px;
}

.oracle-similar__card {
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  min-height: 142px;
  max-height: 172px;
  padding: 11px 12px;
  text-align: left;
  color: var(--color-text-primary);
  background: linear-gradient(145deg, rgba(40, 43, 71, .42), rgba(19, 20, 31, .72));
  border: 1px solid rgba(128, 135, 190, .2);
  border-radius: 13px;
  cursor: pointer;
  transition: border-color .16s ease, transform .16s ease, background .16s ease;
}

.oracle-similar__card:hover {
  transform: translateY(-1px);
  border-color: rgba(150, 158, 220, .42);
  background: linear-gradient(145deg, rgba(46, 50, 82, .52), rgba(22, 23, 36, .82));
}

.oracle-similar__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--color-text-muted);
  font-size: 11px;
}

.oracle-similar__topline strong {
  color: #b8bee9;
  font-weight: 650;
  white-space: nowrap;
}

.oracle-similar__card h4,
.oracle-similar__card p { margin: 0; }
.oracle-similar__card h4 { font-size: 14px; line-height: 1.4; }
.oracle-similar__card p {
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.oracle-similar__reasons { display: flex; flex-wrap: wrap; gap: 5px; }
.oracle-similar__reasons span {
  padding: 3px 7px;
  border-radius: 999px;
  color: #aeb5dc;
  background: rgba(124, 132, 190, .1);
  border: 1px solid rgba(124, 132, 190, .16);
  font-size: 10px;
}
.oracle-similar__open { margin-top: auto; color: #c8cdf1; font-size: 11px; font-weight: 600; }

.oracle-context-tone {
  color: var(--color-text-muted);
  font-size: 10px;
  font-weight: 500;
}

.oracle-feedback-revision {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-subtle);
}
.oracle-feedback-revision > span {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 650;
}
.oracle-feedback-revision p {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 1.65;
}
.oracle-feedback-revision__hint {
  color: #aeb5d8 !important;
  font-size: 11px !important;
}
.oracle-feedback-revision__details { padding-top: 2px; }
.oracle-feedback-revision__details .oracle-feedback-revision__list { margin-top: 8px; }
.oracle-grounding-audit {
  margin: 8px 0 14px;
  padding: 12px 14px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  background: rgba(255, 255, 255, .012);
}
.oracle-grounding-audit summary {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.oracle-grounding-audit__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 14px;
  margin-top: 12px;
  color: var(--color-text-muted);
  font-size: 11px;
}
.oracle-grounding-audit__grid span { display: flex; justify-content: space-between; gap: 8px; }
.oracle-grounding-audit__grid strong { color: var(--color-text-primary); }
.oracle-grounding-audit > p {
  margin: 11px 0 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.55;
}
@media (max-width: 640px) {
  .oracle-grounding-audit__grid { grid-template-columns: 1fr; }
}
.oracle-feedback-revision__list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 1.55;
}
.oracle-feedback-revision__next {
  display: grid;
  gap: 6px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

/* Disclaimer */
.oracle-disclaimer {
  padding-top: var(--space-6);
  margin-top: var(--space-4);
  border-top: 1px dashed var(--color-border);
}
.oracle-disclaimer p {
  font-size: var(--font-size-xs, 0.75rem);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed, 1.6);
  margin: 0;
  font-style: italic;
}

.oracle-item__sources {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: var(--font-size-xs, 0.75rem);
  margin-top: 4px;
}

.source-label {
  color: var(--color-text-muted, #737373);
}

.source-citation-link {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary, #3b82f6);
  text-decoration: none;
  font-weight: 500;
}

.source-citation-link:hover {
  text-decoration: underline;
}

.oracle-inline-marker {
  margin: 0 .08rem;
  cursor: pointer;
  font-size: .76em;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  vertical-align: super;
}

.oracle-inline-marker--unsupported {
  color: #d6a75f;
  cursor: help;
}

.source-separator {
  color: var(--color-text-muted, #737373);
}

.oracle-rule-score-change {
  align-self: flex-end;
  color: #79d6a3;
  font-size: 12px;
  font-weight: 700;
}

.oracle-rule-score-change--down {
  color: #ef8a8a;
}

.oracle-sources__list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
}

.oracle-source-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color .16s ease, background-color .16s ease;
}

.oracle-source-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-elevated));
}

.oracle-source-card__index {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 750;
}

.oracle-source-card__content {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.oracle-source-card__content strong {
  overflow: hidden;
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oracle-source-card__content small,
.oracle-source-card__open {
  color: var(--color-text-muted);
  font-size: 11px;
}

.oracle-continuation__reload {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 17px;
}

.oracle-continuation__reload:disabled {
  cursor: wait;
  opacity: .7;
}

.oracle-continuation__spinner {
  animation: oracle-continuation-spin .7s linear infinite;
}

@keyframes oracle-continuation-spin {
  to { transform: rotate(360deg); }
}

.oracle-continuation__progress {
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-border-subtle);
}

.oracle-continuation__progress-state {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 9px;
  color: var(--color-text-muted);
  font-size: 11px;
}

.oracle-continuation__progress span {
  display: block;
  height: 100%;
  background: var(--color-primary);
  transition: width .2s ease;
}

.oracle-continuation__controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-subtle);
}

.oracle-continuation__controls nav {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.oracle-continuation__controls nav button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 19px;
}

.oracle-continuation__controls nav button:disabled {
  cursor: default;
  opacity: .35;
}

.oracle-item__internal-framework {
  margin-top: 4px;
}

.badge-internal-framework {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted, #737373);
  background: var(--color-bg-elevated, #1a1a1a);
  border: 1px solid var(--color-border, #262626);
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  display: inline-block;
}
</style>
