import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Mail, LogOut, Camera, Pencil, Check, X, Phone, FileText, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import './Profile.css'

function EditableField({ label, icon: Icon, value, onSave, placeholder }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')

  const save = () => {
    onSave(val.trim())
    setEditing(false)
  }
  const cancel = () => { setVal(value ?? ''); setEditing(false) }

  return (
    <div className="profile-info-row">
      <Icon size={16} className="accent" />
      <div style={{ flex: 1 }}>
        <p className="info-label">{label}</p>
        {editing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <input
              className="input profile-name-input"
              value={val}
              placeholder={placeholder}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
              autoFocus
            />
            <button className="profile-edit-btn accent" onClick={save} title="Kaydet"><Check size={14} /></button>
            <button className="profile-edit-btn" onClick={cancel} title="İptal"><X size={14} /></button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p className="info-value">{value || <span className="muted" style={{ fontSize: 13 }}>{placeholder}</span>}</p>
            <button className="profile-edit-btn" onClick={() => { setVal(value ?? ''); setEditing(true) }} title="Düzenle">
              <Pencil size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Profile() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const avatar   = user?.avatar || null
  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : '?'

  const update = (patch) => useAuthStore.setState((s) => ({ user: { ...s.user, ...patch } }))

  const handleAvatar = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => update({ avatar: ev.target.result })
    reader.readAsDataURL(file)
  }

  const removeAvatar = (e) => {
    e.stopPropagation()
    update({ avatar: null })
  }

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className="scroll-wrap page-wrap">
      <div className="page-inner profile-inner">
        <motion.div
          className="profile-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="profile-avatar-wrap">
            <div className="profile-avatar" onClick={() => fileRef.current?.click()}>
              {avatar
                ? <img src={avatar} alt="pp" className="avatar-img" />
                : <span className="avatar-initials">{initials}</span>
              }
              <div className="avatar-overlay"><Camera size={20} /></div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatar} />
            <div className="avatar-actions">
              <p className="avatar-hint">Fotoğrafı değiştirmek için tıkla</p>
              {avatar && (
                <button className="avatar-remove-btn" onClick={removeAvatar} title="Fotoğrafı Kaldır">
                  <Trash2 size={12} /> Kaldır
                </button>
              )}
            </div>
          </div>


          <div className="profile-info">
            <EditableField
              label="Kullanıcı Adı"
              icon={User}
              value={user?.username}
              placeholder="Kullanıcı adı gir"
              onSave={(v) => v && update({ username: v })}
            />
            <div className="profile-info-row">
              <Mail size={16} className="accent" />
              <div>
                <p className="info-label">E-posta</p>
                <p className="info-value">{user?.email ?? '—'}</p>
              </div>
            </div>
            <EditableField
              label="Telefon"
              icon={Phone}
              value={user?.phone}
              placeholder="Telefon numarası ekle"
              onSave={(v) => update({ phone: v })}
            />
            <EditableField
              label="Hakkımda"
              icon={FileText}
              value={user?.bio}
              placeholder="Kısa bir bio ekle"
              onSave={(v) => update({ bio: v })}
            />
          </div>

          <button className="btn btn-ghost logout-btn" onClick={handleLogout}>
            <LogOut size={15} /> Çıkış Yap
          </button>
        </motion.div>
      </div>
    </div>
  )
}
