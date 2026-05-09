import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plane, Bus, Ship, TrainFront, Search, ArrowLeft,
  ExternalLink, ArrowRight, Clock, Layers, Plus, Minus,
  ArrowLeftRight, Ticket, X,
} from 'lucide-react'
import TransportCard from '../components/TransportCard'
import DatePicker    from '../components/DatePicker'
import { searchTravel } from '../services/api'
import './Transport.css'

const MODES = [
  { key: 'flights', label: 'Uçak',   Icon: Plane,      available: true  },
  { key: 'buses',   label: 'Otobüs', Icon: Bus,        available: true  },
  { key: 'train',   label: 'Tren',   Icon: TrainFront, available: false },
  { key: 'ferry',   label: 'Gemi',   Icon: Ship,       available: false },
]

function Counter({ label, name, value, onChange, min = 1, max = 9 }) {
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

function FlightForm({ form, onChange, onDate, onCounter, onSubmit, loading }) {
  return (
    <form className="search-form flight-form" onSubmit={onSubmit}>
      <div className="form-row">
        <input className="input" name="origin"      placeholder="Nereden"  value={form.origin}      onChange={onChange} />

        <button
          type="button"
          className="swap-btn"
          title="Şehirleri değiştir"
          onClick={() => {
            onChange({ target: { name: 'origin',      value: form.destination } })
            onChange({ target: { name: 'destination', value: form.origin      } })
          }}
        >
          <ArrowLeftRight size={15} />
        </button>

        <input className="input" name="destination" placeholder="Nereye"   value={form.destination} onChange={onChange} />
        <DatePicker label="Gidiş"  value={form.departDate} onChange={(v) => onDate('departDate', v)} minDate={new Date().toISOString().split('T')[0]} />

        <button
          type="button"
          className={`round-trip-btn ${form.roundTrip ? 'active' : ''}`}
          onClick={() => onChange({ target: { name: 'roundTrip', value: !form.roundTrip, type:'checkbox', checked: !form.roundTrip } })}
        >
          <Plane size={13} />
          Gidiş-Dönüş
        </button>

        {form.roundTrip && (
          <DatePicker label="Dönüş" value={form.returnDate} onChange={(v) => onDate('returnDate', v)} minDate={form.departDate || new Date().toISOString().split('T')[0]} />
        )}

        <Counter label="Yetişkin" name="adults" value={form.adults} onChange={onCounter} min={1} max={9} />

        <button className="btn btn-primary search-btn" type="submit" disabled={loading}>
          <Search size={15} /> {loading ? 'Aranıyor…' : 'Ara'}
        </button>
      </div>
    </form>
  )
}

function BusForm({ form, onChange, onDate, onSubmit, loading }) {
  return (
    <form className="search-form bus-form" onSubmit={onSubmit}>
      <div className="form-row">
        <input className="input" name="origin"      placeholder="Nereden" value={form.origin}      onChange={onChange} />
        <input className="input" name="destination" placeholder="Nereye"  value={form.destination} onChange={onChange} />
        <DatePicker label="Tarih" value={form.departDate} onChange={(v) => onDate('departDate', v)} minDate={new Date().toISOString().split('T')[0]} />
        <button className="btn btn-primary search-btn" type="submit" disabled={loading}>
          <Search size={15} /> {loading ? 'Aranıyor…' : 'Ara'}
        </button>
      </div>
    </form>
  )
}

function TicketSummary({ outbound, returnFlight, form }) {
  if (!outbound) return null
  const d = outbound.details ?? {}
  const dep = d.departure_airport ?? {}
  const arr = d.arrival_airport   ?? {}
  const depCity = d.departure_city ?? dep.name ?? dep.id ?? form.origin
  const arrCity = d.arrival_city   ?? arr.name ?? arr.id ?? form.destination
  const fmt = (iso) => iso ? iso.split('-').reverse().join('.') : '—'

  return (
    <motion.div className="ticket-summary" initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}>
      <Ticket size={15} className="accent" />
      <div className="ticket-summary-legs">
        <span>
          <strong>Gidiş:</strong> {fmt(d.departure_date || form.departDate)} · {d.departure_time ?? '—'} · {depCity} → {arrCity}
        </span>
        {returnFlight ? (
          <span>
            <strong>Dönüş:</strong> {fmt(returnFlight.details?.departure_date || form.returnDate)} · {returnFlight.details?.departure_time ?? '—'} · {arrCity} → {depCity}
          </span>
        ) : form.roundTrip && !returnFlight ? (
          <span className="muted" style={{ fontSize:12 }}>Dönüş uçuşunu seçin ↓</span>
        ) : null}
      </div>
    </motion.div>
  )
}

