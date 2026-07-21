<template>
  <div class="rule-review-page">
    <div v-if="isUnauthorized" class="empty-panel">
      <h3>Không có quyền truy cập</h3>
      <p>Bạn không có quyền duyệt tri thức học thuật.</p>
    </div>

    <template v-else>
      <header class="page-header">
        <div>
          <p class="eyebrow">Kiểm duyệt quy luật học thuật</p>
          <h1>Duyệt tri thức học thuật</h1>
          <p>Đối chiếu kết luận với bằng chứng nguồn trước khi đưa vào phân tích giấc mơ.</p>
        </div>
        <div class="header-actions">
          <div v-if="activeStatus === 'pending' || activeStatus === 'rejected'" class="bulk-actions">
            <template v-if="activeStatus === 'pending'">
              <AppButton variant="smart" @click="openBulkAction('approve_pending')">Duyệt tất cả{{ sourceIdFilter ? ' của tài liệu' : '' }}</AppButton>
              <AppButton variant="danger-outline" @click="openBulkAction('reject_pending')">Từ chối tất cả{{ sourceIdFilter ? ' của tài liệu' : '' }}</AppButton>
            </template>
            <template v-else>
              <AppButton variant="secondary" @click="openBulkAction('restore_rejected')">Khôi phục tất cả{{ sourceIdFilter ? ' của tài liệu' : '' }}</AppButton>
              <AppButton variant="danger-outline" @click="openBulkAction('delete_rejected')">Xóa tất cả{{ sourceIdFilter ? ' của tài liệu' : '' }}</AppButton>
            </template>
          </div>
          <div class="header-count">
            <strong>{{ candidates.length }}</strong>
            <span>{{ activeTabLabel.toLowerCase() }}</span>
          </div>
        </div>
      </header>

      <div v-if="sourceIdFilter" class="source-filter">
        <span>Đang lọc theo một tài liệu</span>
        <button type="button" @click="clearSourceFilter">Bỏ lọc</button>
      </div>

      <nav class="status-tabs" aria-label="Trạng thái quy luật">
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
            <span>Đang tải quy luật…</span>
          </div>
          <div v-else-if="candidates.length === 0" class="empty-panel compact">
            <h3>Không có dữ liệu</h3>
            <p>{{ sourceIdFilter ? 'Tài liệu này chưa có quy luật ở trạng thái đã chọn.' : 'Chưa có quy luật ở trạng thái đã chọn.' }}</p>
          </div>
          <div v-else class="candidate-list">
            <section v-for="(items, sourceTitle) in groupedCandidates" :key="sourceTitle" class="source-group" :style="sourceGroupStyle(String(sourceTitle))">
              <h2><span>{{ sourceTitle }}</span><small>{{ items.length }} quy luật</small></h2>
              <div class="source-rule-list">
                <button
                  v-for="candidate in items"
                  :key="candidate._id"
                  type="button"
                  :class="['candidate-card', { selected: selectedId === candidate._id }]"
                  @click="selectCandidate(candidate._id)"
                >
                  <span class="candidate-title">{{ candidate.label }}</span>
                  <span class="candidate-card-meta">
                    <span :class="['status-chip', `status-${candidate.status}`]">{{ statusLabel(candidate.status) }}</span>
                    <span class="score-chip" :style="{ color: scoreColor(candidate.evidenceCredibilityScore) }">{{ candidate.evidenceCredibilityScore ?? 0 }}/100</span>
                    <span>{{ candidate.exactCitationCount ?? 0 }} cụm dẫn chứng</span>
                  </span>
                </button>
              </div>
            </section>
          </div>
        </aside>

        <main class="candidate-detail">
          <div v-if="isLoadingDetail" class="loading-state detail-loading">
            <span class="spinner"></span>
            <span>Đang tải kết luận và bằng chứng…</span>
          </div>
          <div v-else-if="!selectedCandidate" class="empty-panel detail-empty">
            <h3>Chọn một quy luật</h3>
            <p>Thông tin đánh giá và trích dẫn sẽ xuất hiện tại đây.</p>
          </div>
          <article v-else class="rule-document">
            <section class="rule-hero">
              <div class="hero-topline">
                <span :class="['status-chip', `status-${selectedCandidate.status}`]">{{ statusLabel(selectedCandidate.status) }}</span>
                <span class="rule-code">{{ selectedCandidate.proposedRuleId }}</span>
              </div>
              <h2>{{ selectedCandidate.label }}</h2>
              <p class="source-line">{{ formattedSource }}</p>
              <div v-if="selectedCandidate.qualityAccepted === false" class="quality-blocked">
                <strong>Không đạt kiểm tra chất lượng</strong>
                <span>{{ selectedCandidate.qualitySummary }}</span>
              </div>
            </section>

            <section class="content-card inference-card">
              <div class="section-heading">
                <div>
                  <h3>Nội dung có thể sử dụng</h3>
                  <p class="section-description">Quan hệ, bối cảnh và giới hạn được rút ra từ tài liệu.</p>
                </div>
              </div>
              <div class="relationship-flow">
                <div>
                  <span>Yếu tố / chủ thể</span>
                  <strong>{{ selectedCandidate.factor || 'Chưa xác định' }}</strong>
                </div>
                <div class="relationship-arrow" aria-hidden="true">→</div>
                <div>
                  <span>Kết quả / hiện tượng</span>
                  <strong>{{ selectedCandidate.inputSource || 'Chưa xác định' }}</strong>
                </div>
              </div>
              <p v-if="selectedCandidate.fullStatement" class="rule-explanation">{{ selectedCandidate.fullStatement }}</p>
              <ul class="rule-reading-guide">
                <li>
                  <strong>Chỉ áp dụng trong bối cảnh:</strong>
                  {{ reviewConditions.length ? punctuatedList(reviewConditions, '; ') : 'Tài liệu chưa nêu bối cảnh đủ cụ thể.' }}
                </li>
                <li>
                  <strong>Dấu hiệu cần xuất hiện trong lời kể:</strong>
                  {{ reviewDreamTags.length ? punctuatedList(reviewDreamTags, ', ') : 'Chưa xác định được dấu hiệu phù hợp.' }}
                </li>
                <li>
                  <strong>Giới hạn cần giữ:</strong>
                  {{ reviewLimitations.length ? punctuatedList(reviewLimitations, '; ') : 'Tài liệu chưa nêu giới hạn đủ rõ.' }}
                </li>
              </ul>
            </section>

            <section class="assessment-grid">
              <div class="content-card assessment-card">
                <div class="score-header">
                  <div>
                    <h3 class="assessment-title">Mức hỗ trợ từ tài liệu</h3>
                    <strong class="score-number" :style="{ color: scoreColor(selectedCandidate.evidenceCredibilityScore) }">{{ selectedCandidate.evidenceCredibilityScore ?? 0 }}/100</strong>
                  </div>
                  <span :class="['level-badge', scoreLevelClass(selectedCandidate.evidenceCredibilityScore)]">
                    {{ scoreLevelLabel(selectedCandidate.evidenceCredibilityScore) }}
                  </span>
                </div>
                <div class="score-track" role="progressbar" aria-label="Mức hỗ trợ từ tài liệu" :aria-valuenow="selectedCandidate.evidenceCredibilityScore ?? 0" aria-valuemin="0" aria-valuemax="100">
                  <span :style="{ width: `${selectedCandidate.evidenceCredibilityScore ?? 0}%`, backgroundColor: scoreColor(selectedCandidate.evidenceCredibilityScore) }"></span>
                </div>
                <p class="score-conclusion">{{ evidenceScoreConclusion }}</p>
                <p class="score-note">Điểm phản ánh mức tài liệu đang hỗ trợ kết luận, không phải xác suất kết luận đúng trong mọi trường hợp.</p>
                <dl class="criteria-list">
                  <div v-for="item in scoreCriteriaRows" :key="item.key" class="criterion-row">
                    <dt>
                      <span>{{ scoreCriterionLabel(item.key) }}</span>
                      <div class="criterion-help">
                        <button type="button" aria-label="Giải thích tiêu chí" @click.stop="toggleCriterionHelp(item.key)">?</button>
                        <div v-if="openCriterionKey === item.key" @click.stop>
                          <strong>Ngưỡng chấm điểm</strong>
                          <ul><li v-for="line in rubricBullets(item.rubric)" :key="line">{{ line }}</li></ul>
                          <strong>Vì sao quy luật nhận {{ item.score }}/{{ item.maxScore }}</strong>
                          <ul><li>{{ item.reason }}</li></ul>
                        </div>
                      </div>
                    </dt>
                    <dd :style="{ color: scoreColor(item.maxScore ? item.score / item.maxScore * 100 : 0) }">{{ item.score }}/{{ item.maxScore }}</dd>
                  </div>
                </dl>
              </div>

            </section>

            <section v-if="ruleRelationships.length" class="content-card relationship-card">
              <div class="section-heading">
                <div>
                  <h3>Quan hệ với các quy luật khác</h3>
                  <p class="section-description">Đối chiếu theo chiều chủ thể → kết quả, điều kiện và chiều tác động; không chỉ so khớp câu chữ.</p>
                </div>
              </div>
              <button v-for="item in ruleRelationships" :key="item.ruleId" type="button" class="related-rule" @click="selectCandidate(item.ruleId)">
                <span :class="['relation-kind', `relation-kind--${item.relationship}`]">{{ relationshipLabel(item.relationship) }}</span>
                <strong>{{ item.label }}</strong>
                <small>{{ item.ruleCode }} · {{ item.evidenceScore }}/100</small>
              </button>
            </section>

            <section v-if="selectedCandidate.probeBlueprint" class="content-card probe-card">
              <div class="section-heading">
                <div>
                  <h3>Khả năng kiểm tra khi áp dụng</h3>
                  <p class="section-description">Chỉ tạo câu hỏi khi chính kết luận học thuật có một điều kiện mà người kể có thể xác nhận hoặc bác bỏ.</p>
                </div>
              </div>
              <p v-if="selectedCandidate.probeBlueprint.checkable">{{ selectedCandidate.probeBlueprint.applicabilityCheck }}</p>
              <p v-else>{{ selectedCandidate.probeBlueprint.explanation }}</p>
              <p v-if="selectedCandidate.probeBlueprint.conditionSummary"><strong>Điều kiện trong tài liệu:</strong> {{ selectedCandidate.probeBlueprint.conditionSummary }}</p>
              <p class="section-description">{{ selectedCandidate.probeBlueprint.feedbackEffect }}</p>
            </section>

            <section class="content-card feedback-card">
              <div class="section-heading">
                <div>
                  <h3>Phản hồi khi áp dụng vào giấc mơ</h3>
                  <p class="section-description">Câu hỏi được viết lại theo từng giấc mơ; thống kê này đo mức phù hợp thực tế, không làm thay đổi điểm học thuật.</p>
                </div>
                <strong>{{ feedbackStats.applicabilityRate === null ? 'Chưa đủ dữ liệu' : `${feedbackStats.applicabilityRate}% phù hợp` }}</strong>
              </div>
              <div class="feedback-bar" :aria-label="`${feedbackStats.total} lượt phản hồi`">
                <span class="feedback-bar__yes" :style="{ width: `${feedbackPercent('supports')}%` }"></span>
                <span class="feedback-bar__no" :style="{ width: `${feedbackPercent('weakens')}%` }"></span>
                <span class="feedback-bar__unsure" :style="{ width: `${feedbackPercent('unresolved')}%` }"></span>
              </div>
              <div class="feedback-reactions">
                <span><b>✓</b> Áp dụng phù hợp · {{ feedbackStats.supports }}</span>
                <span><b>×</b> Không phù hợp trường hợp · {{ feedbackStats.weakens }}</span>
                <span><b>?</b> Chưa đủ thông tin · {{ feedbackStats.unresolved }}</span>
              </div>
              <p v-if="feedbackStats.total === 0" class="feedback-empty">Chưa có phản hồi vì quy luật chưa được áp dụng vào một kết quả phân tích giấc mơ có câu hỏi xác nhận.</p>
            </section>

            <section v-if="evidenceExcerpts.length" class="content-card citations-card">
              <div class="section-heading">
                <div>
                  <h3>Trích dẫn nguồn đã kiểm chứng</h3>
                  <p class="section-description">Mỗi đoạn dưới đây được lấy từ đúng chunk và đã đối chiếu nguyên văn.</p>
                </div>
                <span class="verified-badge">Khớp nguyên văn</span>
              </div>
              <div class="citation-list">
                <article v-for="excerpt in evidenceExcerpts" :key="excerpt.evidenceGroupId" class="citation-item">
                  <div class="citation-meta">
                    <span>{{ excerpt.sourceTitle || 'Tài liệu chưa xác định' }} · {{ excerpt.sectionTitle || excerpt.sectionType || 'Đoạn văn' }}</span>
                    <span v-if="excerpt.pageStart">Trang {{ excerpt.pageStart }}<template v-if="excerpt.pageEnd && excerpt.pageEnd !== excerpt.pageStart">–{{ excerpt.pageEnd }}</template></span>
                  </div>
                  <blockquote>{{ excerpt.excerpt }}</blockquote>
                  <button
                    v-if="hasWiderContext(excerpt)"
                    type="button"
                    class="context-button"
                    @click="toggleContext(excerpt.evidenceGroupId)"
                  >
                    {{ visibleContexts[excerpt.evidenceGroupId] ? 'Ẩn ngữ cảnh' : 'Xem ngữ cảnh rộng' }}
                  </button>
                  <p v-if="visibleContexts[excerpt.evidenceGroupId]" class="context-text">{{ chunkPreview(excerpt.chunkId) }}</p>
                </article>
              </div>
            </section>

            <section v-if="selectedCandidate.status === 'pending'" class="action-bar">
              <div>
                <strong>Quyết định kiểm duyệt</strong>
                <span>{{ selectedCandidate.qualityAccepted === false ? 'Quy luật này không thể duyệt vì chưa vượt qua kiểm tra chất lượng.' : 'Chỉ duyệt khi kết luận phản ánh đúng bằng chứng và có ích cho phân tích.' }}</span>
              </div>
              <div class="action-buttons">
                <AppButton variant="danger-outline" :loading="isRejecting" @click="showRejectModal = true">Từ chối</AppButton>
                <AppButton variant="smart" :disabled="selectedCandidate.qualityAccepted === false" :loading="isApproving" @click="showApproveModal = true">Phê duyệt</AppButton>
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
            <div class="modal-header"><h3>Phê duyệt quy luật?</h3><button @click="showApproveModal = false">×</button></div>
            <div class="modal-body"><p>Quy luật sẽ được đưa vào kho tri thức đang hoạt động cùng các trích dẫn đã kiểm chứng.</p></div>
            <div class="modal-footer">
              <AppButton variant="secondary" @click="showApproveModal = false">Hủy</AppButton>
              <AppButton variant="smart" :loading="isApproving" @click="confirmApproval">Phê duyệt</AppButton>
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
              <AppButton variant="secondary" :disabled="isBulkRunning" @click="bulkAction = null">Hủy</AppButton>
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
            <div class="modal-header"><h3>Từ chối quy luật?</h3><button @click="showRejectModal = false">×</button></div>
            <div class="modal-body"><p>Quy luật sẽ được chuyển sang danh sách bị từ chối. Nội dung học thuật gốc không bị thay đổi.</p></div>
            <div class="modal-footer">
              <AppButton variant="secondary" @click="showRejectModal = false">Hủy</AppButton>
              <AppButton variant="danger" :loading="isRejecting" @click="confirmRejection">Từ chối</AppButton>
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
import AppButton from '@/components/common/AppButton.vue'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
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

