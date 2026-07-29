import type { ApiUser } from '@/api/types'

export function isAdminUser(user: Pick<ApiUser, 'role'> | null | undefined): boolean {
  return user?.role === 'admin'
}
