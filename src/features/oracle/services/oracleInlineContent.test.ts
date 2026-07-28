import test from 'node:test'
import assert from 'node:assert/strict'

import { splitOracleInlineParts } from './oracleInlineContent.service'

test('splits supported and unsupported markers without changing prose', () => {
  assert.deepEqual(
    splitOracleInlineParts('Ký ức có thể được tái kết hợp [3], nhưng hướng này chưa có nguồn [?].'),
    [
      { text: 'Ký ức có thể được tái kết hợp ', strong: false },
      { text: '[3]', strong: false, citationIndex: 3 },
      { text: ', nhưng hướng này chưa có nguồn ', strong: false },
      { text: '[?]', strong: false, unsupported: true },
      { text: '.', strong: false },
    ],
  )
})

test('keeps inline emphasis available in Oracle and Dream analysis', () => {
  assert.deepEqual(splitOracleInlineParts('Một **nhận định** [1].'), [
    { text: 'Một ', strong: false },
    { text: 'nhận định', strong: true },
    { text: ' ', strong: false },
    { text: '[1]', strong: false, citationIndex: 1 },
    { text: '.', strong: false },
  ])
})
