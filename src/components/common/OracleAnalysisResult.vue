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
        <span class="oracle-compact__hint">Xem phân tích trong chi tiết</span>
      </div>
    </div>

    <!-- ── COLLAPSED PREVIEW MODE (when not expanded) ── -->
    <div v-else-if="activeMode === 'collapsed' && !isExpanded" class="oracle-collapsed" @click="isExpanded = true">
      <div class="oracle-collapsed__header">
        <span class="oracle-collapsed__icon" aria-hidden="true">◈</span>
        <h4 class="oracle-collapsed__title">Oracle AI phân tích</h4>
      </div>
      <p class="oracle-collapsed__summary">{{ analysis.summary }}</p>
      <div class="oracle-collapsed__footer">
        <button class="oracle-toggle-btn" @click.stop="isExpanded = true">
          Xem phân tích AI <span class="arrow">↓</span>
        </button>
      </div>
    </div>

    <!-- ── FULL MODE or EXPANDED COLLAPSED MODE ── -->
    <div v-else class="oracle-full">
      <section v-if="analysis.real_life_hypotheses?.length" class="oracle-verification-panel">
        <div class="oracle-verification-panel__intro">
          <span>Cần bạn xác nhận</span>
          <p>Các câu hỏi ngắn giúp phân biệt điều đang xảy ra ngoài đời với một tình huống chỉ xuất hiện trong giấc mơ.</p>
        </div>
        <article v-for="(item, idx) in analysis.real_life_hypotheses" :key="questionKey(item, idx)" class="oracle-verification-card">
          <span v-if="item.questionType" class="oracle-feedback__timeframe">{{ formatQuestionType(item) }}</span>
          <p class="oracle-verification-card__question">{{ item.followUpQuestion }}</p>
          <p v-if="item.reasonForAsking" class="oracle-verification-card__reason">{{ item.reasonForAsking }}</p>
          <div v-if="item.sources?.length" class="oracle-item__sources oracle-item__sources--inline">
            <span v-for="(src, srcIdx) in item.sources" :key="srcIdx" class="source-citation-wrap">
              <span v-if="srcIdx === 0">Căn cứ: </span><span v-else class="source-separator">; </span>
              <button type="button" class="source-citation-link" @click="navigateToSource(src.sourceId)">
                {{ formatInlineCitation(src) }}
              </button>
            </span>
          </div>
          <div v-if="showHypothesisActions" class="oracle-feedback__actions">
            <button :class="['feedback-btn', 'feedback-btn--yes', { 'feedback-btn--active': feedbackSelections[questionKey(item, idx)] === 'yes' }]" @click="selectFeedback(idx, 'yes')"><span aria-hidden="true">✓</span> Có</button>
            <button :class="['feedback-btn', 'feedback-btn--no', { 'feedback-btn--active': feedbackSelections[questionKey(item, idx)] === 'no' }]" @click="selectFeedback(idx, 'no')"><span aria-hidden="true">×</span> Không</button>
            <button :class="['feedback-btn', 'feedback-btn--unsure', { 'feedback-btn--active': feedbackSelections[questionKey(item, idx)] === 'unsure' }]" @click="selectFeedback(idx, 'unsure')"><span aria-hidden="true">?</span> Chưa biết</button>
          </div>
          <p v-if="feedbackSelections[questionKey(item, idx)] === 'yes' && item.ifYesMeaning" class="oracle-verification-card__result">{{ item.ifYesMeaning }}</p>
          <p v-else-if="feedbackSelections[questionKey(item, idx)] === 'no' && item.ifNoMeaning" class="oracle-verification-card__result">{{ item.ifNoMeaning }}</p>
          <p v-else-if="feedbackSelections[questionKey(item, idx)] === 'unsure'" class="oracle-verification-card__result">Chưa dùng hướng này làm kết luận; câu hỏi kế tiếp sẽ kiểm tra một khía cạnh khác nếu còn dữ kiện phù hợp.</p>
        </article>
        <div v-if="analysis.feedback_analysis" class="oracle-feedback-revision">
          <span>Phân tích đã thay đổi theo câu trả lời của bạn</span>
          <ul v-if="analysis.feedback_analysis.confirmedFacts.length" class="oracle-feedback-revision__list">
            <li v-for="fact in analysis.feedback_analysis.confirmedFacts" :key="fact"><strong>Đã xác nhận:</strong> {{ fact }}</li>
          </ul>
          <ul v-if="analysis.feedback_analysis.rejectedDirections.length" class="oracle-feedback-revision__list">
            <li v-for="direction in analysis.feedback_analysis.rejectedDirections" :key="direction"><strong>Đã loại khỏi trọng tâm:</strong> {{ direction }}</li>
          </ul>
          <p>{{ analysis.feedback_analysis.interpretation }}</p>
          <p v-if="analysis.feedback_changed_paths?.length" class="oracle-feedback-revision__hint">Chỉ những đoạn có nền tím nhạt bên dưới đã thực sự được viết lại theo câu trả lời này.</p>
          <p v-else class="oracle-feedback-revision__hint">Câu trả lời đã được lưu nhưng chưa làm thay đổi đoạn phân tích nào.</p>
        </div>
        <div v-else-if="analysis.feedback_conclusion" class="oracle-feedback-revision">
          <span>Điều câu trả lời vừa thay đổi</span>
          <p>{{ analysis.feedback_conclusion }}</p>
        </div>
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
            Thu gọn phân tích AI <span class="arrow">↑</span>
          </button>
        </div>
      </header>

      <!-- Summary -->
      <section class="oracle-section">
        <h3 class="oracle-section__title">Tóm tắt</h3>
        <p class="oracle-section__text">{{ analysis.summary }}</p>
      </section>

      <!-- Core Analysis -->
      <section class="oracle-section">
        <h3 class="oracle-section__title">Bức tranh tổng thể</h3>
        <p class="oracle-section__text oracle-section__text--spaced">
          <template v-for="(segment, segmentIdx) in feedbackSegments(analysis.core_analysis, 'core_analysis')" :key="`core-${segmentIdx}`">
            <mark v-if="segment.changed" class="oracle-text--feedback-changed">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span>
          </template>
        </p>
      </section>

      <section v-if="analysis.interpretive_threads?.length" class="oracle-section">
        <h3 class="oracle-section__title">Các mạch diễn giải</h3>
        <ul class="oracle-list oracle-list--threads">
          <li v-for="(thread, idx) in analysis.interpretive_threads" :key="idx" class="oracle-item oracle-thread">
            <div class="oracle-item__header">
              <span class="oracle-item__name">{{ thread.title }}</span>
            </div>
            <p class="oracle-item__desc">
              <template v-for="(segment, segmentIdx) in feedbackSegments(thread.reasoning, `interpretive_threads.${idx}.reasoning`)" :key="`thread-reason-${idx}-${segmentIdx}`">
                <mark v-if="segment.changed" class="oracle-text--feedback-changed">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span>
              </template>
            </p>
            <p class="oracle-thread__basis">Căn cứ diễn giải: trình tự chi tiết trong lời kể<span v-if="analysis.feedback_analysis"> và câu trả lời bạn vừa cung cấp</span>.</p>
            <div class="oracle-item__evidence">
              <span class="evidence-label">Chi tiết được nối lại:</span>
              <span v-for="(ev, evIdx) in thread.dreamEvidence" :key="evIdx" class="evidence-tag">“{{ ev }}”</span>
            </div>
            <p class="oracle-thread__alternative"><strong>Cách hiểu khác:</strong>
              <template v-for="(segment, segmentIdx) in feedbackSegments(thread.alternativeExplanation, `interpretive_threads.${idx}.alternativeExplanation`)" :key="`thread-alt-${idx}-${segmentIdx}`">
                <mark v-if="segment.changed" class="oracle-text--feedback-changed">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span>
              </template>
            </p>
          </li>
        </ul>
      </section>

      <!-- Symbolic Notes -->
      <section class="oracle-section">
        <h3 class="oracle-section__title">Những chi tiết đang dẫn dắt giấc mơ</h3>
        <div v-if="!analysis.symbolic_notes || analysis.symbolic_notes.length === 0" class="oracle-section__empty">
          Không có biểu tượng nổi bật được xác định từ nội dung mơ.
        </div>
        <ul v-else class="oracle-list oracle-list--motifs">
          <li v-for="(note, idx) in analysis.symbolic_notes" :key="idx" class="oracle-item oracle-motif-card">
            <div class="oracle-motif-card__label">
              <span class="oracle-item__name">{{ note.symbol }}</span>
              <span class="oracle-motif-card__origin">
                {{ note.origin === 'dictionary'
                  ? `Có đối chiếu từ điển biểu tượng${note.dictionarySymbol ? ` · ${note.dictionarySymbol}` : ''}`
                  : (hasMotifHistory(note) ? 'Đã có trong kho quan sát từ các giấc mơ trước' : 'Quan sát theo ngữ cảnh đang được tích lũy') }}
              </span>
              <span v-if="note.contextualTone && note.contextualTone !== 'neutral'" class="oracle-context-tone">
                Cảm xúc trong cảnh: {{ getContextToneLabel(note.contextualTone).toLocaleLowerCase('vi') }}
              </span>
            </div>
            <div class="oracle-motif-card__body">
              <p class="oracle-item__desc">
                <template v-for="(segment, segmentIdx) in feedbackSegments(note.meaning, `symbolic_notes.${idx}.meaning`)" :key="`motif-${idx}-${segmentIdx}`">
                  <mark v-if="segment.changed" class="oracle-text--feedback-changed">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span>
                </template>
              </p>
              <p v-if="note.dreamEvidence" class="oracle-item__grounding">
                <span>Trong lời kể</span>
                “{{ note.dreamEvidence }}”
              </p>
              <div v-if="hasMotifHistory(note)" class="oracle-motif-card__history">
                <span>Dữ liệu từ các trường hợp đã có</span>
                <div>
                  <span v-if="note.motifStats?.previousPersonalDreamCount">{{ note.motifStats.previousPersonalDreamCount }} giấc mơ trước của bạn có chi tiết này</span>
                  <span v-if="note.motifStats?.similarDreamCount">{{ note.motifStats.similarDreamCount }} giấc mơ tương đồng cũng có chi tiết này</span>
                  <span v-if="note.motifStats?.sameSequenceCount">{{ note.motifStats.sameSequenceCount }} trường hợp trong số đó có cùng kiểu tình tiết</span>
                  <span v-if="note.motifStats?.confirmedContextCount">{{ note.motifStats.confirmedContextCount }} trường hợp có hoàn cảnh liên quan được người kể xác nhận</span>
                  <span v-if="note.motifStats?.observedPublicDreamCount">{{ note.motifStats.observedPublicDreamCount }} giấc mơ công khai đã được ghi nhận trong kho quan sát</span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <!-- Scientific Context Notes -->
      <section v-if="analysis.scientific_context_notes && analysis.scientific_context_notes.length > 0" class="oracle-section">
        <div class="oracle-section-heading">
          <h3 class="oracle-section__title">Điều có thể đang diễn ra bên dưới giấc mơ</h3>
        </div>
        <ul class="oracle-list oracle-list--science">
          <li v-for="(note, idx) in analysis.scientific_context_notes" :key="note.ruleId || idx" class="oracle-science-card">
            <div class="oracle-science-card__header">
              <span class="oracle-science-card__index">{{ String(idx + 1).padStart(2, '0') }}</span>
              <h4>{{ note.insightTitle || 'Một cơ chế đáng cân nhắc' }}</h4>
            </div>
            <p class="oracle-science-card__explanation">
              <template v-for="(segment, segmentIdx) in feedbackSegments(note.note, `scientific_context_notes.${idx}.note`)" :key="`science-${idx}-${segmentIdx}`">
                <mark v-if="segment.changed" class="oracle-text--feedback-changed">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span>
              </template>
            </p>

            <div v-if="note.matchedDreamDetails?.length || note.dreamEvidence?.length" class="oracle-science-card__matches">
              <span>Những đoạn trong giấc mơ liên quan trực tiếp</span>
              <blockquote v-for="detail in (note.matchedDreamDetails || note.dreamEvidence)" :key="detail">“{{ detail }}”</blockquote>
            </div>

            <details v-if="note.evidenceQuotes?.length" class="oracle-science-card__evidence">
              <summary>Kiểm tra căn cứ trong tài liệu</summary>
              <div v-for="evidence in note.evidenceQuotes" :key="`${evidence.chunkId}:${evidence.quote}`">
                <span>{{ formatEvidenceSource(note, evidence.sourceId) }}</span>
                <blockquote>“{{ evidence.quote }}”</blockquote>
              </div>
            </details>

            <div v-if="note.boundary" class="oracle-science-card__boundary">
              <span>Điều chưa thể kết luận</span>
              <p>{{ note.boundary }}</p>
            </div>
          </li>
        </ul>
      </section>

      <!-- Cultural Symbolic Notes -->
      <section v-if="culturalNotesToShow.length > 0" class="oracle-section">
        <h3 class="oracle-section__title">Góc nhìn văn hóa có căn cứ</h3>
        <ul class="oracle-list">
          <li v-for="(note, idx) in culturalNotesToShow" :key="idx" class="oracle-item">
            <div v-if="hasRealSource(note.source)" class="oracle-item__header">
              <span class="oracle-item__name">Nguồn: {{ note.source }}</span>
            </div>
            <p class="oracle-item__desc">{{ note.note }}</p>
          </li>
        </ul>
      </section>

      <section v-if="analysis.practical_reflections?.length" class="oracle-section">
        <div class="oracle-section-heading">
          <h3 class="oracle-section__title">Điều nên để ý hôm nay và sắp tới</h3>
          <p>Những việc cụ thể giúp kiểm tra nguyên nhân có thể có, không phải dự báo chắc chắn.</p>
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
              <span>Vì sao nên thử:
                <template v-for="(segment, segmentIdx) in feedbackSegments(item.rationale, `practical_reflections.${idx}.rationale`)" :key="`rationale-${idx}-${segmentIdx}`">
                  <mark v-if="segment.changed" class="oracle-text--feedback-changed">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span>
                </template>
              </span>
            </div>
          </li>
        </ol>
      </section>

      <details v-if="analysis.grounding_summary" class="oracle-grounding-audit">
        <summary>Kết quả này được tạo từ đâu?</summary>
        <div class="oracle-grounding-audit__grid">
          <span>Lời kể gốc <strong>{{ analysis.grounding_summary.narrativeUsed ? 'Đã dùng' : 'Không có' }}</strong></span>
          <span>Câu trả lời đã làm rõ <strong>{{ analysis.grounding_summary.resolvedContextCount }}</strong></span>
          <span>Câu trả lời còn để mở <strong>{{ analysis.grounding_summary.unresolvedContextCount }}</strong></span>
          <span>Chi tiết khớp từ điển <strong>{{ analysis.grounding_summary.dictionaryMotifCount }}</strong></span>
          <span>Chi tiết nhận diện từ lời kể <strong>{{ analysis.grounding_summary.contextualMotifCount }}</strong></span>
          <span>Kết luận học thuật liên quan <strong>{{ analysis.grounding_summary.appliedRuleCount }}</strong></span>
          <span>Cơ chế tâm lý có dẫn chứng <strong>{{ analysis.grounding_summary.explanatoryRuleCount }}</strong></span>
          <span>Giấc mơ cũ được tham khảo <strong>{{ analysis.grounding_summary.similarDreamCount }}</strong></span>
          <span>Dữ kiện về điều kiện ngủ <strong>{{ analysis.grounding_summary.sleepContextFactCount ?? 0 }}</strong></span>
        </div>
        <p v-if="analysis.grounding_summary.explanatoryRuleCount === 0">
          Thư viện hiện chưa có quy luật cơ chế phù hợp cho trường hợp này. Các mạch diễn giải phía trên được suy ra từ trình tự lời kể và câu trả lời của bạn, không được trình bày như một kết luận khoa học.
        </p>
        <p v-else>
          Chỉ phần “Điều có thể đang diễn ra bên dưới giấc mơ” được phép dùng quy luật cơ chế và trích dẫn học thuật. Các chi tiết theo ngữ cảnh vẫn chỉ có giá trị trong chính lời kể này.
        </p>
      </details>

      <section v-if="analysis.similar_dreams?.length" class="oracle-section oracle-similar">
        <div class="oracle-section-heading">
          <h3 class="oracle-section__title">Những giấc mơ có nét tương đồng</h3>
          <p>Các bài đạt từ 40% tương đồng, dùng để tham khảo trải nghiệm chứ không thay thế bằng chứng nghiên cứu.</p>
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
              <span>{{ item.sameAuthor ? 'Giấc mơ trước của bạn' : item.authorDisplayName }}</span>
              <strong>{{ item.similarity }}%</strong>
            </div>
            <h4>{{ item.title }}</h4>
            <p>{{ item.excerpt }}</p>
            <div class="oracle-similar__reasons">
              <span v-for="reason in item.matchedOn" :key="reason">{{ reason }}</span>
            </div>
            <span class="oracle-similar__open">Xem bài viết <span aria-hidden="true">→</span></span>
          </button>
        </div>
      </section>

      <!-- Disclaimer -->
      <footer class="oracle-disclaimer">
        <p>{{ analysis.disclaimer }}</p>
        <!-- Collapse Button at bottom of disclaimer -->
        <div v-if="activeMode === 'collapsed'" class="oracle-full__footer">
          <button class="oracle-toggle-btn" @click="isExpanded = false">
            Thu gọn phân tích AI <span class="arrow">↑</span>
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { AiDreamAnalysisResult } from '@/api/types'
import { useSettingsStore } from '@/store/useSettingsStore'
import { usePostStore } from '@/store/usePostStore'
import { useDreamStore } from '@/store/useDreamStore'
import apiClient from '@/api/client'

