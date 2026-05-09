import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import anime from 'animejs'
import {
  Building2, Plane, Bot, Github, Mail, Instagram,
  ArrowRight, MapPin, Star, Linkedin, Globe
} from 'lucide-react'
import './Home.css'
import otelImg from '../assets/otel.jpg'
import ucakImg from '../assets/ucak.jpg'

gsap.registerPlugin(ScrollTrigger)

const TEAM = [
  { name: 'Enes KILIÇARSLAN',  role: 'FRONTEND', mail: 'ilhanenes_kilicarslan24@trabzon.edu.tr',    ig: 'https://www.instagram.com/eneskilicarslan6/', linkedin: 'https://www.linkedin.com/in/eneskilicarslan6/', github: 'https://github.com/eneskilicarslan6', website: 'https://fluxify-io.vercel.app/' },
  { name: 'Halil AYDIN',  role: 'FRONTEND', mail: 'halil_aydin24@trabzon.edu.tr',    ig: 'https://www.instagram.com/halilayd_n/', linkedin: 'https://www.linkedin.com/in/halil-ayd%C4%B1n-097690331/', github: 'https://github.com/halilaydin-tru', website: 'https://neuraldev.vercel.app/' },
  { name: 'Burak YILDIRIM',  role: 'BACKEND - API', mail: 'burak_yildirim24@trabzon.edu.tr',    ig: 'https://www.instagram.com/burakyldrm339/', linkedin: 'https://www.linkedin.com/in/burak-y%C4%B1ld%C4%B1r%C4%B1m-b4b21a32b/', github: 'https://github.com/QatzyBURAK' },
  { name: 'Emir AKDENİZ',  role: 'BACKEND - API', mail: 'emir_akdeniz24@trabzon.edu.tr',    ig: 'https://www.instagram.com/e_mir_ak/', linkedin: 'https://www.linkedin.com/in/emir-akdeniz-73b224364/', github: 'https://github.com/Zemomir'},
  { name: 'Esma Nur DEMİRKOPARAN',  role: 'DATABASE - SQL', mail: 'esmanur_demirkoparan24@trabzon.edu.tr',    ig: 'https://www.instagram.com/esmanur.d.k/', linkedin: 'https://www.linkedin.com/in/esma-nur-demirkoparan-9847bb330/', github: 'https://github.com/esmademirkoparan'},
  { name: 'Nurefşan DİLSİZ',  role: 'TESTER', mail: 'nurefsan_dilsiz24@trabzon.edu.tr',    ig: 'https://www.instagram.com/nurefsandlsz/', linkedin: 'https://www.linkedin.com/in/nurefsandilsiz/?locale=tr', github: '' },
  { name: 'Mustafa AKYAZICI',  role: 'RAPORTÖR', mail: 'mustafa_akyazici24@trabzon.edu.tr',    ig: 'https://www.instagram.com/m.akyzc61/', linkedin: 'https://www.linkedin.com/in/mustafa-akyazici/', github: 'https://github.com/karamer61' },
]

