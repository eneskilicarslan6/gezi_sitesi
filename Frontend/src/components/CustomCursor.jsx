import { useEffect, useRef } from 'react'

export default function CustomCursor() {
  const cursorRef = useRef(null)

  useEffect(() => {
    const el = cursorRef.current
    if (!el) return

    const move = (e) => {
      el.style.left = `${e.clientX}px`
      el.style.top  = `${e.clientY}px`
    }

    const addHover = () => el.classList.add('hover')
    const remHover = () => el.classList.remove('hover')

    document.addEventListener('mousemove', move)

    const observe = () => {
      document.querySelectorAll('button, a, input, [data-cursor]').forEach((el) => {
        el.addEventListener('mouseenter', addHover)
        el.addEventListener('mouseleave', remHover)
      })
    }
    observe()

    const observer = new MutationObserver(observe)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      document.removeEventListener('mousemove', move)
      observer.disconnect()
    }
  }, [])

  return <div className="cursor" ref={cursorRef} />
}
