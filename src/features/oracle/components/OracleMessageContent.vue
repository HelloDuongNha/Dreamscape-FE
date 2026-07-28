<template>
  <div class="oracle-content">
    <template v-for="(block, blockIndex) in blocks" :key="blockIndex">
      <h3 v-if="block.kind === 'heading'" class="oracle-content__heading">
        <template v-for="(part, partIndex) in splitOracleInlineParts(textOf(block))" :key="partIndex">
          <button v-if="part.citationIndex" class="oracle-content__citation" @click="$emit('open-citation', part.citationIndex)">[{{ part.citationIndex }}]</button>
          <span v-else-if="part.unsupported" class="oracle-content__unsupported" :title="t('oracle.unsupportedClaimHelp')">[?]</span>
          <strong v-else-if="part.strong">{{ part.text }}</strong>
          <template v-else>{{ part.text }}</template>
        </template>
      </h3>
      <ol v-else-if="block.kind === 'ordered'" class="oracle-content__list">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          <template v-for="(part, partIndex) in splitOracleInlineParts(item)" :key="partIndex">
            <button v-if="part.citationIndex" class="oracle-content__citation" @click="$emit('open-citation', part.citationIndex)">[{{ part.citationIndex }}]</button>
            <span v-else-if="part.unsupported" class="oracle-content__unsupported" :title="t('oracle.unsupportedClaimHelp')">[?]</span>
            <strong v-else-if="part.strong">{{ part.text }}</strong>
            <template v-else>{{ part.text }}</template>
          </template>
        </li>
      </ol>
      <ul v-else-if="block.kind === 'unordered'" class="oracle-content__list">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          <template v-for="(part, partIndex) in splitOracleInlineParts(item)" :key="partIndex">
            <button v-if="part.citationIndex" class="oracle-content__citation" @click="$emit('open-citation', part.citationIndex)">[{{ part.citationIndex }}]</button>
            <span v-else-if="part.unsupported" class="oracle-content__unsupported" :title="t('oracle.unsupportedClaimHelp')">[?]</span>
            <strong v-else-if="part.strong">{{ part.text }}</strong>
            <template v-else>{{ part.text }}</template>
          </template>
        </li>
      </ul>
      <hr v-else-if="block.kind === 'divider'" class="oracle-content__divider" />
      <p v-else class="oracle-content__paragraph">
        <template v-for="(part, partIndex) in splitOracleInlineParts(textOf(block))" :key="partIndex">
          <button v-if="part.citationIndex" class="oracle-content__citation" @click="$emit('open-citation', part.citationIndex)">[{{ part.citationIndex }}]</button>
          <span v-else-if="part.unsupported" class="oracle-content__unsupported" :title="t('oracle.unsupportedClaimHelp')">[?]</span>
          <strong v-else-if="part.strong">{{ part.text }}</strong>
          <template v-else>{{ part.text }}</template>
        </template>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { splitOracleInlineParts } from '@/features/oracle/services/oracleInlineContent.service'

const props = defineProps<{ content: string }>()
const { t } = useI18n()
defineEmits<{ (e: 'open-citation', index: number): void }>()

type Block =
  | { kind: 'paragraph' | 'heading'; text: string }
  | { kind: 'ordered' | 'unordered'; items: string[] }
  | { kind: 'divider' }

const blocks = computed<Block[]>(() => {
  const result: Block[] = []
  const lines = props.content.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  let list: { kind: 'ordered' | 'unordered'; items: string[] } | null = null

  const flushParagraph = () => {
    const text = paragraph.join(' ').trim()
    if (text) result.push({ kind: 'paragraph', text })
    paragraph = []
  }
  const flushList = () => {
    if (list) result.push(list)
    list = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }
    const heading = line.match(/^#{1,3}\s+(.+)$/)
    const ordered = line.match(/^\d+[.)]\s+(.+)$/)
    const unordered = line.match(/^[-*]\s+(.+)$/)
    const divider = /^(?:\*{3,}|-{3,}|_{3,})$/.test(line)
    if (divider) {
      flushParagraph()
      flushList()
      result.push({ kind: 'divider' })
    } else if (heading) {
      flushParagraph()
      flushList()
      result.push({ kind: 'heading', text: heading[1] })
    } else if (ordered || unordered) {
      flushParagraph()
      const kind = ordered ? 'ordered' : 'unordered'
      if (!list || list.kind !== kind) flushList()
      if (!list) list = { kind, items: [] }
      list.items.push((ordered || unordered)![1])
    } else {
      flushList()
      paragraph.push(line)
    }
  }
  flushParagraph()
  flushList()
  return result
})

function textOf(block: Block): string {
  return 'text' in block ? block.text : ''
}
</script>

<style scoped>
.oracle-content {
  display: grid;
  gap: 0.72rem;
  overflow-wrap: anywhere;
}

.oracle-content__paragraph,
.oracle-content__heading,
.oracle-content__list {
  margin: 0;
}

.oracle-content__heading {
  color: var(--color-text-primary, #f7f7f8);
  font-size: 1rem;
  line-height: 1.5;
}

.oracle-content__list {
  display: grid;
  gap: 0.45rem;
  padding-left: 1.35rem;
}

.oracle-content strong {
  color: var(--color-text-primary, #f7f7f8);
  font-weight: 650;
}

.oracle-content__citation {
  margin: 0 0.08rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary, #8aa7ff);
  cursor: pointer;
  font: inherit;
  font-size: 0.76em;
  font-weight: 700;
  line-height: 1;
  vertical-align: super;
}

.oracle-content__citation:hover {
  text-decoration: underline;
}

.oracle-content__unsupported {
  margin-left: 0.08rem;
  color: #d6a75f;
  cursor: help;
  font-size: 0.76em;
  font-weight: 750;
  line-height: 1;
  vertical-align: super;
}

.oracle-content__divider {
  width: 100%;
  margin: 0.35rem 0;
  border: 0;
  border-top: 1px solid var(--color-border, #303030);
}
</style>
