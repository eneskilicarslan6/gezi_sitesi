import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, ExternalLink, ArrowLeft, Star, MapPin, Plus, Minus, X, Building2 } from 'lucide-react'
import AccommodationCard from '../components/AccommodationCard'
import DatePicker        from '../components/DatePicker'
import { searchTravel }  from '../services/api'
import './Accommodation.css'

function buildBookingUrl(city, checkin, checkout, adults) {
  const base = 'https://www.booking.com/searchresults.html'
  return `${base}?ss=${encodeURIComponent(city)}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&lang=tr`
}

function buildGoogleHotelUrl(city, checkin, checkout) {
  const q = encodeURIComponent(`${city} otel ${checkin || ''}`.trim())
  return `https://www.google.com/travel/hotels?q=${q}`
}

function NoHotelResults({ form }) {
  return (
    <div className="no-results-box">
      <Building2 size={20} className="accent" />
      <div>
        <p style={{ fontWeight:600, marginBottom:4 }}>Otel bulunamadı</p>
        <p className="muted" style={{ fontSize:13, marginBottom:12 }}>
          Bu kriterlere uygun otel bulamadık. Aşağıdaki platformlardan devam edebilirsin:
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <a href={buildBookingUrl(form.location, form.checkin, form.checkout, form.adults)}
             target="_blank" rel="noreferrer" className="btn btn-primary" style={{ fontSize:13 }}>
            Booking.com <ExternalLink size={12}/>
          </a>
          <a href={buildGoogleHotelUrl(form.location, form.checkin, form.checkout)}
             target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize:13 }}>
            Google Oteller <ExternalLink size={12}/>
          </a>
          <a href={`https://www.trivago.com.tr/?query=${encodeURIComponent(form.location)}`}
             target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize:13 }}>
            Trivago <ExternalLink size={12}/>
          </a>
        </div>
      </div>
    </div>
  )
}

const SORT_OPTIONS = [
  { label: 'En Ucuz',         value: 3  },
  { label: 'En Yüksek Puan', value: 8  },
  { label: 'En Çok Yorum',   value: 13 },
]

function Counter({ label, name, value, onChange, min = 0, max = 9 }) {
  const dec = () => onChange(name, Math.max(min, value - 1))
  const inc = () => onChange(name, Math.min(max, value + 1))
  return (
    <div className="counter-wrap">
      <span className="counter-label">{label}</span>
      <div className="counter-ctrl">
        <button type="button" className="counter-btn" onClick={dec} disabled={value <= min}><Minus size={13}/></button>
        <span className="counter-val">{value}</span>
        <button type="button" className="counter-btn" onClick={inc} disabled={value >= max}><Plus size={13}/></button>
      </div>
    </div>
  )
}

