<template>
  <div v-if="analysis" :class="['oracle-result', { 'oracle-result--compact': activeMode === 'compact' }]">
    <!-- ── COMPACT MODE ── -->
    <div v-if="activeMode === 'compact'" class="oracle-compact" @click="handleCompactClick">
      <div class="oracle-compact__header">
        <span class="oracle-compact__icon" aria-hidden="true">◈</span>
        <h4 class="oracle-compact__title">{{ analysis.title }}</h4>
        <span class="oracle-compact__tone-badge">{{ analysis.emotional_tone }}</span>
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
        <span v-if="analysis.emotional_tone" class="oracle-collapsed__tone-badge">
          {{ analysis.emotional_tone }}
        </span>
        <span v-if="analysis.dreamValenceScore !== undefined" class="oracle-collapsed__valence-badge">
          Chỉ số: {{ analysis.dreamValenceScore }}/100
        </span>
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
        <div class="oracle-full__meta">
          <span class="oracle-full__tone-label">Tone cảm xúc:</span>
          <span class="oracle-full__tone-val">{{ analysis.emotional_tone }}</span>
          <span v-if="analysis.dreamValenceScore !== undefined" class="oracle-full__valence">
            (Chỉ số cảm xúc: {{ analysis.dreamValenceScore }}/100)
          </span>
        </div>
      </header>

      <!-- Summary -->
      <section class="oracle-section">
        <h3 class="oracle-section__title">Tóm tắt</h3>
        <p class="oracle-section__text">{{ analysis.summary }}</p>
      </section>

      <!-- Core Analysis -->
      <section class="oracle-section">
        <h3 class="oracle-section__title">Phân tích cốt lõi</h3>
        <p class="oracle-section__text oracle-section__text--spaced">{{ analysis.core_analysis }}</p>
      </section>

      <!-- Symbolic Notes -->
      <section class="oracle-section">
        <h3 class="oracle-section__title">Giải mã biểu tượng</h3>
        <div v-if="!analysis.symbolic_notes || analysis.symbolic_notes.length === 0" class="oracle-section__empty">
          Không có biểu tượng nổi bật được xác định từ nội dung mơ.
        </div>
        <ul v-else class="oracle-list">
          <li v-for="(note, idx) in analysis.symbolic_notes" :key="idx" class="oracle-item">
            <div class="oracle-item__header">
              <span class="oracle-item__name">{{ note.symbol }}</span>
              <span v-if="note.relevance" class="oracle-item__sub">Độ liên quan: {{ Math.round(note.relevance * 100) }}%</span>
              <span :class="['valence-badge', `valence-badge--${getValenceClass(note.symbolValence)}`]">
                {{ getValenceLabel(note.symbolValence) }}
              </span>
            </div>
            <p class="oracle-item__desc">{{ note.meaning }}</p>
          </li>
        </ul>
      </section>

      <!-- Scientific Context Notes -->
      <section v-if="analysis.scientific_context_notes && analysis.scientific_context_notes.length > 0" class="oracle-section">
        <h3 class="oracle-section__title">Góc nhìn khoa học & Y sinh</h3>
        <ul class="oracle-list">
          <li v-for="(note, idx) in analysis.scientific_context_notes" :key="idx" class="oracle-item">
            <div class="oracle-item__header">
              <span class="oracle-item__name">Ghi chú y sinh #{{ idx + 1 }}</span>
              <span v-if="note.confidence" class="oracle-item__sub">Độ tin cậy: {{ Math.round(note.confidence * 100) }}%</span>
            </div>
            <p class="oracle-item__desc">{{ note.note }}</p>
            
            <!-- Compact Citation row -->
            <div v-if="note.sources && note.sources.length > 0" class="oracle-item__sources">
              <span class="source-label">Dựa trên: </span>
              <span v-for="(src, srcIdx) in note.sources" :key="srcIdx" class="source-citation-wrap">
                <span v-if="srcIdx > 0" class="source-separator">; </span>
                <a 
                  href="#" 
                  class="source-citation-link" 
                  @click.prevent="navigateToSource(src.sourceId)"
                >
                  {{ formatCitationText(src) }}
                </a>
              </span>
            </div>
          </li>
        </ul>
      </section>

      <!-- Cultural Symbolic Notes -->
      <section v-if="culturalNotesToShow.length > 0" class="oracle-section">
        <h3 class="oracle-section__title">Góc nhìn văn hóa & Tâm linh</h3>
        <ul class="oracle-list">
          <li v-for="(note, idx) in culturalNotesToShow" :key="idx" class="oracle-item">
            <div v-if="hasRealSource(note.source)" class="oracle-item__header">
              <span class="oracle-item__name">Nguồn: {{ note.source }}</span>
            </div>
            <p class="oracle-item__desc">{{ note.note }}</p>
          </li>
        </ul>
      </section>

      <!-- Real-Life Hypotheses -->
      <section class="oracle-section">
        <h3 class="oracle-section__title">Giả thuyết đời thực</h3>
        <div v-if="!analysis.real_life_hypotheses || analysis.real_life_hypotheses.length === 0" class="oracle-section__empty">
          Không có giả thuyết đời thực nào được đưa ra.
        </div>
        <ul v-else class="oracle-list">
          <li v-for="(item, idx) in analysis.real_life_hypotheses" :key="idx" class="oracle-item">
            <div class="oracle-item__header">
              <span class="oracle-item__name">Giả thuyết #{{ idx + 1 }}</span>
              <span v-if="item.confidence" class="oracle-item__sub">Độ tin cậy: {{ Math.round(item.confidence * 100) }}%</span>
            </div>
            <p class="oracle-item__desc">{{ item.hypothesis }}</p>
            
            <div v-if="item.evidenceFromDream && item.evidenceFromDream.length > 0" class="oracle-item__evidence">
              <span class="evidence-label">Dẫn chứng giấc mơ:</span>
              <span v-for="(ev, evIdx) in item.evidenceFromDream" :key="evIdx" class="evidence-tag">
                "{{ ev }}"
              </span>
            </div>

            <!-- Follow-up confirmation -->
            <div v-if="item.needsUserConfirmation && item.followUpQuestion" class="oracle-feedback">
              <p class="oracle-feedback__question">{{ item.followUpQuestion }}</p>
              <div v-if="showHypothesisActions" class="oracle-feedback__actions-wrapper" style="display: flex; flex-direction: column; gap: var(--space-2);">
                <div class="oracle-feedback__actions">
                  <button
                    :class="['feedback-btn', { 'feedback-btn--active': feedbackSelections[idx] === 'yes' }]"
                    @click="selectFeedback(idx, 'yes')"
                  >
                    Đúng
                  </button>
                  <button
                    :class="['feedback-btn', { 'feedback-btn--active': feedbackSelections[idx] === 'no' }]"
                    @click="selectFeedback(idx, 'no')"
                  >
                    Không đúng
                  </button>
                  <button
                    :class="['feedback-btn', { 'feedback-btn--active': feedbackSelections[idx] === 'unsure' }]"
                    @click="selectFeedback(idx, 'unsure')"
                  >
                    Không chắc
                  </button>
                </div>
                <div v-if="feedbackSelections[idx]" class="feedback-confirmation-text" style="font-size: 11px; color: #10b981; font-weight: 500; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                  <span style="font-size: 14px;">✓</span> Đã ghi nhận phản hồi.
                </div>
              </div>
            </div>
          </li>
        </ul>
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

