/* ── Message schema — §6.4 (mirrors MongoDB Messages collection) ── */
export interface Message {
  _id:            string
  conversationId: string   // FK → Conversation._id
  senderId:       string   // FK → User._id
  content:        string
  timestamp:      string   // ISO 8601
}

export const mockMessages: Message[] = [
  /* ─── conv-001 · u-001 ↔ u-002 (Lyra Voss) ─── */
  { _id: 'm-001', conversationId: 'conv-001', senderId: 'u-002', content: "Hey! Did you write down that indigo cliff dream?",                                      timestamp: '2026-05-14T18:05:00Z' },
  { _id: 'm-002', conversationId: 'conv-001', senderId: 'u-001', content: "Yes! I posted it publicly. The ocean kept pulsing with light.",                          timestamp: '2026-05-14T18:07:00Z' },
  { _id: 'm-003', conversationId: 'conv-001', senderId: 'u-002', content: "The Oracle picked up on it — did you see the analysis?",                                 timestamp: '2026-05-14T18:10:00Z' },
  { _id: 'm-004', conversationId: 'conv-001', senderId: 'u-001', content: "Transition anxiety. Yeah, sounds about right honestly.",                                  timestamp: '2026-05-14T18:12:00Z' },
  { _id: 'm-005', conversationId: 'conv-001', senderId: 'u-002', content: "I've been having recurring water dreams too. Something about tides.",                    timestamp: '2026-05-14T19:30:00Z' },
  { _id: 'm-006', conversationId: 'conv-001', senderId: 'u-001', content: "Maybe we're in the same dream cycle?",                                                   timestamp: '2026-05-14T19:33:00Z' },
  { _id: 'm-007', conversationId: 'conv-001', senderId: 'u-002', content: "Ha! I wouldn't be surprised — the symbology overlaps a lot.",                            timestamp: '2026-05-14T19:55:00Z' },
  { _id: 'm-008', conversationId: 'conv-001', senderId: 'u-001', content: "Let's compare notes tomorrow. Same time?",                                               timestamp: '2026-05-14T20:00:00Z' },

  /* ─── conv-002 · u-001 ↔ u-003 (Zephyr Hale) ─── */
  { _id: 'm-009', conversationId: 'conv-002', senderId: 'u-003', content: "Found the door yet?",                                                                     timestamp: '2026-05-13T14:00:00Z' },
  { _id: 'm-010', conversationId: 'conv-002', senderId: 'u-001', content: "What door?",                                                                              timestamp: '2026-05-13T14:02:00Z' },
  { _id: 'm-011', conversationId: 'conv-002', senderId: 'u-003', content: "The one in the neon forest. My last dream. I posted it.",                                 timestamp: '2026-05-13T14:04:00Z' },
  { _id: 'm-012', conversationId: 'conv-002', senderId: 'u-001', content: "Oh right! The glowing footsteps dream. Very vivid.",                                      timestamp: '2026-05-13T14:10:00Z' },
  { _id: 'm-013', conversationId: 'conv-002', senderId: 'u-003', content: "It felt lucid — like I could control direction but not destination.",                     timestamp: '2026-05-13T16:00:00Z' },
  { _id: 'm-014', conversationId: 'conv-002', senderId: 'u-001', content: "That's classic lucid dreaming — partial autonomy.",                                       timestamp: '2026-05-13T16:30:00Z' },

  /* ─── conv-003 · u-001 ↔ u-004 (Aria Kael) ─── */
  { _id: 'm-015', conversationId: 'conv-003', senderId: 'u-004', content: "The Oracle gave me three symbols today.",                                                 timestamp: '2026-05-12T07:00:00Z' },
  { _id: 'm-016', conversationId: 'conv-003', senderId: 'u-004', content: "The circle. The spiral. The eye.",                                                        timestamp: '2026-05-12T07:01:00Z' },
  { _id: 'm-017', conversationId: 'conv-003', senderId: 'u-001', content: "Classic archetypes. Jung would love you.",                                                timestamp: '2026-05-12T07:45:00Z' },
  { _id: 'm-018', conversationId: 'conv-003', senderId: 'u-004', content: "I think the eye is watching for something specific.",                                     timestamp: '2026-05-12T08:30:00Z' },
  { _id: 'm-019', conversationId: 'conv-003', senderId: 'u-001', content: "Have you done a Red Thread analysis yet?",                                                timestamp: '2026-05-12T09:10:00Z' },
]
