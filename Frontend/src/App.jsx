import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

import CustomCursor from './components/CustomCursor'
import Header       from './components/Header'
import AuthModal    from './components/AuthModal'
import { useAuthStore }     from './store/useAuthStore'
import { useChatStore }     from './store/useChatStore'
import { useFavoriteStore } from './store/useFavoriteStore'
import Home         from './pages/Home'
import Accommodation from './pages/Accommodation'
import Transport    from './pages/Transport'
import Favorites    from './pages/Favorites'
import AiAssistant  from './pages/AiAssistant'
import Profile      from './pages/Profile'

export default function App() {
  const [theme, setTheme] = useState('dark')
  const { showModal, closeModal, isLogged } = useAuthStore()
  const clearChat      = useChatStore((s) => s.clearAll)
  const clearFavorites = useFavoriteStore((s) => s.clearAll)
  const prevLoggedRef  = useRef(null)

  useEffect(() => {
    if (prevLoggedRef.current === true && !isLogged) {
      clearChat()
      clearFavorites()
    }
    prevLoggedRef.current = isLogged
  }, [isLogged])

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')
    root.setAttribute('data-theme', theme)
    const t = setTimeout(() => root.classList.remove('theme-transitioning'), 400)
    return () => clearTimeout(t)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <BrowserRouter>
      <CustomCursor />
      <Header theme={theme} toggleTheme={toggleTheme} />
      <AnimatePresence>
        {showModal && <AuthModal onClose={closeModal} />}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/accommodation" element={<Accommodation />} />
          <Route path="/transport"     element={<Transport />} />
          <Route path="/favorites"     element={<Favorites />} />
          <Route path="/ai"            element={<AiAssistant />} />
          <Route path="/profile"       element={<Profile />} />
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  )
}