export default function Accommodation() {
  const [form, setForm]       = useState({ location:'', checkin:'', checkout:'', adults:2, children:0 })
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [sort, setSort]       = useState(3)
  const [filters, setFilters] = useState({ minPrice:0, maxPrice:0, minRating:0, hotelClass:0 })
  const [detail, setDetail]   = useState(null)
  const [searched, setSearched] = useState(false)

  const change = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }
  const onDate    = (name, val) => setForm((f) => ({ ...f, [name]: val }))
  const onCounter = (name, val) => setForm((f) => ({ ...f, [name]: val }))

  const search = async (e) => {
    e.preventDefault()
    setError(''); setResults([]); setSearched(false)
    if (!form.location || !form.checkin || !form.checkout) {
      setError('Lütfen şehir, giriş ve çıkış tarihini girin.'); return
    }
    setLoading(true)
    try {
      const res = await searchTravel('hotels', {
        location:    form.location,
        checkin:     form.checkin,
        checkout:    form.checkout,
        adults:      form.adults,
        children:    form.children,
        sort_by:     sort,
        ...(filters.minPrice > 0   && { min_price:   filters.minPrice }),
        ...(filters.maxPrice > 0   && { max_price:   filters.maxPrice }),
        ...(filters.minRating > 0  && { min_rating:  filters.minRating }),
        ...(filters.hotelClass > 0 && { hotel_class: filters.hotelClass }),
      })
      if (!res.ok) { setError(res.error || 'Sonuç bulunamadı.') }
      else         { setResults(res.data) }
    } catch {
      setError('Arama sırasında bir sorun oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false); setSearched(true)
    }
  }

  return (
    <div className="scroll-wrap page-wrap">
      <div className="page-inner">


        <AnimatePresence>
          {detail && (
            <motion.div
              className="detail-panel"
              initial={{ x:'100%' }}
              animate={{ x:0 }}
              exit={{ x:'100%' }}
              transition={{ type:'spring', stiffness:300, damping:28 }}
            >
              <div className="detail-header">
                <button className="btn btn-ghost" onClick={() => setDetail(null)}>
                  <ArrowLeft size={15}/> Geri
                </button>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {detail.booking_url && (
                    <a className="btn btn-primary" href={detail.booking_url} target="_blank" rel="noreferrer">
                      Siteye Git <ExternalLink size={14}/>
                    </a>
                  )}
                  <button className="detail-close-btn" onClick={() => setDetail(null)} title="Kapat">
                    <X size={18}/>
                  </button>
                </div>
              </div>

              {detail.details?.images?.length > 0 && (
                <div className="detail-gallery">
                  {detail.details.images.slice(0,5).map((img,i) => (
                    <img key={i} src={img.thumbnail ?? img} alt={detail.title}/>
                  ))}
                </div>
              )}

              <div className="detail-body">
                <h2>{detail.title}</h2>
                {detail.details?.hotel_class > 0 && (
                  <div className="detail-stars">
                    {Array.from({ length: detail.details.hotel_class }).map((_,i) => (
                      <Star key={i} size={14} fill="var(--accent)" color="var(--accent)"/>
                    ))}
                  </div>
                )}
                <div className="detail-row">
                  <MapPin size={15}/> {detail.details?.nearby_places?.[0]?.name ?? 'Belirtilmedi'}
                </div>
                {detail.details?.amenities?.length > 0 && (
                  <div className="detail-amenities">
                    <h4>Özellikler</h4>
                    <div className="amenity-grid">
                      {detail.details.amenities.slice(0,12).map((a,i) => (
                        <span key={i} className="badge">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="detail-row">
                  <span className="acc-price">
                    {detail.currency === 'TRY' ? '₺' : detail.currency}
                    {detail.price?.toLocaleString('tr-TR')}
                  </span>
                  <span className="muted"> / gece</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="search-section">
          <h1 className="page-title">Konaklama</h1>
          <form className="search-form acc-form" onSubmit={search}>
            <input className="input" name="location" placeholder="Şehir" value={form.location} onChange={change} />
            <DatePicker label="Giriş"  value={form.checkin}  onChange={(v) => onDate('checkin', v)}  minDate={new Date().toISOString().split('T')[0]} />
            <DatePicker label="Çıkış"  value={form.checkout} onChange={(v) => onDate('checkout', v)} minDate={form.checkin || new Date().toISOString().split('T')[0]} />
            <Counter label="Yetişkin" name="adults"   value={form.adults}   onChange={onCounter} min={1} max={9} />
            <Counter label="Çocuk"    name="children" value={form.children} onChange={onCounter} min={0} max={9} />
            <button className="btn btn-primary search-btn" type="submit" disabled={loading}>
              <Search size={16}/> {loading ? 'Aranıyor…' : 'Ara'}
            </button>
          </form>
        </div>

        {searched && (
          <div className="filter-bar">
            <div className="filter-group">
              <SlidersHorizontal size={15} className="accent"/>
              <span style={{ fontSize:13, fontWeight:600 }}>Sırala:</span>
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  className={`sort-chip ${sort === o.value ? 'active':''}`}
                  onClick={() => setSort(o.value)}
                >{o.label}</button>
              ))}
            </div>
            <div className="filter-group">
              <span style={{ fontSize:13, fontWeight:600 }}>Min puan:</span>
              {[0,3,4,5].map((v) => (
                <button
                  key={v}
                  className={`sort-chip ${filters.minRating === v ? 'active':''}`}
                  onClick={() => setFilters((f) => ({ ...f, minRating:v }))}
                >{v === 0 ? 'Hepsi' : `${v}+★`}</button>
              ))}
            </div>
          </div>
        )}

        {error && <NoHotelResults form={form} />}

        {results.length > 0 && (
          <motion.div
            className="results-grid"
            initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}
          >
            {results.map((item) => (
              <AccommodationCard key={item.id} item={item} checkin={form.checkin} onDetail={setDetail}/>
            ))}
          </motion.div>
        )}

        {searched && !loading && results.length === 0 && !error && (
          <NoHotelResults form={form} />
        )}
      </div>
    </div>
  )
}
