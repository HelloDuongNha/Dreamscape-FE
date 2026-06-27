/* ── Comment schema ── */
export interface Comment {
  _id:        string
  postId:     string   // FK → Dream._id
  userId:     string   // FK → User._id
  content:    string
  created_at: string   // ISO 8601
}

export const mockComments: Comment[] = [
  /* ── d-001 (Prophetic / indigo cliff) ── */
  {
    _id: 'c-001', postId: 'd-001', userId: 'u-003',
    content: 'That line — "the tide waits for no memory" — hit me harder than I expected. I had almost the exact same dream two weeks ago.',
    created_at: '2026-05-14T22:45:00Z',
  },
  {
    _id: 'c-002', postId: 'd-001', userId: 'u-004',
    content: "The Oracle's read on this is spot on. Transition anxiety shows up a lot when we're about to make a big decision.",
    created_at: '2026-05-14T23:10:00Z',
  },
  {
    _id: 'c-003', postId: 'd-001', userId: 'u-001',
    content: 'I keep thinking about the glowing ocean. I wonder if the pulses had a rhythm — like a heartbeat.',
    created_at: '2026-05-15T00:02:00Z',
  },

  /* ── d-002 (Lucid / neon forest) ── */
  {
    _id: 'c-004', postId: 'd-002', userId: 'u-001',
    content: 'Never felt tired while running is such a classic lucid marker. Did you try to fly at any point?',
    created_at: '2026-05-14T19:05:00Z',
  },
  {
    _id: 'c-005', postId: 'd-002', userId: 'u-002',
    content: 'The glowing footprints fading after 3 seconds is a beautiful detail. Three seconds feels intentional.',
    created_at: '2026-05-14T19:52:00Z',
  },

  /* ── d-003 (Calm / childhood home) ── */
  {
    _id: 'c-006', postId: 'd-003', userId: 'u-002',
    content: "I'm sorry for your loss. Dreams like this are the mind's way of keeping a connection alive. Cherish it.",
    created_at: '2026-05-14T06:00:00Z',
  },
  {
    _id: 'c-007', postId: 'd-003', userId: 'u-004',
    content: "The wrong door placement — that's your subconscious flagging that something in your past doesn't fit the mental map you have of it.",
    created_at: '2026-05-14T07:14:00Z',
  },
  {
    _id: 'c-008', postId: 'd-003', userId: 'u-003',
    content: "Making tea. Of all things. That's such an intimate, ordinary detail for a visitation dream. I love this.",
    created_at: '2026-05-14T08:30:00Z',
  },

  /* ── d-004 (Nightmare / mirror) ── */
  {
    _id: 'c-009', postId: 'd-004', userId: 'u-001',
    content: "The mirror moving before you — that's the most unsettling thing I've read this week. The calm older face makes it even more so.",
    created_at: '2026-05-13T03:45:00Z',
  },
  {
    _id: 'c-010', postId: 'd-004', userId: 'u-003',
    content: "Classic shadow self encounter. The Oracle got it right. The older face knowing everything you're about to do — that feels like a warning.",
    created_at: '2026-05-13T04:20:00Z',
  },

  /* ── d-005 (Euphoric / infinite library) ── */
  {
    _id: 'c-011', postId: 'd-005', userId: 'u-004',
    content: '"The Visitor Who Forgot His Name." — I would read that book in waking life.',
    created_at: '2026-05-12T22:20:00Z',
  },
  {
    _id: 'c-012', postId: 'd-005', userId: 'u-003',
    content: "Books about you written by strangers. That's identity anxiety wrapped in the most beautiful metaphor I've heard.",
    created_at: '2026-05-12T23:01:00Z',
  },
]