const isUnauthorized = computed(() => {
  const ids = (import.meta.env.VITE_MODERATOR_USER_IDS || '').split(',').map((id: string) => id.trim().toLowerCase())
  return !authStore.user?._id || !ids.includes(authStore.user._id.toLowerCase())
})

const statusTabs = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Bị từ chối' }
]
const activeStatus = ref('pending')
const sourceIdFilter = computed(() => route.query.sourceId ? String(route.query.sourceId) : null)
const candidates = ref<RuleCandidate[]>([])
const selectedId = ref<string | null>(null)
const selectedCandidate = ref<RuleCandidate | null>(null)
const evidenceChunks = ref<EvidenceChunkPreview[]>([])
const evidenceExcerpts = ref<EvidenceExcerpt[]>([])
type RuleRelationshipRow = NonNullable<CandidateDetailResponse['ruleRelationships']>[number]
const ruleRelationships = ref<RuleRelationshipRow[]>([])
const emptyFeedbackStats = () => ({ supports: 0, weakens: 0, unresolved: 0, total: 0, applicabilityRate: null as number | null })
const feedbackStats = ref(emptyFeedbackStats())
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

const activeTabLabel = computed(() => statusTabs.find(tab => tab.value === activeStatus.value)?.label || '')
const bulkActionCopy = computed(() => ({
  approve_pending: { title: 'Duyệt tất cả quy luật đang chờ?', message: 'Chỉ quy luật vượt qua cổng kiểm chứng và tạo được chỉ mục truy hồi mới được duyệt. Các quy luật lỗi sẽ được giữ lại để kiểm tra.', confirm: 'Duyệt tất cả', danger: false },
  reject_pending: { title: 'Từ chối tất cả quy luật đang chờ?', message: 'Các quy luật trong phạm vi đang xem sẽ được chuyển sang danh sách bị từ chối.', confirm: 'Từ chối tất cả', danger: true },
  restore_rejected: { title: 'Khôi phục tất cả quy luật?', message: 'Các quy luật bị từ chối trong phạm vi đang xem sẽ trở lại hàng chờ duyệt.', confirm: 'Khôi phục tất cả', danger: false },
  delete_rejected: { title: 'Xóa vĩnh viễn tất cả quy luật bị từ chối?', message: 'Quy luật và toàn bộ liên kết dẫn chứng của chúng sẽ bị xóa. Thao tác này không thể hoàn tác.', confirm: 'Xóa vĩnh viễn', danger: true }
} as const)[bulkAction.value || 'approve_pending'])
const groupedCandidates = computed(() => {
  const groups: Record<string, RuleCandidate[]> = {}
  for (const candidate of candidates.value) {
    const title = candidate.sourceTitle || 'Tài liệu chưa xác định'
    if (!groups[title]) groups[title] = []
    groups[title].push(candidate)
  }
  return groups
})