// Expanded state
const isExpanded = ref(activeMode.value === 'full')

// Reset expansion state to collapsed when analysis changes or mode changes
watch(() => props.analysis, () => {
  isExpanded.value = activeMode.value === 'full'
})

watch(() => props.mode, (newMode) => {
  isExpanded.value = newMode === 'full'
})

// Local UI state for hypothesis confirmations
const feedbackSelections = ref<Record<number, string>>({})

// Watch props.analysis to sync saved user feedback
watch(() => props.analysis, (newVal) => {
  if (newVal?.real_life_hypotheses) {
    const selections: Record<number, string> = {}
    newVal.real_life_hypotheses.forEach((item: any, idx: number) => {
      if (item.userFeedback) {
        selections[idx] = item.userFeedback
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
  const questionText = hypothesisItem?.followUpQuestion || ''

  try {
    const response = await apiClient.post(`/dreams/${targetDreamId}/hypothesis-feedback`, {
      hypothesisIndex: hypothesisIdx,
      answer: val,
      questionText
    })

    if (response.data.success) {
      feedbackSelections.value[hypothesisIdx] = val
      settingsStore.showToast('Đã ghi nhận phản hồi.', 'success')

      // Update state mirror in stores
      if (postStore.focusedDream && postStore.focusedDream._id === targetDreamId) {
        const d = postStore.focusedDream
        if (d.ai_result?.real_life_hypotheses?.[hypothesisIdx]) {
          d.ai_result.real_life_hypotheses[hypothesisIdx].userFeedback = val
        }
        if (d.aiAnalysis?.real_life_hypotheses?.[hypothesisIdx]) {
          d.aiAnalysis.real_life_hypotheses[hypothesisIdx].userFeedback = val
        }
      }

      const dreamInStore = dreamStore.dreams.find((d: any) => d._id === targetDreamId)
      if (dreamInStore) {
        if (dreamInStore.ai_result?.real_life_hypotheses?.[hypothesisIdx]) {
          dreamInStore.ai_result.real_life_hypotheses[hypothesisIdx].userFeedback = val
        }
        if (dreamInStore.aiAnalysis?.real_life_hypotheses?.[hypothesisIdx]) {
          dreamInStore.aiAnalysis.real_life_hypotheses[hypothesisIdx].userFeedback = val
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

// Helper methods for valence styling
function getValenceClass(val: number): string {
  if (val > 0) return 'positive'
  if (val < 0) return 'negative'
  return 'neutral'
}

function getValenceLabel(val: number): string {
  if (val > 0) return 'Tích cực'
  if (val < 0) return 'Tiêu cực'
  return 'Trung tính'
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

.oracle-compact__tone-badge {
  font-size: var(--font-size-xs, 0.75rem);
  color: var(--color-text-muted);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  padding: 1px 6px;
  border-radius: var(--radius-full);
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

.oracle-collapsed__tone-badge,
.oracle-collapsed__valence-badge {
  font-size: var(--font-size-xs, 0.75rem);
  color: var(--color-text-muted);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  padding: 1px 6px;
  border-radius: var(--radius-full);
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

.oracle-full__meta {
  display: flex;
  align-items: baseline;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
  font-size: var(--font-size-sm, 0.875rem);
}

.oracle-full__tone-label {
  color: var(--color-text-muted);
}

.oracle-full__tone-val {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.oracle-full__valence {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
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

.oracle-feedback__actions {
  display: flex;
  gap: var(--space-2);
}

.feedback-btn {
  height: 28px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.feedback-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: #3a3a3a;
}
.feedback-btn--active {
  background: var(--color-primary);
  color: var(--color-primary-fg);
  border-color: var(--color-primary);
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
