import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import './DatePicker.css'

const DAYS   = ['Pt','Sa','Ça','Pe','Cu','Ct','Pa']
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

export default function DatePicker({ value, onChange, label, minDate }) {
  const [open, setOpen] = useState(false)
  const [view, setView]  = useState(() => value ? new Date(value) : new Date())
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const today    = new Date(); today.setHours(0,0,0,0)
  const minD     = minDate ? new Date(minDate) : today
  const selected = value ? new Date(value + 'T00:00:00') : null
  const year     = view.getFullYear()
  const month    = view.getMonth()

  let startDow = new Date(year, month, 1).getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  const select = (d) => {
    if (!d || d < minD) return
    const iso = [
      d.getFullYear(),
      String(d.getMonth()+1).padStart(2,'0'),
      String(d.getDate()).padStart(2,'0'),
    ].join('-')
    onChange(iso)
    setOpen(false)
  }

  const prevMonth = () => setView(new Date(year, month - 1, 1))
  const nextMonth = () => setView(new Date(year, month + 1, 1))

  const displayVal = value
    ? value.split('-').reverse().join('.')
    : ''

  return (
    <div className="dp-wrap" ref={ref}>
      {label && <span className="dp-label">{label}</span>}
      <button type="button" className={`dp-trigger ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <span className={displayVal ? 'dp-val' : 'dp-placeholder'}>
          {displayVal || 'gg.aa.yyyy'}
        </span>
        <CalendarDays size={15} className="dp-icon" />
      </button>

      {open && (
        <div className="dp-popup">
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={prevMonth}><ChevronLeft size={15}/></button>
            <span className="dp-month">{MONTHS[month]} {year}</span>
            <button type="button" className="dp-nav" onClick={nextMonth}><ChevronRight size={15}/></button>
          </div>

          <div className="dp-grid">
            {DAYS.map(d => <div key={d} className="dp-weekday">{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} className="dp-empty" />
              const past   = d < minD
              const isToday = d.getTime() === today.getTime()
              const isSel   = selected && d.toDateString() === selected.toDateString()
              return (
                <button
                  key={d.getDate()}
                  type="button"
                  className={`dp-day${past?' past':''}${isToday?' today':''}${isSel?' selected':''}`}
                  onClick={() => select(d)}
                  disabled={past}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          <div className="dp-footer">
            <button type="button" className="dp-foot-btn" onClick={() => { onChange(''); setOpen(false) }}>Temizle</button>
            <button type="button" className="dp-foot-btn accent" onClick={() => select(today)}>Bugün</button>
          </div>
        </div>
      )}
    </div>
  )
}