const formattedSource = computed(() => {
  const candidate = selectedCandidate.value
  if (!candidate) return ''
  const authors = candidate.sourceAuthors?.length ? candidate.sourceAuthors.join(', ') : 'Chưa xác định tác giả'
  const year = candidate.sourceYear ? ` (${candidate.sourceYear})` : ''
  const title = candidate.sourceTitle || 'Tài liệu chưa có tiêu đề'
  const doi = candidate.sourceDoi ? ` · DOI ${candidate.sourceDoi}` : ''
  return `${authors}${year} · ${title}${doi}`
})

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

function punctuatedList(items: string[], separator: string) {
  const value = items.map(item => item.trim()).filter(Boolean).join(separator)
  return /[.!?]$/u.test(value) ? value : `${value}.`
}

const evidenceScoreConclusion = computed(() => {
  const candidate = selectedCandidate.value
  const score = candidate?.evidenceCredibilityScore || 0
  const citations = candidate?.supportingCitationCount || 0
  const sources = candidate?.independentSourceCount || 0
  if (score >= 80) return `Bằng chứng hỗ trợ mạnh: ${citations} trích dẫn hỗ trợ đã kiểm chứng từ ${sources} nguồn độc lập.`
  if (score >= 60) return `Bằng chứng đã có mức xác nhận vừa phải; hiện có ${citations} trích dẫn hỗ trợ từ ${sources} nguồn.`
  if (score >= 40) return `Bằng chứng còn giới hạn: kết luận có dẫn chứng trực tiếp nhưng độ phủ hoặc xác nhận từ nguồn độc lập còn thiếu.`
  return 'Bằng chứng yếu hoặc chưa đủ trực tiếp; không nên dùng quy luật này để diễn giải giấc mơ ở trạng thái hiện tại.'
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
    settingsStore.showToast(failed ? `Đã xử lý ${response.data.processed} quy luật; ${failed} quy luật cần kiểm tra riêng.` : `Đã xử lý ${response.data.processed} quy luật.`, failed ? 'error' : 'success')
    bulkAction.value = null
    await fetchCandidates()
  } catch (error: any) {
    settingsStore.showToast(error.response?.data?.message || 'Không thể thực hiện thao tác hàng loạt.', 'error')
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
      feedbackStats.value = emptyFeedbackStats()
    }
  } catch {
    settingsStore.showToast('Không thể tải danh sách Rule V3.', 'error')
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
    feedbackStats.value = response.data.feedbackStats || emptyFeedbackStats()
    visibleContexts.value = {}
  } catch {
    selectedCandidate.value = null
    ruleRelationships.value = []
    feedbackStats.value = emptyFeedbackStats()
    settingsStore.showToast('Không thể tải chi tiết Rule V3.', 'error')
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
    settingsStore.showToast('Đã phê duyệt quy luật.', 'success')
    await fetchCandidates()
  } catch (error: any) {
    settingsStore.showToast(error.response?.data?.message || 'Không thể phê duyệt quy luật.', 'error')
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
    settingsStore.showToast('Đã từ chối quy luật.', 'success')
    await fetchCandidates()
  } catch (error: any) {
    settingsStore.showToast(error.response?.data?.message || 'Không thể từ chối quy luật.', 'error')
  } finally {
    isRejecting.value = false
  }
}

