import { Heart, ArrowRight, Clock, Layers } from 'lucide-react'
import { motion } from 'framer-motion'
import { useFavoriteStore } from '../store/useFavoriteStore'
import { useAuthStore } from '../store/useAuthStore'
import './TransportCard.css'

export default function TransportCard({ item, onDetail, travelDate, mode }) {
  const { isFav, add, remove } = useFavoriteStore()
  const { isLogged, openModal } = useAuthStore()
  const favId = `transport-${item.id}`
  const faved = isFav('transport', item.id)

  const toggleFav = (e) => {
    e.stopPropagation()
    if (!isLogged) { openModal(); return }
    if (faved) remove(favId)
    else add('transport', item, travelDate)
  }

  const d = item.details ?? {}
  const dur = d.total_duration_min ?? d.duration_min ?? 0
  const durStr = dur ? `${Math.floor(dur/60)}s ${dur%60}dk` : null

  return (
    <motion.div
      className="card transport-card"
      whileHover={{ y: -5, boxShadow: '0 20px 48px rgba(0,0,0,0.4)' }}
      layout
    >
      <div className="tc-head">
        {item.thumbnail && item.source !== 'flixbus' && item.source !== 'buses'
          ? <img className="tc-logo" src={item.thumbnail} alt={item.source} />
          : null
        }
        <button className={`fav-btn ${faved ? 'active' : ''}`} onClick={toggleFav}>
          <Heart size={15} fill={faved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="tc-route">
        <span>{d.departure_city ?? d.departure_airport?.name ?? d.departure_airport?.id ?? '—'}</span>
        <ArrowRight size={16} className="accent" />
        <span>{d.arrival_city ?? d.arrival_airport?.name ?? d.arrival_airport?.id ?? '—'}</span>
      </div>

      <div className="tc-meta">
        {(d.departure_time || d.arrival_time) && (
          <span>{d.departure_time} → {d.arrival_time}</span>
        )}
        {durStr && <span className="tc-chip"><Clock size={12} />{durStr}</span>}
        {mode === 'flights' && d.stops !== undefined && (
          <span className="tc-chip"><Layers size={12} />{d.stops === 0 ? 'Direkt' : `${d.stops} aktarma`}</span>
        )}
      </div>

      <div className="tc-footer">
        <span className="tc-price">
          {item.currency === 'TRY' ? '₺' : (item.currency ?? '€')}
          {item.price?.toLocaleString('tr-TR')}
        </span>
        <button className="btn btn-ghost tc-detail-btn" onClick={() => onDetail(item)}>
          Detay
        </button>
      </div>
    </motion.div>
  )
}
