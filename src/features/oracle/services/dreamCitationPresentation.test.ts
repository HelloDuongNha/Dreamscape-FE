import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDreamCitationSources,
  selectDreamVerificationQuestions,
} from './dreamCitationPresentation.service'

function resolvedBinding(sourceId: string, citationIndex: number, verificationKey: string) {
  return {
    claimId: `claim-${sourceId}`,
    claimText: `Claim ${sourceId}.`,
    contentPath: 'core_analysis',
    status: 'resolved',
    source: { sourceId },
    ruleId: `rule-${sourceId}`,
    evidenceId: `evidence-${sourceId}`,
    citationIndex,
    verificationKey,
  }
}

function question(sourceId: string, verificationKey: string) {
  return {
    ruleId: `rule-${sourceId}`,
    hypothesis: `Claim ${sourceId}.`,
    followUpQuestion: `Question ${sourceId}?`,
    verificationKey,
    validationSourceId: sourceId,
    validationExactQuote: `Quote ${sourceId}.`,
    sources: [{ sourceId, title: `Source ${sourceId}`, chunkIds: ['chunk-1'] }],
    userFeedback: null,
  }
}

test('an unresolved ledger hides stale citations and questions', () => {
  const analysis: any = {
    claim_bindings: [{
      claimId: 'claim-1',
      claimText: 'Claim one.',
      contentPath: 'core_analysis',
      status: 'unresolved',
    }],
    citations: [{
      index: 1,
      sourceType: 'academic_source',
      sourceId: 'source-1',
      title: 'Stale source',
      excerpt: 'Stale quote.',
    }],
    real_life_hypotheses: [question('source-1', 'question-1')],
  }

  assert.deepEqual(selectDreamVerificationQuestions(analysis), [])
  assert.deepEqual(buildDreamCitationSources(analysis, 'Academic source'), [])
})

test('one resolved source exposes one question and its stored citation index', () => {
  const analysis: any = {
    claim_bindings: [resolvedBinding('source-1', 3, 'question-1')],
    citations: [{
      index: 3,
      sourceType: 'academic_source',
      sourceId: 'source-1',
      title: 'Source one',
      excerpt: 'Direct quote.',
    }],
    real_life_hypotheses: [question('source-1', 'question-1')],
  }

  const questions = selectDreamVerificationQuestions(analysis)
  const sources = buildDreamCitationSources(analysis, 'Academic source')

  assert.equal(questions.length, 1)
  assert.equal(questions[0].hypothesisIndex, 0)
  assert.equal(sources.length, 1)
  assert.equal(sources[0].index, 3)
  assert.equal(sources[0].sourceId, 'source-1')
})

test('two resolved sources expose two questions while one source is deduplicated', () => {
  const duplicate = {
    ...question('source-1', 'question-1b'),
    ruleId: 'rule-source-1b',
  }
  const analysis: any = {
    claim_bindings: [
      resolvedBinding('source-1', 1, 'question-1'),
      resolvedBinding('source-2', 2, 'question-2'),
    ],
    citations: [
      {
        index: 1,
        sourceType: 'academic_source',
        sourceId: 'source-1',
        title: 'Source one',
        excerpt: 'Quote one.',
      },
      {
        index: 2,
        sourceType: 'academic_source',
        sourceId: 'source-2',
        title: 'Source two',
        excerpt: 'Quote two.',
      },
    ],
    real_life_hypotheses: [
      question('source-1', 'question-1'),
      duplicate,
      question('source-2', 'question-2'),
    ],
  }

  assert.deepEqual(
    selectDreamVerificationQuestions(analysis).map(entry => entry.hypothesisIndex),
    [0, 2],
  )
  assert.deepEqual(
    buildDreamCitationSources(analysis, 'Academic source').map(source => source.index),
    [1, 2],
  )
})

test('legacy analyses without a ledger retain their stored presentation', () => {
  const analysis: any = {
    citations: [{
      index: 1,
      sourceType: 'academic_source',
      sourceId: 'source-1',
      title: 'Legacy source',
      excerpt: 'Legacy quote.',
    }],
    real_life_hypotheses: [question('source-1', 'legacy-question')],
  }

  assert.equal(selectDreamVerificationQuestions(analysis).length, 1)
  assert.equal(buildDreamCitationSources(analysis, 'Academic source').length, 1)
})
