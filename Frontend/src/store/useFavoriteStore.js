import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useFavoriteStore = create(
  persist(
    (set, get) => ({
      items: [],

      add: (type, payload, travelDate) =>
        set((s) => ({
          items: [
            ...s.items,
            {
              id: `${type}-${payload.id ?? Date.now()}`,
              type,
              payload,
              travelDate,
              addedAt: new Date().toISOString(),
            },
          ],
        })),

      remove: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      clearAll: () => set({ items: [] }),

      isFav: (type, payloadId) =>
        get().items.some((i) => i.type === type && i.payload.id === payloadId),
    }),
    { name: 'vantag-favorites' }
  )
)
