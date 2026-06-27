/* ── Device/Session schema — used by Settings > Security ── */
export interface DeviceSession {
  _id:         string
  device_name: string
  location:    string
  browser:     string
  last_active: string   // ISO 8601
  is_current:  boolean
}

export const mockSessions: DeviceSession[] = [
  {
    _id:         'sess-001',
    device_name: 'MacBook Pro 16"',
    location:    'Hanoi, Vietnam',
    browser:     'Chrome 124',
    last_active: new Date().toISOString(),     // right now
    is_current:  true,
  },
  {
    _id:         'sess-002',
    device_name: 'iPhone 15 Pro',
    location:    'Hanoi, Vietnam',
    browser:     'Safari 17',
    last_active: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),  // 2h ago
    is_current:  false,
  },
  {
    _id:         'sess-003',
    device_name: 'iPad Air (5th Gen)',
    location:    'Ho Chi Minh City, Vietnam',
    browser:     'Safari 17',
    last_active: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1d ago
    is_current:  false,
  },
  {
    _id:         'sess-004',
    device_name: 'Windows PC',
    location:    'Da Nang, Vietnam',
    browser:     'Edge 123',
    last_active: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3d ago
    is_current:  false,
  },
]
