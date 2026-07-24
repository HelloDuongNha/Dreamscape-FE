<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue && citation"
        class="oracle-citation-modal__overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('oracle.sourceDetails')"
        @keydown.esc="close"
      >
        <section ref="modalRef" class="oracle-citation-modal" tabindex="-1">
          <header>
            <div>
              <span>{{ t('oracle.academicSource') }} · [{{ citation.index }}]</span>
              <h2>
                {{ citation.title }}
                <small v-if="citation.year">({{ citation.year }})</small>
              </h2>
            </div>
            <button type="button" :aria-label="t('oracle.close')" @click="close">×</button>
          </header>

          <div class="oracle-citation-modal__body">
            <section class="oracle-citation-evidence">
              <h3>{{ t('oracle.sourceExactEvidence') }}</h3>
              <blockquote>{{ citation.excerpt }}</blockquote>
            </section>

            <section v-if="interactiveRules.length">
              <h3>{{ t('oracle.sourceSupportsRules') }}</h3>
              <p class="oracle-citation-modal__section-help">
                {{ t('oracle.sourceInteractiveRulesHelp', { count: interactiveRules.length }) }}
              </p>
              <article
                v-for="rule in interactiveRules"
                :key="rule.ruleId"
                class="oracle-citation-rule"
              >
                <div class="oracle-citation-rule__heading">
                  <p>{{ localizedStatement(rule) }}</p>
                  <div
                    class="oracle-score"
                    :title="t('oracle.sourceArgumentScoreHelp')"
                  >
                    <Transition name="score-delta">
                      <b
                        v-if="scoreDeltas[rule.ruleId]"
                        :class="scoreDeltas[rule.ruleId] > 0 ? 'is-positive' : 'is-negative'"
                      >
                        {{ scoreDeltas[rule.ruleId] > 0 ? '+' : '' }}{{ scoreDeltas[rule.ruleId] }}
                      </b>
                    </Transition>
                    <strong>{{ rule.evidenceScore }}</strong><span>/100</span>
                    <small>{{ t('oracle.sourceArgumentScore') }}</small>
                  </div>
                </div>

                <details>
                  <summary>{{ t('oracle.sourceRuleEvidence') }}</summary>
                  <blockquote>{{ rule.quote }}</blockquote>
                </details>

                <div v-if="rule.verificationQuestion" class="oracle-citation-rule__verification">
                  <h4>{{ t('oracle.sourceCaseQuestion') }}</h4>
                  <p>{{ localizedQuestion(rule) }}</p>
                  <AppFeedbackChoiceGroup
                    :model-value="rule.currentUserAnswer"
                    :yes-label="t('oracle.answerYes')"
                    :no-label="t('oracle.answerNo')"
                    :unsure-label="t('oracle.answerUnsure')"
                    :aria-label="t('oracle.sourceCaseQuestion')"
                    :disabled="Boolean(savingRuleId)"
                    @update:model-value="submit(rule, $event)"
                  />
                </div>
              </article>
            </section>
          </div>

          <footer>
            <AppButton variant="ghost" @click="close">{{ t('oracle.close') }}</AppButton>
            <AppButton suffix-icon="↗" @click="$emit('open-source', citation.sourceId)">
              {{ t('oracle.openFullSource') }}
            </AppButton>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/common/AppButton.vue'
import AppFeedbackChoiceGroup, { type FeedbackChoice } from '@/components/common/AppFeedbackChoiceGroup.vue'
import {
  submitOracleCitationFeedback,
  type OracleCitationDto,
  type OracleCitationRuleLinkDto,
} from '@/api/oracleApi'
import { useSettingsStore } from '@/store/useSettingsStore'

