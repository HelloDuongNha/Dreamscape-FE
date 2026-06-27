import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id:       string
  name:     string
  handle:   string
  avatar?:  string
  bio?:     string
}

export const useUserStore = defineStore('user', () => {
  // ── State ──────────────────────────────────────────────────────
  const currentUser = ref<User | null>({
    id:     'u-001',
    name:   'Dreamer',
    handle: '@dreamscape.user',
    bio:    'Explorer of the subconscious realm.',
  })

  const isAuthenticated = computed(() => currentUser.value !== null)

  // ── Actions ────────────────────────────────────────────────────
  function setUser(user: User) {
    currentUser.value = user
  }

  function clearUser() {
    currentUser.value = null
  }

  function updateBio(bio: string) {
    if (currentUser.value) currentUser.value.bio = bio
  }

  return { currentUser, isAuthenticated, setUser, clearUser, updateBio }
})
