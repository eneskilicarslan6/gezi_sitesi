import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, LogIn, UserPlus } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { login, register } from '../services/api'
import './AuthModal.css'

export default function AuthModal({ onClose }) {
  const [tab, setTab]       = useState('login')
  const [form, setForm]     = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)

  const change = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (tab === 'register' && form.password !== form.confirm) {
      setError('Şifreler eşleşmiyor.')
      return
    }
    setLoading(true)
    try {
      let data
      if (tab === 'login') {
        data = await login(form.username, form.password)
      } else {
        data = await register(form.username, form.email, form.password)
      }
      setAuth(data.token, data.kullanici)
      onClose()
    } catch (err) {
      setError(err?.response?.data?.hata ?? 'Bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-box"
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1,    opacity: 1, y: 0 }}
        exit={{    scale: 0.88, opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}><X size={18} /></button>

        <div className="modal-logo-dot" />
        <div className="modal-logo">Vantag</div>
        <p className="modal-sub">Tatil planlamaya hazır mısın?</p>


        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError('') }}
          >
            <LogIn size={14} /> Giriş Yap
          </button>
          <button
            className={`modal-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError('') }}
          >
            <UserPlus size={14} /> Kayıt Ol
          </button>
        </div>

        <form className="modal-form" onSubmit={submit}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: tab === 'login' ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{    opacity: 0, x: tab === 'login' ? 16 : -16 }}
              transition={{ duration: 0.2 }}
            >
              <input
                className="input"
                name="username"
                placeholder="Kullanıcı adı"
                value={form.username}
                onChange={change}
                autoComplete="username"
                required
              />
              {tab === 'register' && (
                <input
                  className="input"
                  name="email"
                  type="email"
                  placeholder="E-posta"
                  value={form.email}
                  onChange={change}
                  required
                />
              )}
              <input
                className="input"
                name="password"
                type="password"
                placeholder="Şifre"
                value={form.password}
                onChange={change}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                required
              />
              {tab === 'register' && (
                <input
                  className="input"
                  name="confirm"
                  type="password"
                  placeholder="Şifre tekrar"
                  value={form.confirm}
                  onChange={change}
                  required
                />
              )}
            </motion.div>
          </AnimatePresence>

          {error && <p className="modal-error">{error}</p>}

          <button className="btn btn-primary modal-submit" type="submit" disabled={loading}>
            {loading ? 'Bekleniyor...' : tab === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}