const props = withDefaults(defineProps<{
  analysis: AiDreamAnalysisResult | null | undefined
  compact?: boolean
  showHypothesisActions?: boolean
  mode?: 'compact' | 'collapsed' | 'full'
  dreamId?: string
}>(), {
  compact: false,
  showHypothesisActions: false,
  mode: 'full',
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

function formatCitationText(src: any): string {
  if (!src) return 'Tài liệu'
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
    citation = 'Tài liệu'
  }
  
  if (src.year) {
    citation += ` (${src.year})`
  }
  
  return citation
}

function formatInlineCitation(src: any): string {
  return formatCitationText(src).replace(/^"|"$/g, '')
}

function formatEvidenceSource(note: any, sourceId: string): string {
  const source = note?.sources?.find((item: any) => item.sourceId === sourceId)
  return source ? formatCitationText(source) : 'Trích dẫn trong tài liệu nguồn'
}

function navigateToSource(sourceId: string) {
  if (!sourceId) return
  try {
    if (router) {
      router.push(`/library/sources/${sourceId}`).catch(err => {
        console.error('Failed to navigate to library source:', err)
      })
    }
  } catch (err) {
    console.error('Failed to navigate to library source:', err)
  }
}

async function openSimilarDream(dreamId: string) {
  if (!dreamId) return
  await postStore.openPost(dreamId)
}

function formatQuestionType(item: any): string {
  if (item?.questionBasis === 'sleep_context') return 'Kiểm tra môi trường ngủ'
  const type = item?.questionType as 'past' | 'present' | 'future'
  if (type === 'past') return 'Kiểm tra sự kiện đã xảy ra'
  if (type === 'future') return 'Có thể trả lời sau'
  return 'Kiểm tra hoàn cảnh hiện tại'
}

// Expanded state
const isExpanded = ref(activeMode.value === 'full')

// A feedback response replaces the analysis payload. Watching that object made
// the open result collapse after every answer. Only a different post or mode
// may reset expansion state.
watch(() => props.dreamId, () => {
  isExpanded.value = activeMode.value === 'full'
})

watch(() => props.mode, (newMode) => {
  isExpanded.value = newMode === 'full'
})

// Local UI state for hypothesis confirmations
const feedbackSelections = ref<Record<string, string>>({})

function questionKey(item: any, idx: number): string {
  return String(item?.verificationKey || `question-${idx}`)
}

function feedbackSegments(value: unknown, path: string): Array<{ text: string; changed: boolean }> {
  const text = String(value || '')
  const changedFragments = props.analysis?.feedback_changed_fragments?.[path]?.filter(Boolean) || []
  if (!text || changedFragments.length === 0) return [{ text, changed: false }]

  const segments: Array<{ text: string; changed: boolean }> = []
  let cursor = 0
  while (cursor < text.length) {
    let nextFragment = ''
    let nextIndex = -1
    for (const fragment of changedFragments) {
      const index = text.indexOf(fragment, cursor)
      if (index !== -1 && (nextIndex === -1 || index < nextIndex)) {
        nextFragment = fragment
        nextIndex = index
      }
    }
    if (nextIndex === -1) {
      segments.push({ text: text.slice(cursor), changed: false })
      break
    }
    if (nextIndex > cursor) segments.push({ text: text.slice(cursor, nextIndex), changed: false })
    segments.push({ text: nextFragment, changed: true })
    cursor = nextIndex + nextFragment.length
  }
  return segments.length > 0 ? segments : [{ text, changed: false }]
}

function hasMotifHistory(note: any): boolean {
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

// Watch props.analysis to sync saved user feedback
watch(() => props.analysis, (newVal) => {
  if (newVal?.real_life_hypotheses) {
    const selections: Record<string, string> = {}
    newVal.real_life_hypotheses.forEach((item: any, idx: number) => {
      if (item.userFeedback) {
        selections[questionKey(item, idx)] = item.userFeedback
      }
    })
    feedbackSelections.value = selections
  } else {
    feedbackSelections.value = {}
  }
}, { immediate: true })

const settingsStore = useSettingsStore()
const postStore = usePostStore()
const dreamStore = useDreamStore()

async function selectFeedback(hypothesisIdx: number, val: 'yes' | 'no' | 'unsure') {
  const targetDreamId = props.dreamId || postStore.focusedDream?._id
  if (!targetDreamId) {
    console.error('Cannot save hypothesis feedback: dreamId is missing')
    return
  }

  const hypothesisItem = props.analysis?.real_life_hypotheses?.[hypothesisIdx]
  const feedbackKey = questionKey(hypothesisItem, hypothesisIdx)
  const questionText = hypothesisItem?.followUpQuestion || ''
  const submittedAnswer = feedbackSelections.value[feedbackKey] === val ? null : val

  try {
    const response = await apiClient.post(`/dreams/${targetDreamId}/hypothesis-feedback`, {
      hypothesisIndex: hypothesisIdx,
      verificationKey: hypothesisItem?.verificationKey,
      answer: submittedAnswer,
      questionText
    })

    if (response.data.success) {
      if (submittedAnswer === null) delete feedbackSelections.value[feedbackKey]
      else feedbackSelections.value[feedbackKey] = submittedAnswer
      const refreshedAnalysis = response.data.data?.analysis
      if (props.analysis && refreshedAnalysis) {
        Object.assign(props.analysis, refreshedAnalysis)
      } else if (props.analysis) {
        props.analysis.feedback_revision = response.data.data?.feedbackRevision || []
        props.analysis.feedback_conclusion = response.data.data?.feedbackConclusion || null
      }
      settingsStore.showToast(submittedAnswer === null ? 'Đã bỏ lựa chọn.' : 'Đã ghi nhận phản hồi.', 'success')

      // Update state mirror in stores
      if (postStore.focusedDream && postStore.focusedDream._id === targetDreamId) {
        const d = postStore.focusedDream
        if (refreshedAnalysis) {
          d.ai_result = refreshedAnalysis
          d.aiAnalysis = refreshedAnalysis
        }
      }

      const dreamInStore = dreamStore.dreams.find((d: any) => d._id === targetDreamId)
      if (dreamInStore) {
        if (refreshedAnalysis) {
          dreamInStore.ai_result = refreshedAnalysis
          dreamInStore.aiAnalysis = refreshedAnalysis
        }
      }
    }
  } catch (err: any) {
    console.error('Failed to submit hypothesis feedback:', err)
    settingsStore.showToast(err.response?.data?.message || 'Không thể lưu phản hồi.', 'error')
  }
}

function handleCompactClick() {
  emit('view-details')
}

function getContextToneClass(tone?: string): string {
  if (tone === 'reassuring') return 'positive'
  if (tone === 'threatening') return 'negative'
  if (tone === 'ambivalent') return 'ambivalent'
  return 'neutral'
}

function getContextToneLabel(tone?: string): string {
  if (tone === 'reassuring') return 'Mang tính an ủi'
  if (tone === 'threatening') return 'Mang tính đe dọa'
  if (tone === 'ambivalent') return 'Cảm xúc đan xen'
  return 'Chưa rõ sắc thái'
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
.oracle-thread__basis {
  margin: -2px 0 2px;
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.5;
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

.feedback-btn {
  min-height: 32px;
  padding: 0 var(--space-3);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.feedback-btn span { display: inline-grid; place-items: center; width: 16px; height: 16px; margin-right: 4px; border-radius: 50%; background: var(--color-bg-elevated); }
.feedback-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: #3a3a3a;
}
.feedback-btn--active {
  color: var(--color-text-primary);
}
.feedback-btn--yes.feedback-btn--active { background: rgba(16,185,129,.14); border-color: rgba(52,211,153,.5); color: #6ee7b7; }
.feedback-btn--no.feedback-btn--active { background: rgba(239,68,68,.12); border-color: rgba(248,113,113,.5); color: #fca5a5; }
.feedback-btn--unsure.feedback-btn--active { background: rgba(148,163,184,.12); border-color: rgba(148,163,184,.45); color: #cbd5e1; }

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

.source-separator {
  color: var(--color-text-muted, #737373);
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
