import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sun, Moon, LogIn, User } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import AuthModal from './AuthModal'
import './Header.css'

const NAV = [
  { to: '/',              label: 'Ana Sayfa'  },
  { to: '/accommodation', label: 'Konaklama'  },
  { to: '/transport',     label: 'Ulaşım'     },
  { to: '/favorites',     label: 'Favoriler'  },
  { to: '/ai',            label: 'AI Asistan' },
]

export default function Header({ theme, toggleTheme }) {
  const [modal, setModal] = useState(false)
  const { isLogged, user } = useAuthStore()
  const navigate = useNavigate()

  return (
    <>
      <header className="header">
        <NavLink to="/" className="header-logo">
          <span className="logo-icon">V</span>
          <span className="logo-text">Vantag</span>
        </NavLink>

        <nav className="header-nav">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          <motion.button
            className="icon-btn theme-toggle"
            onClick={toggleTheme}
            title="Tema değiştir"
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === 'dark' ? (
                <motion.span key="sun"
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0,  opacity: 1 }}
                  exit={{    y: -18, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22,1,0.36,1] }}
                  style={{ display:'flex' }}
                >
                  <Sun size={18} />
                </motion.span>
              ) : (
                <motion.span key="moon"
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0,  opacity: 1 }}
                  exit={{    y: -18, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22,1,0.36,1] }}
                  style={{ display:'flex' }}
                >
                  <Moon size={18} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {isLogged ? (
            <button className="user-pill" onClick={() => navigate('/profile')} title="Profil">
              {user?.avatar
                ? <img src={user.avatar} alt="" className="user-pill-avatar" />
                : <User size={14} />
              }
              <span>{user?.username}</span>
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setModal(true)}>
              <LogIn size={15} /> Giriş Yap
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {modal && <AuthModal onClose={() => setModal(false)} />}
      </AnimatePresence>
    </>
  )
}
