import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      token:     null,
      user:      null,
      isLogged:  false,
      showModal: false,

      setAuth: (token, user) => set({ token, user, isLogged: true }),

      logout: () => set({ token: null, user: null, isLogged: false }),

      openModal:  () => set({ showModal: true }),
      closeModal: () => set({ showModal: false }),
    }),
    { name: 'vantag-auth' }
  )
)
