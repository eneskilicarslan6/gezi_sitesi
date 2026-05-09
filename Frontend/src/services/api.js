import axios from 'axios'
import { useAuthStore } from '../store/useAuthStore'

const assistantApi = axios.create({ baseURL: import.meta.env.VITE_ASSISTANT_URL })
const searchApi    = axios.create({ baseURL: import.meta.env.VITE_SEARCH_URL })
const authApi      = axios.create({ baseURL: import.meta.env.VITE_AUTH_URL })

authApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

assistantApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})


export const askAssistant = async (mesaj) => {
  const { data } = await assistantApi.post('/api/asistan', { mesaj })
  return data.cevap
}

export const createSession    = (title)      => assistantApi.post('/api/chat/sessions', { title }).then(r => r.data)
export const getSessions      = ()           => assistantApi.get('/api/chat/sessions').then(r => r.data)
export const deleteSession    = (id)         => assistantApi.delete(`/api/chat/sessions/${id}`).then(r => r.data)
export const getMessages      = (id)         => assistantApi.get(`/api/chat/sessions/${id}/messages`).then(r => r.data)
export const sendMessage      = (id, mesaj)  => assistantApi.post(`/api/chat/sessions/${id}/messages`, { mesaj }).then(r => r.data)



export const searchTravel = async (query_type, params) => {
  const { data } = await searchApi.post('/api/search', { query_type, params })
  return data
}


export const register  = (username, email, password) =>
  authApi.post('/api/auth/register', { username, email, password }).then(r => r.data)

export const login     = (username, password) =>
  authApi.post('/api/auth/login', { username, password }).then(r => r.data)

export const getMe     = () =>
  authApi.get('/api/auth/me').then(r => r.data)