export default function Home() {
  const navigate = useNavigate()
  const wrapRef  = useRef(null)

  useEffect(() => {
    anime({
      targets: '.hero-title .char',
      translateY: [60, 0],
      opacity:    [0, 1],
      easing:     'easeOutExpo',
      duration:   900,
      delay:      anime.stagger(60),
    })
    anime({
      targets: '.hero-sub',
      translateY: [30, 0],
      opacity:    [0, 1],
      easing:     'easeOutExpo',
      duration:   800,
      delay:      500,
    })

    const handleMouse = (e) => {
      const x = (e.clientX / window.innerWidth  - 0.5) * 30
      const y = (e.clientY / window.innerHeight - 0.5) * 20
      gsap.to('.orb-accent', { x, y, duration: 1.2, ease: 'power2.out' })
      gsap.to('.orb-blue',   { x: -x * 0.6, y: -y * 0.6, duration: 1.4, ease: 'power2.out' })
    }
    window.addEventListener('mousemove', handleMouse)

    const ctx = gsap.context(() => {
      gsap.utils.toArray('.home-section:not(.hero-section)').forEach((sec, i) => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger:  sec,
            scroller: wrapRef.current,
            start:    'top 80%',
            toggleActions: 'play none none none',
          },
        })
        tl.from(sec.querySelectorAll('.anim-up'), {
          y: 50, opacity: 0, stagger: 0.12, duration: 0.8, ease: 'power3.out',
        })
        tl.from(sec.querySelectorAll('.anim-left'), {
          x: -50, opacity: 0, stagger: 0.1, duration: 0.7, ease: 'power3.out',
        }, '<0.1')
        tl.from(sec.querySelectorAll('.anim-right'), {
          x: 50, opacity: 0, stagger: 0.1, duration: 0.7, ease: 'power3.out',
        }, '<0')
      })
    }, wrapRef)

    return () => {
      ctx.revert()
      window.removeEventListener('mousemove', handleMouse)
    }
  }, [])


  const chars = (word) =>
    [...word].map((c, i) => (
      <span className="char" key={i} style={{ display: 'inline-block' }}>
        {c === ' ' ? '\u00a0' : c}
      </span>
    ))

  return (
    <div className="scroll-wrap home-wrap" ref={wrapRef}>

      <section className="home-section hero-section">
        <div className="orb orb-accent" style={{ width:500, height:500, top:'10%', left:'5%' }} />
        <div className="orb orb-blue"   style={{ width:350, height:350, top:'40%', right:'5%' }} />

        <div className="hero-content">
          <div className="badge anim-up" style={{ marginBottom:24 }}>
            <Star size={11} /> Türkiye'nin Gezi Platformu
          </div>
          <h1 className="hero-title">{chars('Vantag')}</h1>
          <p className="hero-sub">
            Konaklamadan ulaşıma, AI destekli tatil planlamasına kadar<br />
            her şey tek çatı altında.
          </p>
          <div className="hero-btns">
            <button className="btn btn-primary" onClick={() => navigate('/accommodation')}>
              Keşfetmeye Başla <ArrowRight size={16} />
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/ai')}>
              AI Asistan
            </button>
          </div>
        </div>


        <div className="hero-cards">
          {[
            { icon: <Building2 size={20} />, label: 'Otel & Kiralık Ev', sub: '50.000+ seçenek' },
            { icon: <Plane size={20} />,     label: 'Uçak & Otobüs',     sub: 'En iyi fiyatlar' },
            { icon: <Bot size={20} />,       label: 'AI Tatil Planlayıcı', sub: 'Gemini destekli' },
          ].map((c, i) => (
            <motion.div
              key={i}
              className="hero-float-card"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.15, duration: 0.7, ease: [0.25,0.46,0.45,0.94] }}
              whileHover={{ y: -6, boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
            >
              <span className="float-icon">{c.icon}</span>
              <div>
                <p className="float-label">{c.label}</p>
                <p className="float-sub">{c.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="home-section feature-section">
        <div className="feature-text">
          <div className="badge anim-up"><Building2 size={11} /> Konaklama</div>
          <h2 className="anim-up">Hayalindeki Oteli Bul</h2>
          <p className="anim-up muted">
            Şehir, tarih ve kişi sayısına göre gerçek zamanlı otel araması yap.
            Yıldız, fiyat ve yoruma göre sırala — favorileyerek daha sonra karşılaştır.
          </p>
          <button className="btn btn-primary anim-up" onClick={() => navigate('/accommodation')}>
            Otellere Göz At <ArrowRight size={15} />
          </button>
        </div>
        <div className="feature-visual anim-right">
          <div className="visual-card">
            <img 
              src={otelImg} 
              alt="Otel" 
              className="visual-svg" 
              style={{ filter:'drop-shadow(0 20px 55px rgba(0,0,0,0.55))', objectFit: 'cover' }} 
            />
            <div className="visual-info">
              <MapPin size={14} className="accent" />
              <span>İstanbul, Beşiktaş</span>
            </div>
            <div className="visual-price">₺2.400 <span className="muted">/ gece</span></div>
          </div>
        </div>
      </section>

      <section className="home-section feature-section reverse">
        <div className="feature-visual anim-left">
          <div className="visual-card">
            <img 
              src={ucakImg} 
              alt="Uçak" 
              className="visual-svg" 
              style={{ filter:'drop-shadow(0 24px 52px rgba(0,0,0,0.52))', objectFit: 'cover' }} 
            />
            <div className="transport-route">
              <span>İstanbul</span>
              <Plane size={16} className="accent" />
              <span>Amsterdam</span>
            </div>
            <div className="visual-price">₺8.750 <span className="muted">/ kişi</span></div>
          </div>
        </div>
        <div className="feature-text">
          <div className="badge anim-up"><Plane size={11} /> Ulaşım</div>
          <h2 className="anim-up">Uçak, Otobüs ve Dahası</h2>
          <p className="anim-up muted">
            Nereden nereye gitmek istediğini söyle, biz en uygun seçenekleri getiririz.
            Detay butonuyla bilet sayfasına direkt ulaş.
          </p>
          <button className="btn btn-primary anim-up" onClick={() => navigate('/transport')}>
            Bilet Ara <ArrowRight size={15} />
          </button>
        </div>
      </section>

      <section className="home-section ai-section">
        <div className="ai-glow" />
        <div className="ai-content">
          <div className="badge anim-up"><Bot size={11} /> AI Asistan</div>
          <h2 className="anim-up">Yapay Zeka Tatil Planınız</h2>
          <p className="anim-up muted">
            Gemini destekli asistanımız seyahat rotanızı, bütçenizi ve aktivitelerinizi planlar.
            Sohbet geçmişin her zaman kayıtlı, istediğin an devam et.
          </p>
          <button className="btn btn-primary anim-up" onClick={() => navigate('/ai')}>
            Sohbeti Başlat <ArrowRight size={15} />
          </button>
        </div>
        <div className="ai-chat-preview anim-right">
          {[
            { role: 'user',      text: 'Kapadokya\'da 3 günlük rota öner.' },
            { role: 'assistant', text: 'Tabii! 1. gün Göreme, 2. gün Derinkuyu yeraltı şehri, 3. gün balon turu...' },
          ].map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role}`}>{m.text}</div>
          ))}
        </div>
      </section>

      <section className="home-section team-section">
        <h2 className="anim-up">Ekibimiz</h2>
        <p className="anim-up muted" style={{ maxWidth: 500, margin: '0 auto 48px' }}>
          Vantag, üniversite proje kapsamında geliştirilen bir gezi platformudur.
        </p>
        <div className="team-grid">
          {TEAM.map((m, i) => (
            <motion.div
              key={i}
              className="team-card anim-up"
              whileHover={{ y: -6 }}
            >
              <div className="team-avatar">{m.name[0]}</div>
              <p className="team-name">{m.name}</p>
              <p className="muted" style={{ fontSize: 13 }}>{m.role}</p>
              <div className="team-links">
                {m.mail && <a href={m.mail !== '#' ? `mailto:${m.mail}` : '#'}><Mail size={16} /></a>}
                {m.ig   && <a href={m.ig !== '#' ? `https://instagram.com/${m.ig}` : '#'} target="_blank" rel="noreferrer"><Instagram size={16} /></a>}
                {m.linkedin && <a href={m.linkedin} target="_blank" rel="noreferrer"><Linkedin size={16} /></a>}
                {m.github && <a href={m.github} target="_blank" rel="noreferrer"><Github size={16} /></a>}
                {m.website && <a href={m.website} target="_blank" rel="noreferrer"><Globe size={16} /></a>}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="home-section footer-section">
        <div className="footer-brand anim-up">
          <span className="logo-text" style={{ fontSize: 32 }}>Vantag</span>
          <p className="muted">Tatilini planla, dünyayı keşfet.</p>
        </div>
        <div className="footer-links anim-up">
          <button className="btn btn-ghost" onClick={() => navigate('/accommodation')}>Konaklama</button>
          <button className="btn btn-ghost" onClick={() => navigate('/transport')}>Ulaşım</button>
          <button className="btn btn-ghost" onClick={() => navigate('/ai')}>AI Asistan</button>
        </div>
        <p className="anim-up muted" style={{ fontSize: 12, marginTop: 40 }}>
          © 2026 Vantag — Trabzon Üniversitesi Öğrenci Projesi
        </p>
      </section>

    </div>
  )
}
