import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, ArrowUp, Trash2, Bot, Pencil, Check, X } from 'lucide-react'
import anime from 'animejs'
import { useChatStore } from '../store/useChatStore'
import { useAuthStore } from '../store/useAuthStore'
import {
  askAssistant,
  getSessions, createSession, deleteSession as apiDeleteSession,
  getMessages, sendMessage as apiSendMessage,
} from '../services/api'
import './AiAssistant.css'
import './Favorites.css'

function typewrite(el, text, onDone) {
  el.textContent = ''
  anime({
    targets: {},
    duration: Math.min(text.length * 18, 3000),
    easing: 'linear',
    update: (a) => {
      el.textContent = text.slice(0, Math.floor((a.progress / 100) * text.length))
    },
    complete: onDone,
  })
}

function SessionItem({ s, active, onSelect, onDelete, onRename }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(s.title)
  const inputRef = useRef(null)

  const startEdit = (e) => { e.stopPropagation(); setVal(s.title); setEditing(true) }
  const commit    = (e) => { e?.stopPropagation(); onRename(s.id, val); setEditing(false) }
  const cancel    = (e) => { e?.stopPropagation(); setEditing(false) }

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  return (
    <div
      className={`session-item ${active ? 'active' : ''}`}
      onClick={() => !editing && onSelect(s.id)}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="session-rename-input"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="session-title">{s.title}</span>
      )}
      <div className="session-actions">
        {editing ? (
          <>
            <button className="session-action-btn" onClick={commit}   title="Kaydet"><Check  size={12} /></button>
            <button className="session-action-btn" onClick={cancel}   title="İptal"><X      size={12} /></button>
          </>
        ) : (
          <>
            <button className="session-action-btn" onClick={startEdit}             title="Yeniden Adlandır"><Pencil size={12} /></button>
            <button className="session-action-btn" onClick={(e) => { e.stopPropagation(); onDelete(s.id) }} title="Sil"><Trash2 size={12} /></button>
          </>
        )}
      </div>
    </div>
  )
}

export default function AiAssistant() {
  const {
    sessions, activeSessionId,
    newSession, setActive, deleteSession,
    addMessage, getActive, renameSession,
    hydrate, setMessages,
  } = useChatStore()
  const { isLogged, openModal } = useAuthStore()

  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const endRef     = useRef(null)
  const lastBotRef = useRef(null)

  const active = getActive()

  useEffect(() => {
    if (isLogged) {
      getSessions().then((list) => hydrate(list)).catch(() => {})
    } else if (sessions.length === 0) {
      newSession()
    }
  }, [isLogged])

  useEffect(() => {
    if (!isLogged || !activeSessionId) return
    const sess = sessions.find((s) => s.id === activeSessionId)
    if (sess && sess.messages.length === 0) {
      getMessages(activeSessionId)
        .then((msgs) => setMessages(activeSessionId, msgs))
        .catch(() => {})
    }
  }, [activeSessionId, isLogged])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages?.length])


  const handleNewSession = async () => {
    if (!isLogged) { newSession(); return }
    try {
      const data = await createSession('Yeni Sohbet')
      const list = await getSessions()
      hydrate(list)
      setActive(String(data.id))
    } catch { newSession() }
  }


  const handleDeleteSession = async (id) => {
    if (isLogged) {
      try { await apiDeleteSession(id) } catch {}
    }
    deleteSession(id)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    let sessionId = activeSessionId
    if (!sessionId) {
      if (isLogged) { await handleNewSession(); sessionId = useChatStore.getState().activeSessionId }
      else sessionId = newSession()
    }

    addMessage(sessionId, 'user', text)
    setLoading(true)

    try {
      let cevap
      if (isLogged) {
        const res = await apiSendMessage(sessionId, text)
        cevap = res.cevap
      } else {
        cevap = await askAssistant(text)
      }
      addMessage(sessionId, 'assistant', cevap)
      setTimeout(() => {
        if (lastBotRef.current) typewrite(lastBotRef.current, cevap, () => {})
      }, 50)
    } catch {
      addMessage(sessionId, 'assistant', 'Bağlantı hatası. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-layout">
      <aside className="ai-sidebar">
        {isLogged ? (
          <>
            <button className="btn btn-primary new-chat-btn" onClick={handleNewSession}>
              <PlusCircle size={15} /> Yeni Sohbet
            </button>
            <div className="session-list">
              {sessions.map((s) => (
                <SessionItem
                  key={s.id}
                  s={s}
                  active={s.id === activeSessionId}
                  onSelect={setActive}
                  onDelete={handleDeleteSession}
                  onRename={renameSession}
                />
              ))}
              {sessions.length === 0 && (
                <p className="muted" style={{ fontSize:13, padding:'12px 8px' }}>
                  Henüz sohbet yok.
                </p>
              )}
            </div>
          </>
        ) : (
          <button className="sidebar-login-note sidebar-login-btn" onClick={openModal}>
            Sohbet geçmişini kaydetmek için giriş yap →
          </button>
        )}
      </aside>

      <div className="ai-main">
        {!active ? (
          <div className="ai-empty">
            <Bot size={48} className="accent" />
            <h2>Vantag AI Asistan</h2>
            <p className="muted">Tatil planla, şehirler hakkında soru sor veya rota öner.</p>
            <button className="btn btn-primary" onClick={handleNewSession}>Sohbeti Başlat</button>
          </div>
        ) : (
          <>
            <div className="chat-messages">
              <AnimatePresence initial={false}>
                {active.messages.map((msg, i) => {
                  const isLastBot = msg.role === 'assistant' && i === active.messages.length - 1
                  return (
                    <motion.div
                      key={i}
                      className={`msg-row ${msg.role}`}
                      initial={{ opacity:0, y:12 }}
                      animate={{ opacity:1, y:0 }}
                      transition={{ duration:0.3 }}
                    >
                      <div
                        className={`msg-bubble ${msg.role}`}
                        ref={isLastBot ? lastBotRef : null}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {loading && (
                <div className="msg-row assistant">
                  <div className="msg-bubble assistant typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form className="chat-input-bar" onSubmit={handleSend}>
              <input
                className="input chat-input"
                placeholder="Mesajını yaz…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <button className="btn btn-primary send-btn" type="submit" disabled={loading || !input.trim()}>
                <span style={{ fontSize: '18px', lineHeight: 1 }}>➤</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
