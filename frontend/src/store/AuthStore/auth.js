import { create } from 'zustand'
import { api }from '@/api'

export const useAuthStore = create((set) => ({
    user: null,
    loadingUser: true,
    fetchMe: async () => {
        const token = localStorage.getItem('token')
        if (!token) {
            set({ user: null, loadingUser: false })
            return
        }
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        set({ loadingUser: true })
        try {
            const { data } = await api.get('/auth/me')
            set({ user: data, loadingUser: false })
        } catch {
            set({ user: null, loadingUser: false})
        }
    },
    login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password })
        localStorage.setItem('token', data.token)
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
        await useAuthStore.getState().fetchMe()
    },
    signup: async (username, email, password) => {
        await api.post('auth/signup', { username, email, password })
    },
    logout: async () => {
        localStorage.removeItem('token')
        delete api.defaults.headers.common['Authorization']
        set({ user: null, loadingUser: false })
    },
})
)