import axios from 'axios'

export const apiBaseUrl =
    import.meta.env.VITE_BASEURL ?? (import.meta.env.DEV ? 'http://localhost:4000' : '')

const api = axios.create({
    baseURL: apiBaseUrl,
})

export default api;