function chunkPreview(chunkId: string) {
  return evidenceChunks.value.find(item => item.chunkId === chunkId)?.chunkPreview || ''
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
onBeforeUnmount(() => document.removeEventListener('click', closeCriterionHelp))

function statusLabel(status: string) {
  return ({ pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Bị từ chối' } as Record<string, string>)[status] || status
}

function scoreCriterionLabel(value: string) {
  return ({
    source_breadth: 'Số nguồn độc lập hỗ trợ',
    research_fit: 'Độ phù hợp của thiết kế nghiên cứu',
    evidence_breadth: 'Độ phủ dẫn chứng theo chunk',
    scope_definition: 'Phạm vi và giới hạn được nêu rõ',
    conflict_handling: 'Kiểm tra bằng chứng trái chiều'
  } as Record<string, string>)[value] || value
}

function relationshipLabel(value: string) {
  return ({
    equivalent: 'Cùng nội dung',
    overlapping: 'Liên quan nhưng khác phạm vi',
    contradictory: 'Kết luận trái chiều',
    reverse_direction: 'Quan hệ đảo chiều'
  } as Record<string, string>)[value] || value
}

function feedbackPercent(key: 'supports' | 'weakens' | 'unresolved') {
  return feedbackStats.value.total > 0 ? Math.round(feedbackStats.value[key] / feedbackStats.value.total * 100) : 0
}

function sourceGroupStyle(title: string) {
  let hash = 0
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const hues = [218, 252, 176, 32, 326, 198]
  return { '--source-group-hue': String(hues[hash % hues.length]) }
}

function scoreLevelLabel(score?: number) {
  const value = score || 0
  return value >= 80 ? 'Mạnh' : value >= 60 ? 'Vừa phải' : value >= 40 ? 'Có giới hạn' : 'Yếu'
}

function scoreLevelClass(score?: number) {
  const value = score || 0
  return value >= 80 ? 'level-good' : value >= 60 ? 'level-moderate' : 'level-caution'
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
.score-chip { color: #93c5fd; font-weight: 700; }.status-chip { display: inline-flex; width: fit-content; padding: 3px 8px; border-radius: 999px; font-size: .68rem; font-weight: 700; }
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
.assessment-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }.assessment-card h3 { font-size: 1.45rem; }.level-badge, .verified-badge { padding: 5px 9px; border-radius: 999px; font-size: .7rem; font-weight: 750; }.level-good, .verified-badge { color: #34d399; background: rgba(16,185,129,.12); }.level-moderate { color: #60a5fa; background: rgba(59,130,246,.12); }.level-caution { color: #fbbf24; background: rgba(245,158,11,.12); }
.assessment-title { font-size: .95rem !important; }.score-number { display: block; margin-top: 5px; font-size: 1.65rem; line-height: 1; }.score-track { width: 100%; height: 9px; margin: 14px 0; border: 1px solid rgba(148,163,184,.16); border-radius: 999px; overflow: hidden; background: #111827; }.score-track span { display: block; min-width: 2px; height: 100%; border-radius: inherit; transition: width .25s ease; }.score-conclusion { margin: 0 0 7px; color: var(--color-text-primary); font-size: .8rem; line-height: 1.5; }.score-note { color: var(--color-text-muted); font-size: .76rem; line-height: 1.5; }
.criteria-list { display: flex; flex-direction: column; margin: 16px 0 0; border-top: 1px solid var(--color-border); }.criterion-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--color-border); font-size: .78rem; }.criterion-row dt { display: flex; align-items: center; gap: 7px; color: var(--color-text-secondary); }.criterion-row dd { margin: 0; color: var(--color-text-primary); font-weight: 700; }.criterion-help { position: relative; }.criterion-help button { display: grid; place-items: center; width: 18px; height: 18px; padding: 0; border: 1px solid var(--color-border); border-radius: 50%; background: transparent; color: var(--color-text-muted); cursor: pointer; font-size: .68rem; font-weight: 700; }.criterion-help > div { position: absolute; z-index: 20; top: 25px; left: 0; width: min(350px, 72vw); padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); box-shadow: 0 12px 30px rgba(0,0,0,.24); color: var(--color-text-secondary); font-size: .75rem; line-height: 1.45; }.criterion-help > div strong { color: var(--color-text-primary); }.criterion-help > div p { margin: 5px 0 0; }.criterion-help > div ul { margin: 7px 0 12px; padding-left: 20px; list-style: disc outside; }.criterion-help > div li { margin: 5px 0; padding-left: 2px; }.quality-blocked { display: flex; flex-direction: column; gap: 3px; margin-top: 15px; padding: 11px 13px; border: 1px solid rgba(239,68,68,.32); border-radius: var(--radius-md); color: #fca5a5; font-size: .78rem; }.quality-blocked span { color: var(--color-text-secondary); }
.citation-list { display: flex; flex-direction: column; gap: 12px; margin-top: 17px; }.citation-item { padding: 15px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); }.citation-meta { display: flex; justify-content: space-between; gap: 10px; color: var(--color-text-muted); font-size: .7rem; }.citation-item blockquote { margin: 12px 0; padding-left: 14px; border-left: 3px solid var(--accent); color: var(--color-text-primary); font-size: .9rem; line-height: 1.65; }.context-button { padding: 0; border: 0; background: transparent; color: var(--accent); cursor: pointer; font-size: .76rem; }.context-text { margin: 12px 0 0; padding: 12px; border-radius: var(--radius-md); background: var(--color-bg-base); color: var(--color-text-secondary); font-size: .78rem; line-height: 1.55; white-space: pre-wrap; }
.relationship-card { display: grid; gap: 9px; }.related-rule { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); color: inherit; text-align: left; cursor: pointer; }.related-rule:hover { border-color: rgba(129,140,248,.42); }.related-rule strong { min-width: 0; color: var(--color-text-primary); font-size: .8rem; line-height: 1.4; }.related-rule small { color: var(--color-text-muted); white-space: nowrap; }.relation-kind { padding: 3px 7px; border-radius: 999px; color: #a5b4fc; background: rgba(99,102,241,.1); font-size: .65rem; font-weight: 700; }.relation-kind--contradictory { color: #fca5a5; background: rgba(239,68,68,.1); }.relation-kind--reverse_direction { color: #fcd34d; background: rgba(245,158,11,.1); }
.feedback-card { display: grid; gap: 12px; }.feedback-card .section-heading > strong { color: var(--color-text-primary); font-size: .8rem; }.feedback-bar { display: flex; width: 100%; height: 7px; overflow: hidden; border-radius: 999px; background: var(--color-bg-elevated); }.feedback-bar span { display: block; height: 100%; transition: width .25s ease; }.feedback-bar__yes { background: #34d399; }.feedback-bar__no { background: #f87171; }.feedback-bar__unsure { background: #94a3b8; }.feedback-reactions { display: flex; flex-wrap: wrap; gap: 8px; }.feedback-reactions span { padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-bg-elevated); color: var(--color-text-secondary); font-size: .72rem; }.feedback-reactions b { color: var(--color-text-primary); }.feedback-empty { margin: 0; color: var(--color-text-muted); font-size: .75rem; line-height: 1.5; }
.probe-card { display: grid; gap: 13px; }.probe-facts { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; margin: 0; }.probe-facts div { padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); }.probe-facts dt { color: var(--color-text-muted); font-size: .68rem; }.probe-facts dd { margin: 5px 0 0; color: var(--color-text-primary); font-size: .78rem; line-height: 1.45; }.probe-heading { color: var(--color-text-primary); font-size: .78rem; }.probe-questions { display: grid; gap: 7px; margin: 0; padding-left: 20px; color: var(--color-text-secondary); font-size: .78rem; line-height: 1.5; }
.action-bar { position: sticky; bottom: -30px; display: flex; align-items: center; justify-content: space-between; gap: 18px; margin: var(--space-5) -30px -30px; padding: 14px 30px; border-top: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-bg-elevated) 94%, transparent); backdrop-filter: blur(10px); }.action-bar strong, .action-bar span { display: block; }.action-bar span { margin-top: 3px; color: var(--color-text-muted); font-size: .72rem; }.action-buttons { display: flex; gap: 10px; }
.modal-overlay { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.64); }.modal-container { width: min(440px,100%); border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg-elevated); box-shadow: 0 20px 60px rgba(0,0,0,.35); }.modal-header, .modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; }.modal-header { border-bottom: 1px solid var(--color-border); }.modal-header h3 { margin: 0; }.modal-header button { border: 0; background: transparent; color: var(--color-text-muted); font-size: 1.5rem; cursor: pointer; }.modal-body { padding: 18px; color: var(--color-text-secondary); }.modal-body p { margin: 0; line-height: 1.55; }.modal-footer { justify-content: flex-end; border-top: 1px solid var(--color-border); }
@media (max-width: 1050px) { .review-layout { grid-template-columns: 280px minmax(0,1fr); }.assessment-grid { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .rule-review-page { height: auto; min-height: calc(100dvh - 72px); overflow: visible; }.page-header { align-items: flex-start; flex-direction: column; }.header-actions { width: 100%; justify-content: flex-start; }.bulk-actions { justify-content: flex-start; }.header-count { display: none; }.review-layout { grid-template-columns: 1fr; }.candidate-list { height: 300px; min-height: 300px; }.rule-document { height: auto; min-height: 620px; }.relationship-flow, .probe-facts { grid-template-columns: 1fr; }.relationship-arrow { transform: rotate(90deg); justify-self: center; }.action-bar { position: static; flex-direction: column; align-items: stretch; margin: var(--space-5) 0 0; padding: 14px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); }.action-buttons { justify-content: flex-end; } }
</style>