function BusDetail({ detail }) {
  const d = detail.details ?? {}
  const fmt = (iso) => iso ? iso.split('-').reverse().join('.') : ''
  const dur = d.duration_min
  const durStr = dur ? `${Math.floor(dur/60)}s ${dur%60}dk` : null

  return (
    <div className="flight-detail-wrap">
      <div className="flight-leg">
        <div className="leg-badge gidis">
          SEFER{d.departure_date ? ` · ${fmt(d.departure_date)}` : ''}
        </div>
        <div className="leg-route">
          <div className="leg-airport">
            <p className="leg-code" style={{ fontSize:16 }}>{d.departure_city || '—'}</p>
            <p className="leg-time">{d.departure_time || '—'}</p>
          </div>
          <div className="leg-arrow">
            <Bus size={16} className="accent" />
            {durStr && <span className="leg-dur">{durStr}</span>}
          </div>
          <div className="leg-airport right">
            <p className="leg-code" style={{ fontSize:16 }}>{d.arrival_city || '—'}</p>
            <p className="leg-time">{d.arrival_time || '—'}</p>
          </div>
        </div>
        <div className="leg-meta">
          {d.bus_company && <span>{d.bus_company}</span>}
          {d.transfers === 0 && <span className="badge">Direkt</span>}
          {d.transfers > 0  && <span className="badge">{d.transfers} aktarma</span>}
          {d.available_seats > 0 && <span className="muted">{d.available_seats} koltuk mevcut</span>}
        </div>
      </div>
      <div className="detail-price-row">
        <span>{detail.currency === 'TRY' ? '₺' : (detail.currency ?? '€')}{detail.price?.toLocaleString('tr-TR')}</span>
        <span className="muted"> / kişi</span>
      </div>
    </div>
  )
}

function FlightDetail({ detail, returnDate, origin, destination, isReturnPhase }) {
  const d       = detail.details ?? {}
  const dep     = d.departure_airport ?? {}
  const arr     = d.arrival_airport   ?? {}
  const depTime = d.departure_time ?? dep.time ?? ''
  const arrTime = d.arrival_time   ?? arr.time ?? ''
  const dur     = d.total_duration_min ?? 0
  const durStr  = dur ? `${Math.floor(dur/60)}s ${dur%60}dk` : null
  const depCity = d.departure_city ?? dep.name ?? dep.id ?? origin ?? '—'
  const arrCity = d.arrival_city   ?? arr.name ?? arr.id ?? destination ?? '—'
  const fmt = (iso) => iso ? iso.split('-').reverse().join('.') : '—'

  return (
    <div className="flight-detail-wrap">
      {/* GİDİŞ */}
      <div className="flight-leg">
        <div className={`leg-badge ${isReturnPhase ? 'donus' : 'gidis'}`}>
          {isReturnPhase ? 'DÖNÜŞ' : 'GİDİŞ'} · {fmt(d.departure_date ?? detail.departure_date ?? '')}
        </div>
        <div className="leg-route">
          <div className="leg-airport">
            <p className="leg-code">{dep.id ?? '—'}</p>
            <p className="leg-name">{depCity}</p>
            <p className="leg-time">{depTime}</p>
          </div>
          <div className="leg-arrow">
            <Plane size={16} className="accent" />
            {durStr && <span className="leg-dur">{durStr}</span>}
          </div>
          <div className="leg-airport right">
            <p className="leg-code">{arr.id ?? '—'}</p>
            <p className="leg-name">{arrCity}</p>
            <p className="leg-time">{arrTime}</p>
          </div>
        </div>
        <div className="leg-meta">
          {d.airline && <span>{d.airline}</span>}
          {d.stops === 0 && <span className="badge">Direkt</span>}
          {d.stops > 0  && <span className="badge">{d.stops} aktarma</span>}
          {d.travel_class && <span className="muted">{d.travel_class}</span>}
        </div>
      </div>

      {!isReturnPhase && returnDate && (
        <div className="flight-leg return-leg">
          <div className="leg-badge donus">DÖNÜŞ · {fmt(returnDate)}</div>
          <div className="leg-route">
            <div className="leg-airport">
              <p className="leg-code">{arr.id ?? '—'}</p>
              <p className="leg-name">{arrCity}</p>
              <p className="leg-time">—</p>
            </div>
            <div className="leg-arrow">
              <Plane size={16} className="accent" style={{ transform:'scaleX(-1)' }} />
            </div>
            <div className="leg-airport right">
              <p className="leg-code">{dep.id ?? '—'}</p>
              <p className="leg-name">{depCity}</p>
              <p className="leg-time">—</p>
            </div>
          </div>
          <p className="muted" style={{ fontSize:12, marginTop:8 }}>
            Dönüş saatleri bilet satın alma aşamasında kesinleşir.
          </p>
        </div>
      )}

      <div className="detail-price-row">
        <span>{detail.currency === 'TRY' ? '₺' : (detail.currency ?? '€')}{detail.price?.toLocaleString('tr-TR')}</span>
        <span className="muted"> / kişi</span>
      </div>
    </div>
  )
}