const props = defineProps<{
  modelValue: boolean
  messageId: string
  citation: OracleCitationDto | null
}>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'open-source', sourceId: string): void
}>()
const { t, locale } = useI18n()
const settingsStore = useSettingsStore()
const savingRuleId = ref('')
const modalRef = ref<HTMLElement | null>(null)
const scoreDeltas = ref<Record<string, number>>({})
const deltaTimers = new Map<string, ReturnType<typeof setTimeout>>()
const interactiveRules = computed(() =>
  (props.citation?.ruleLinks || []).filter((rule) => Boolean(rule.verificationQuestion)),
)

watch(() => props.modelValue, async (open) => {
  if (!open) return
  await nextTick()
  modalRef.value?.focus()
})

onBeforeUnmount(() => {
  for (const timer of deltaTimers.values()) clearTimeout(timer)
  deltaTimers.clear()
})

function close() {
  emit('update:modelValue', false)
}

function localizedStatement(rule: OracleCitationRuleLinkDto): string {
  const language = String(locale.value).startsWith('en') ? 'en' : 'vi'
  return rule.localizedStatement?.[language] || rule.statement
}

function localizedQuestion(rule: OracleCitationRuleLinkDto): string {
  const language = String(locale.value).startsWith('en') ? 'en' : 'vi'
  return rule.localizedVerificationQuestion?.[language] || rule.verificationQuestion || ''
}

async function submit(rule: OracleCitationRuleLinkDto, answer: FeedbackChoice | null) {
  if (!props.citation || savingRuleId.value) return
  savingRuleId.value = rule.ruleId
  try {
    const result = await submitOracleCitationFeedback({
      turnId: props.messageId,
      citationIndex: props.citation.index,
      ruleId: rule.ruleId,
      answer,
    })
    rule.currentUserAnswer = answer
    for (const update of result.scoreUpdates) {
      const visibleRule = props.citation.ruleLinks?.find((item) => item.ruleId === update.ruleId)
      if (!visibleRule) continue
      visibleRule.evidenceScore = update.score
      const displayedDelta = update.voteDelta || update.scoreDelta
      if (displayedDelta) {
        scoreDeltas.value[update.ruleId] = displayedDelta
        const previousTimer = deltaTimers.get(update.ruleId)
        if (previousTimer) clearTimeout(previousTimer)
        deltaTimers.set(update.ruleId, setTimeout(() => {
          delete scoreDeltas.value[update.ruleId]
          deltaTimers.delete(update.ruleId)
        }, 2600))
      }
    }
    const delta = result.scoreDelta
    const message = delta > 0
      ? t('oracle.sourceScoreIncreased', { points: delta })
      : delta < 0
        ? t('oracle.sourceScoreDecreased', { points: Math.abs(delta) })
        : answer === null
          ? t('oracle.sourceVoteRemoved')
          : t('oracle.sourceScoreUnchanged')
    settingsStore.showToast(message, 'success')
  } catch (error: any) {
    settingsStore.showToast(error.response?.data?.message || t('oracle.sourceVoteFailed'), 'error')
  } finally {
    savingRuleId.value = ''
  }
}
</script>

