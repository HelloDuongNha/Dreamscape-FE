/* ── Dream schema (mirrors MongoDB Dreams collection) ── */
export interface Dream {
  _id:            string
  userId:         string          // FK → User._id
  content:        string
  mood_tag:       string          // "Lucid" | "Nightmare" | "Calm" | "Prophetic" | "Euphoric"
  is_public:      boolean
  likes_count:    number
  comments_count: number
  created_at:     string          // ISO 8601
  ai_status:      'pending' | 'sensing' | 'completed'
  ai_result:      Record<string, string> | null  // placeholder for Phase 2
}

export const mockDreams: Dream[] = [
  {
    _id:            'd-001',
    userId:         'u-002',
    content:        'I was standing at the edge of an indigo cliff. Below me, the ocean glowed like a screen — deep blue pulses every few seconds. A voice said: "The tide waits for no memory."',
    mood_tag:       'Prophetic',
    is_public:      true,
    likes_count:    34,
    comments_count: 7,
    created_at:     '2026-05-14T22:15:00Z',
    ai_status:      'completed',
    ai_result:      { summary: 'Transition anxiety. The ocean represents unprocessed emotion.' },
  },
  {
    _id:            'd-002',
    userId:         'u-003',
    content:        'Running through a neon forest — every footstep left a glowing imprint that faded after three seconds. I never felt tired. I think I was looking for a door.',
    mood_tag:       'Lucid',
    is_public:      true,
    likes_count:    21,
    comments_count: 3,
    created_at:     '2026-05-14T18:40:00Z',
    ai_status:      'sensing',
    ai_result:      null,
  },
  {
    _id:            'd-003',
    userId:         'u-001',
    content:        'My childhood home but all the doors were in the wrong places. My grandmother sat at the kitchen table making tea, even though she passed in 2019.',
    mood_tag:       'Calm',
    is_public:      true,
    likes_count:    58,
    comments_count: 12,
    created_at:     '2026-05-14T05:30:00Z',
    ai_status:      'completed',
    ai_result:      { summary: 'Grief processing. Familiar spaces signal a longing for roots.' },
  },
  {
    _id:            'd-004',
    userId:         'u-004',
    content:        'A mirror showed my reflection moving before I did. When it turned to face me, it wore a different face — older, calmer, like it already knew everything I was about to do.',
    mood_tag:       'Nightmare',
    is_public:      true,
    likes_count:    89,
    comments_count: 19,
    created_at:     '2026-05-13T03:10:00Z',
    ai_status:      'completed',
    ai_result:      { summary: 'Shadow self encounter. The alternate face symbolizes repressed identity.' },
  },
  {
    _id:            'd-005',
    userId:         'u-002',
    content:        'A library that went on forever. Every book I opened was about me — but written from the perspective of people I have never met. One was called "The Visitor Who Forgot His Name."',
    mood_tag:       'Euphoric',
    is_public:      true,
    likes_count:    47,
    comments_count: 8,
    created_at:     '2026-05-12T21:55:00Z',
    ai_status:      'pending',
    ai_result:      null,
  },
  {
    _id:            'd-006',
    userId:         'u-001',
    content:        'I could see sound — every word someone spoke became a colored ribbon in the air. Anger was black and sharp. Laughter was gold spirals. I tried to catch them but they dissolved on contact.',
    mood_tag:       'Lucid',
    is_public:      false,
    likes_count:    0,
    comments_count: 0,
    created_at:     '2026-05-12T04:20:00Z',
    ai_status:      'pending',
    ai_result:      null,
  },
]