function buildObiletUrl(origin, destination, date) {
  const slug = (s) => s.toLowerCase()
    .replace(/ç/g,'c').replace(/ş/g,'s').replace(/ı/g,'i')
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/\s+/g,'-')
  const d = date ? date.split('-').reverse().join('-') : ''
  return `https://www.obilet.com/sefer/${slug(origin)}/${slug(destination)}/${d}`
}

function buildGoogleFlightsUrl(origin, destination, date) {
  const q = encodeURIComponent(`${origin} ${destination} uçak bileti ${date || ''}`.trim())
  return `https://www.google.com/travel/flights?q=${q}`
}

function buildGoogleBusUrl(origin, destination, date) {
  const q = encodeURIComponent(`${origin} ${destination} otobüs bileti ${date || ''}`.trim())
  return `https://www.google.com/search?q=${q}`
}

function NoResultsBox({ mode, form }) {
  if (mode === 'flights') {
    return (
      <div className="no-results-box">
        <Plane size={20} className="accent" />
        <div>
          <p style={{ fontWeight:600, marginBottom:4 }}>Uçuş bulunamadı</p>
          <p className="muted" style={{ fontSize:13, marginBottom:12 }}>
            Sistemimiz bu rotada uçuş bulamadı. Aşağıdaki platformlardan arayabilirsin:
          </p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <a href={buildGoogleFlightsUrl(form.origin, form.destination, form.departDate)}
               target="_blank" rel="noreferrer" className="btn btn-primary" style={{ fontSize:13 }}>
              Google Flights <ExternalLink size={12}/>
            </a>
            <a href={`https://www.turkishairlines.com/tr-tr/flights/find-a-flight/?from=${encodeURIComponent(form.origin)}&to=${encodeURIComponent(form.destination)}&date=${form.departDate}`}
               target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize:13 }}>
              THY <ExternalLink size={12}/>
            </a>
            <a href={`https://www.pegasusairlines.com/tr/ucak-bileti?origin=${encodeURIComponent(form.origin)}&destination=${encodeURIComponent(form.destination)}&departureDate=${form.departDate}`}
               target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize:13 }}>
              Pegasus <ExternalLink size={12}/>
            </a>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export default function Transport() {
  const [mode, setMode]         = useState(null)

  const [comingSoon, setCS]       = useState(false)
  const [form, setForm]           = useState({ origin:'', destination:'', departDate:'', returnDate:'', adults:1, roundTrip:false })
  const [results, setResults]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [searched, setSearched]   = useState(false)
  const [detail, setDetail]       = useState(null)
  const [busInfo, setBusInfo]     = useState('')
  const [outboundFlight, setOutboundFlight] = useState(null)
  const [returnFlight, setReturnFlight]     = useState(null)
  const [returnResults, setReturnResults]   = useState([])
  const [returnLoading, setReturnLoading]   = useState(false)

  const resetFlightState = () => {
    setOutboundFlight(null); setReturnFlight(null)
    setReturnResults([]); setReturnLoading(false)
  }

  const selectMode = (m) => {
    setResults([]); setError(''); setSearched(false); setBusInfo(''); resetFlightState()
    if (!m.available) { setMode(null); setCS(true); setTimeout(() => setCS(false), 2800); return }
    setMode(m.key)
  }

  const change = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }
  const onDate    = (name, val)        => setForm((f) => ({ ...f, [name]: val }))
  const onCounter = (name, val)        => setForm((f) => ({ ...f, [name]: val }))

  const searchReturn = async (curForm) => {
    setReturnLoading(true)
    try {
      const res = await searchTravel('flights', {
        origin:      curForm.destination,
        destination: curForm.origin,
        depart_date: curForm.returnDate,
        adults:      Number(curForm.adults),
        trip_type:   2,
      })
      if (res.ok) setReturnResults(res.data)
    } catch {}
    finally { setReturnLoading(false) }
  }

  const selectOutbound = (item) => {
    setOutboundFlight(item)
    setDetail(null)
    if (form.roundTrip && form.returnDate) searchReturn(form)
  }

  const selectReturn = (item) => {
    setReturnFlight(item)
    setDetail(null)
  }

  const search = async (e) => {
    e.preventDefault()
    setError(''); setResults([]); setSearched(false); setBusInfo(''); resetFlightState()
    if (!form.origin || !form.destination || !form.departDate) {
      setError('Lütfen nereden, nereye ve tarih alanlarını doldurun.'); return
    }
    setLoading(true)
    try {
      let res
      if (mode === 'flights') {
        res = await searchTravel('flights', {
          origin:      form.origin,
          destination: form.destination,
          depart_date: form.departDate,
          ...(form.roundTrip && form.returnDate && { return_date: form.returnDate }),
          adults:      Number(form.adults),
          trip_type:   form.roundTrip ? 1 : 2,
        })
      } else {
        res = await searchTravel('buses', {
          origin:      form.origin,
          destination: form.destination,
          date:        form.departDate,
        })
      }

      if (!res.ok) {
        const msg = res.error || 'Sonuç bulunamadı.'
        if (mode === 'buses') {
          setBusInfo(msg)
        } else {
          setError(msg || 'Sonuç bulunamadı.')
        }
      } else {
        setResults(res.data)
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.hata || ''
      if (mode === 'buses') {
        setBusInfo(msg || 'Yurt içi otobüs araması şu an desteklenmiyor.')
      } else {
        setError(msg || 'Arama sırasında bir sorun oluştu. Lütfen tekrar deneyin.')
      }
    } finally {
      setLoading(false); setSearched(true)
    }
  }

  const handleDetail = (item) => setDetail(item)

  return (
    <div className="scroll-wrap page-wrap">
      <div className="page-inner">
        <AnimatePresence>
          {detail && (
            <motion.div
              className="detail-panel"
              initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }}
              transition={{ type:'spring', stiffness:300, damping:28 }}
            >
              <div className="detail-header">
                <button className="btn btn-ghost" onClick={() => setDetail(null)}>
                  <ArrowLeft size={15}/> Geri
                </button>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {detail.details?.google_flights_url && (
                    <a className="btn btn-ghost" href={detail.details.google_flights_url} target="_blank" rel="noreferrer" style={{ fontSize:13 }}>
                      Google Flights <ExternalLink size={12}/>
                    </a>
                  )}
                  {mode === 'flights' && form.roundTrip && !outboundFlight && (
                    <button className="btn btn-primary" onClick={() => selectOutbound(detail)}>
                      Gidiş Seç <ArrowRight size={14}/>
                    </button>
                  )}
                  {mode === 'flights' && form.roundTrip && outboundFlight && !returnFlight && (
                    <button className="btn btn-primary" onClick={() => selectReturn(detail)}>
                      Dönüş Seç <ArrowRight size={14}/>
                    </button>
                  )}
                  {(mode !== 'flights' || !form.roundTrip) && detail.booking_url && (
                    <a className="btn btn-primary" href={detail.booking_url} target="_blank" rel="noreferrer">
                      Bilet Al <ExternalLink size={14}/>
                    </a>
                  )}
                  {mode === 'flights' && !form.roundTrip && !detail.booking_url && detail.details?.google_flights_url && null}
                  <button className="detail-close-btn" onClick={() => setDetail(null)} title="Kapat">
                    <X size={18}/>
                  </button>
                </div>
              </div>
              <div className="detail-body">
                {mode === 'flights'
                  ? <FlightDetail
                      detail={detail}
                      returnDate={form.roundTrip && !outboundFlight ? form.returnDate : ''}
                      origin={form.origin}
                      destination={form.destination}
                      isReturnPhase={!!(outboundFlight && !returnFlight)}
                    />
                  : <BusDetail detail={detail} />
                }
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <h1 className="page-title">Ulaşım</h1>

        <div className="mode-grid">
          {MODES.map((m) => (
            <motion.button
              key={m.key}
              className={`mode-card ${mode === m.key ? 'active' : ''} ${!m.available ? 'unavailable' : ''}`}
              onClick={() => selectMode(m)}
              whileHover={{ scale:1.04 }}
              whileTap={{ scale:0.96 }}
            >
              <m.Icon size={28}/>
              <span>{m.label}</span>
              {!m.available && <span className="coming-tag">Yakında</span>}
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {comingSoon && (
            <motion.div className="coming-toast"
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}>
              Bu ulaşım modu yakında ekleniyor!
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {mode && (
            <motion.div key={mode}
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="search-section">
              {mode === 'flights'
                ? <FlightForm  form={form} onChange={change} onDate={onDate} onCounter={onCounter} onSubmit={search} loading={loading} />
                : <BusForm     form={form} onChange={change} onDate={onDate} onSubmit={search} loading={loading} />
              }
            </motion.div>
          )}
        </AnimatePresence>

        {mode === 'flights' && outboundFlight && (
          <TicketSummary outbound={outboundFlight} returnFlight={returnFlight} form={form} />
        )}

        {error && mode === 'flights' && (
          <NoResultsBox mode="flights" form={form} />
        )}
        {error && mode !== 'flights' && (
          <div className="search-error-box"><p>{error}</p></div>
        )}

        {busInfo && (
          <div className="bus-info-box">
            <Bus size={18} className="accent" />
            <div>
              <p style={{ marginBottom:6, fontWeight:600, color:'var(--text)' }}>
                Yurt içi otobüs arama
              </p>
              <p className="muted" style={{ fontSize:13 }}>
                Yurt içi biletler için güvenilir platformlara yönlendirebiliriz:
              </p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
                <a href={buildObiletUrl(form.origin, form.destination, form.departDate)}
                   target="_blank" rel="noreferrer" className="btn btn-primary" style={{ fontSize:13 }}>
                  Obilet.com <ExternalLink size={12}/>
                </a>
                <a href={buildGoogleBusUrl(form.origin, form.destination, form.departDate)}
                   target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize:13 }}>
                  Google'da Ara <ExternalLink size={12}/>
                </a>
              </div>
            </div>
          </div>
        )}

        {results.length > 0 && !outboundFlight && (
          <motion.div className="results-grid"
            initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}>
            {results.map((item) => (
              <TransportCard key={item.id} item={item} mode={mode} travelDate={form.departDate} onDetail={handleDetail} />
            ))}
          </motion.div>
        )}

        {mode === 'flights' && form.roundTrip && outboundFlight && !returnFlight && (
          <>
            <div className="phase-header">
              <Plane size={14} className="accent" />
              Dönüş uçuşunu seçin: <strong>{form.destination} → {form.origin}</strong> · {form.returnDate?.split('-').reverse().join('.')}
            </div>
            {returnLoading && <p className="muted" style={{ fontSize:13, padding:'8px 0' }}>Dönüş uçuşları yükleniyor…</p>}
            {returnResults.length > 0 && (
              <motion.div className="results-grid"
                initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
                {returnResults.map((item) => (
                  <TransportCard key={item.id} item={item} mode={mode} travelDate={form.returnDate} onDetail={handleDetail} />
                ))}
              </motion.div>
            )}
          </>
        )}

        {searched && !loading && results.length === 0 && !error && !busInfo && (
          <NoResultsBox mode={mode} form={form} />
        )}
      </div>
    </div>
  )
}
