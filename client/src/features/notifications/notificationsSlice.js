import { createSlice } from '@reduxjs/toolkit'

const MAX_NOTIFICATIONS = 50

const initialState = {
  items: [],
  unreadCount: 0,
  isOpen: false,
}

const normalize = (notification) => {
  const id =
    notification?.id ||
    notification?._id ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`

  const createdAt = notification?.createdAt || new Date().toISOString()

  return {
    id,
    type: notification?.type || 'generic',
    title: notification?.title || 'Notification',
    body: notification?.body || '',
    href: notification?.href || null,
    avatarUrl: notification?.avatarUrl || null,
    createdAt,
    read: Boolean(notification?.read),
    meta: notification?.meta || null,
  }
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    hydrateNotifications: (state, action) => {
      const items = Array.isArray(action.payload) ? action.payload : []
      state.items = items.slice(0, MAX_NOTIFICATIONS)
      state.unreadCount = state.items.reduce((acc, n) => acc + (n.read ? 0 : 1), 0)
    },
    pushNotification: (state, action) => {
      const next = normalize(action.payload)
      state.items = [next, ...state.items].slice(0, MAX_NOTIFICATIONS)
      if (!next.read) state.unreadCount += 1
    },
    markNotificationRead: (state, action) => {
      const id = action.payload
      const item = state.items.find((n) => n.id === id)
      if (!item || item.read) return
      item.read = true
      state.unreadCount = Math.max(0, state.unreadCount - 1)
    },
    markAllNotificationsRead: (state) => {
      state.items.forEach((n) => {
        n.read = true
      })
      state.unreadCount = 0
    },
    toggleNotificationsOpen: (state) => {
      state.isOpen = !state.isOpen
    },
    closeNotifications: (state) => {
      state.isOpen = false
    },
  },
})

export const {
  hydrateNotifications,
  pushNotification,
  markNotificationRead,
  markAllNotificationsRead,
  toggleNotificationsOpen,
  closeNotifications,
} = notificationsSlice.actions

export default notificationsSlice.reducer

