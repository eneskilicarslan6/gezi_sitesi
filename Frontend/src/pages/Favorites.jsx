import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Plane, AlertCircle, ArrowLeft, X, ExternalLink, MapPin, Star, Clock, ArrowRight as ArrRight, Bus } from 'lucide-react'
import { useFavoriteStore } from '../store/useFavoriteStore'
import AccommodationCard from '../components/AccommodationCard'
import TransportCard     from '../components/TransportCard'
import './Favorites.css'
import './Transport.css'
import './Accommodation.css'

const isExpired = (travelDate) => {
  if (!travelDate) return false
  return new Date(travelDate) < new Date(new Date().toDateString())
}

function FavDetailPanel({ item, onClose }) {
  if (!item) return null
  const d = item.payload?.details ?? {}
  const payload = item.payload ?? {}
  const isHotel = item.type === 'hotel'
  const fmt = (iso) => iso ? iso.split('-').reverse().join('.') : '—'
  const dur = d.total_duration_min ?? d.duration_min ?? 0
  const durStr = dur ? `${Math.floor(dur/60)}s ${dur%60}dk` : null
  const depCity = d.departure_city ?? d.departure_airport?.name ?? d.departure_airport?.id ?? '—'
  const arrCity = d.arrival_city   ?? d.arrival_airport?.name  ?? d.arrival_airport?.id  ?? '—'
  const bookingUrl = payload.booking_url || d.google_flights_url || ''

  return (
    <motion.div
      className="fav-detail-panel"
      initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }}
      transition={{ type:'spring', stiffness:300, damping:28 }}
    >
      <div className="fav-detail-header">
        <button className="btn btn-ghost" onClick={onClose}><ArrowLeft size={15}/> Geri</button>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {d.google_flights_url && (
            <a className="btn btn-ghost" href={d.google_flights_url} target="_blank" rel="noreferrer" style={{ fontSize:12 }}>
              Google Flights <ExternalLink size={11}/>
            </a>
          )}
          {bookingUrl && (
            <a className="btn btn-primary" href={bookingUrl} target="_blank" rel="noreferrer" style={{ fontSize:13 }}>
              {isHotel ? 'Otele Git' : 'Bilet Al'} <ExternalLink size={12}/>
            </a>
          )}
          <button className="fav-close-btn" onClick={onClose} title="Kapat"><X size={18}/></button>
        </div>
      </div>

      {isHotel ? (
        <>
          {d.images?.length > 0 && (
            <div className="detail-gallery">
              {d.images.slice(0, 5).map((img, i) => (
                <img key={i} src={img.thumbnail ?? img} alt={payload.title} />
              ))}
            </div>
          )}
          <div className="detail-body">
            <h2>{payload.title}</h2>
            {d.hotel_class > 0 && (
              <div className="detail-stars">
                {Array.from({ length: d.hotel_class }).map((_,i) => (
                  <Star key={i} size={14} fill="var(--accent)" color="var(--accent)"/>
                ))}
              </div>
            )}
            <div className="detail-row">
              <MapPin size={15}/> {d.nearby_places?.[0]?.name ?? d.location?.region ?? '—'}
            </div>
            {d.amenities?.length > 0 && (
              <div className="detail-amenities">
                <h4>Özellikler</h4>
                <div className="amenity-grid">
                  {d.amenities.slice(0, 12).map((a, i) => (
                    <span key={i} className="badge">{a}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="detail-row">
              <span className="acc-price">
                {payload.currency === 'TRY' ? '₺' : payload.currency}
                {payload.price?.toLocaleString('tr-TR')}
              </span>
              <span className="muted"> / gece</span>
            </div>
            {item.travelDate && (
              <p className="muted" style={{ fontSize:12 }}>Giriş tarihi: {fmt(item.travelDate)}</p>
            )}
          </div>
        </>
      ) : (
        <div className="fav-detail-body">
          <div className="fav-flight-leg">
            <div className="leg-badge gidis">
              SEFER · {fmt(d.departure_date || item.travelDate)}
            </div>
            <div className="leg-route" style={{ marginTop:12 }}>
              <div className="leg-airport">
                <p className="leg-code">{d.departure_airport?.id ?? depCity.slice(0,3).toUpperCase()}</p>
                <p className="leg-name">{depCity}</p>
                <p className="leg-time">{d.departure_time ?? '—'}</p>
              </div>
              <div className="leg-arrow">
                {payload.source === 'flixbus' ? <Bus size={16} className="accent"/> : <Plane size={16} className="accent"/>}
                {durStr && <span className="leg-dur">{durStr}</span>}
              </div>
              <div className="leg-airport right">
                <p className="leg-code">{d.arrival_airport?.id ?? arrCity.slice(0,3).toUpperCase()}</p>
                <p className="leg-name">{arrCity}</p>
                <p className="leg-time">{d.arrival_time ?? '—'}</p>
              </div>
            </div>
            <div className="leg-meta" style={{ marginTop:12 }}>
              {d.airline && <span>{d.airline}</span>}
              {d.bus_company && <span>{d.bus_company}</span>}
              {d.stops === 0 && <span className="badge">Direkt</span>}
              {d.stops > 0  && <span className="badge">{d.stops} aktarma</span>}
              {d.transfers === 0 && d.bus_company && <span className="badge">Direkt</span>}
              {d.transfers > 0  && <span className="badge">{d.transfers} aktarma</span>}
            </div>
          </div>
          <div className="fav-detail-price">
            {payload.currency === 'TRY' ? '₺' : (payload.currency ?? '€')}{payload.price?.toLocaleString('tr-TR')}
            <span className="muted" style={{ fontSize:13, fontWeight:400 }}> / kişi</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default function Favorites() {
  const [tab, setTab]     = useState('hotel')
  const [detail, setDetail] = useState(null)
  const { items } = useFavoriteStore()

  const hotels    = items.filter((i) => i.type === 'hotel')
  const transport = items.filter((i) => i.type === 'transport')
  const list      = tab === 'hotel' ? hotels : transport

  return (
    <div className="scroll-wrap page-wrap">
      <div className="page-inner">

        <AnimatePresence>
          {detail && <FavDetailPanel item={detail} onClose={() => setDetail(null)} />}
        </AnimatePresence>

        <h1 className="page-title">Favoriler</h1>

        <div className="fav-tabs">
          <button className={`fav-tab ${tab === 'hotel' ? 'active' : ''}`} onClick={() => setTab('hotel')}>
            <Building2 size={14} /> Konaklama ({hotels.length})
          </button>
          <button className={`fav-tab ${tab === 'transport' ? 'active' : ''}`} onClick={() => setTab('transport')}>
            <Plane size={14} /> Ulaşım ({transport.length})
          </button>
        </div>

        {list.length === 0 && (
          <p className="muted" style={{ textAlign:'center', marginTop:80, fontSize:15 }}>
            Henüz favori eklemedin.
          </p>
        )}

        <div className="results-grid">
          <AnimatePresence>
            {list.map((item) => {
              const expired = isExpired(item.travelDate)
              return (
                <motion.div
                  key={item.id}
                  className={`fav-item-wrap ${expired ? 'expired' : ''}`}
                  layout
                  exit={{ opacity:0, scale:0.9, transition:{ duration:0.25 } }}
                >
                  {expired && (
                    <div className="overlay-unavailable">
                      <AlertCircle size={16} />
                      <span>Erişilemez · Tarih geçti</span>
                    </div>
                  )}
                  <div style={{ pointerEvents: expired ? 'none' : 'auto' }}>
                    {tab === 'hotel'
                      ? <AccommodationCard item={item.payload} checkin={item.travelDate} onDetail={() => setDetail(item)} />
                      : <TransportCard     item={item.payload} travelDate={item.travelDate} onDetail={() => setDetail(item)} mode="" />
                    }
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
