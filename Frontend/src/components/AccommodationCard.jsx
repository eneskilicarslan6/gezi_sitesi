import { Heart, MapPin, Star, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { useFavoriteStore } from '../store/useFavoriteStore'
import { useAuthStore } from '../store/useAuthStore'
import './AccommodationCard.css'

export default function AccommodationCard({ item, onDetail, checkin }) {
  const { isFav, add, remove } = useFavoriteStore()
  const { isLogged, openModal } = useAuthStore()
  const favId  = `hotel-${item.id}`
  const faved  = isFav('hotel', item.id)

  const toggleFav = (e) => {
    e.stopPropagation()
    if (!isLogged) { openModal(); return }
    if (faved) remove(favId)
    else add('hotel', item, checkin)
  }

  const stars = Math.round(item.rating ?? 0)

  return (
    <motion.div
      className="card acc-card"
      whileHover={{ y: -6, boxShadow: '0 20px 48px rgba(0,0,0,0.4)' }}
      layout
    >

      <div className="acc-thumb">
        {item.thumbnail
          ? <img src={item.thumbnail} alt={item.title} loading="lazy" />
          : <div className="acc-thumb-placeholder" />
        }
        <button className={`fav-btn ${faved ? 'active' : ''}`} onClick={toggleFav}>
          <Heart size={16} fill={faved ? 'currentColor' : 'none'} />
        </button>
      </div>


      <div className="acc-body">
        <h3 className="acc-name">{item.title}</h3>


        <div className="acc-location">
          <MapPin size={13} className="accent" />
          <span>
            {item.details?.nearby_places?.[0]?.name ?? item.details?.location?.region ?? '—'}
          </span>
        </div>

        <div className="acc-stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={13}
              fill={i < stars ? 'var(--accent)' : 'none'}
              color={i < stars ? 'var(--accent)' : 'var(--text-faint)'}
            />
          ))}
          <span className="muted" style={{ fontSize: 12, marginLeft: 4 }}>
            {item.rating?.toFixed(1)}
          </span>
        </div>


        <div className="acc-footer">
          <div>
            <span className="acc-price">
              {item.currency === 'TRY' ? '₺' : item.currency}{' '}
              {item.price?.toLocaleString('tr-TR')}
            </span>
            <span className="muted" style={{ fontSize: 12 }}> / gece</span>
          </div>
          <button className="btn btn-ghost acc-detail-btn" onClick={() => onDetail(item)}>
            Detay <ExternalLink size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
