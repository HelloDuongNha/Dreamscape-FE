/* ── Conversation schema — §6.3 (mirrors MongoDB Conversations collection) ── */
export interface Conversation {
  _id:             string
  participant_ids: string[]   // array of User._id (always 2 for DMs)
  last_message:    string     // preview snippet
  updated_at:      string     // ISO 8601
}

export const mockConversations: Conversation[] = [
  {
    _id:             'conv-001',
    participant_ids: ['u-001', 'u-002'],
    last_message:    "Let's compare notes tomorrow. Same time?",
    updated_at:      '2026-05-14T20:00:00Z',
  },
  {
    _id:             'conv-002',
    participant_ids: ['u-001', 'u-003'],
    last_message:    "That's classic lucid dreaming — partial autonomy.",
    updated_at:      '2026-05-13T16:30:00Z',
  },
  {
    _id:             'conv-003',
    participant_ids: ['u-001', 'u-004'],
    last_message:    'Have you done a Red Thread analysis yet?',
    updated_at:      '2026-05-12T09:10:00Z',
  },
]