<style scoped>
.oracle-citation-modal__overlay{position:fixed;inset:0;z-index:var(--z-modal,300);display:grid;place-items:center;padding:20px;background:rgb(0 0 0 / 62%)}
.oracle-citation-modal{display:flex;flex-direction:column;width:min(760px,100%);max-height:min(820px,92vh);overflow:hidden;border:1px solid var(--color-border);border-radius:18px;background:var(--color-bg-surface);color:var(--color-text-primary);box-shadow:0 22px 70px rgb(0 0 0 / 38%)}
.oracle-citation-modal>header,.oracle-citation-modal>footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 20px;border-color:var(--color-border)}
.oracle-citation-modal>header{border-bottom:1px solid var(--color-border)}.oracle-citation-modal>footer{justify-content:flex-end;border-top:1px solid var(--color-border)}
.oracle-citation-modal>header span{color:var(--color-text-muted);font-size:11px}.oracle-citation-modal h2{margin:4px 0 0;font-size:18px;line-height:1.35}.oracle-citation-modal h2 small{color:var(--color-text-muted);font-size:.78em;font-weight:600}
.oracle-citation-modal>header button{border:0;background:transparent;color:var(--color-text-muted);font-size:25px;cursor:pointer}.oracle-citation-modal>header button:hover{color:var(--color-text-primary)}
.oracle-citation-modal__body{display:grid;gap:24px;overflow:auto;padding:20px}.oracle-citation-modal__body h3{margin:0 0 8px;font-size:14px}
.oracle-citation-modal blockquote{margin:0;padding:14px 16px;border-left:3px solid var(--color-primary);border-radius:0 10px 10px 0;background:var(--color-bg-elevated);color:var(--color-text-secondary);font-size:13px;line-height:1.7;white-space:pre-wrap}
.oracle-citation-modal__section-help{margin:0 0 12px;color:var(--color-text-muted);font-size:11px;line-height:1.5}
.oracle-citation-rule{display:grid;gap:14px;padding:16px;border:1px solid var(--color-border);border-radius:14px;background:color-mix(in srgb,var(--color-bg-elevated) 78%,var(--color-bg-surface))}
.oracle-citation-rule+.oracle-citation-rule{margin-top:11px}.oracle-citation-rule__heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.oracle-citation-rule__heading>p{margin:2px 0 0;color:var(--color-text-primary);font-size:13px;font-weight:650;line-height:1.52}
.oracle-score{position:relative;display:grid;grid-template-columns:auto auto;align-content:center;justify-content:center;min-width:78px;padding:10px 10px 8px;border:1px solid rgb(96 165 250 / 35%);border-radius:12px;background:rgb(59 130 246 / 10%);color:#93c5fd;text-align:center}.oracle-score strong{font-size:19px;line-height:1}.oracle-score>span{align-self:end;font-size:10px}.oracle-score small{grid-column:1/-1;margin-top:5px;color:var(--color-text-muted);font-size:9px;line-height:1.15}.oracle-score>b{position:absolute;top:-9px;right:-8px;display:grid;place-items:center;min-width:27px;height:20px;padding:0 5px;border:2px solid var(--color-bg-surface);border-radius:999px;font-size:10px;box-shadow:0 3px 9px rgb(0 0 0 / 22%)}.oracle-score>b.is-positive{background:#0f9f6e;color:white}.oracle-score>b.is-negative{background:#dc4c55;color:white}
.oracle-citation-rule details summary{cursor:pointer;color:var(--color-text-secondary);font-size:12px}.oracle-citation-rule details blockquote{margin-top:9px}
.oracle-citation-rule__verification{padding-top:12px;border-top:1px solid var(--color-border)}.oracle-citation-rule__verification h4{margin:0 0 6px;font-size:12px}.oracle-citation-rule__verification p{margin:0;color:var(--color-text-secondary);font-size:13px;line-height:1.55}
.oracle-citation-rule__verification :deep(.feedback-choice-group){margin-top:11px}.score-delta-enter-active,.score-delta-leave-active{transition:transform .18s ease,opacity .18s ease}.score-delta-enter-from,.score-delta-leave-to{transform:translateY(4px) scale(.8);opacity:0}.modal-fade-enter-active,.modal-fade-leave-active{transition:opacity .18s ease}.modal-fade-enter-active .oracle-citation-modal,.modal-fade-leave-active .oracle-citation-modal{transition:transform .18s ease,opacity .18s ease}.modal-fade-enter-from,.modal-fade-leave-to{opacity:0}.modal-fade-enter-from .oracle-citation-modal,.modal-fade-leave-to .oracle-citation-modal{transform:translateY(10px);opacity:0}
@media(max-width:600px){.oracle-citation-modal__overlay{padding:0}.oracle-citation-modal{width:100%;height:100%;max-height:none;border-radius:0}.oracle-citation-rule__heading{align-items:flex-start}}
</style>
