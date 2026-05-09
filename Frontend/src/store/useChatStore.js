import { create } from 'zustand'

export const useChatStore = create((set, get) => ({
  sessions:        [],
  activeSessionId: null,

  newSession: () => {
    const id = Date.now().toString()
    set((s) => ({
      sessions: [{ id, title: 'Yeni Sohbet', messages: [] }, ...s.sessions],
      activeSessionId: id,
    }))
    return id
  },

  setActive: (id) => set({ activeSessionId: id }),

  deleteSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== id),
      activeSessionId: s.activeSessionId === id
        ? (s.sessions.find(sess => sess.id !== id)?.id ?? null)
        : s.activeSessionId,
    })),

  addMessage: (sessionId, role, content) =>
    set((s) => ({
      sessions: s.sessions.map((sess) => {
        if (sess.id !== sessionId) return sess
        const msgs  = [...sess.messages, { role, content, ts: Date.now() }]
        const title = sess.title === 'Yeni Sohbet' && role === 'user'
          ? content.slice(0, 60)
          : sess.title
        return { ...sess, title, messages: msgs }
      }),
    })),

  renameSession: (id, title) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, title: title.trim().slice(0, 60) || sess.title } : sess
      ),
    })),

  clearAll: () => set({ sessions: [], activeSessionId: null }),

  hydrate: (apiSessions) =>
    set((s) => {
      const existing = new Map(s.sessions.map((x) => [String(x.id), x]))
      const merged = apiSessions.map((a) => ({
        id:       String(a.id),
        title:    a.title,
        messages: existing.get(String(a.id))?.messages ?? [],
      }))
      const activeId = merged.find((x) => x.id === s.activeSessionId)
        ? s.activeSessionId
        : (merged[0]?.id ?? null)
      return { sessions: merged, activeSessionId: activeId }
    }),

  setMessages: (sessionId, messages) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === String(sessionId)
          ? { ...sess, messages: messages.map((m) => ({ role: m.role, content: m.content, ts: m.created_at })) }
          : sess
      ),
    })),

  getActive: () => {
    const { sessions, activeSessionId } = get()
    return sessions.find((s) => s.id === activeSessionId) ?? null
  },
}))
