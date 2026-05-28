import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import api from '../../api/axios'

const MAX_NOTIFICATIONS = 50

const initialState = {
  items: [],
  unreadCount: 0,
  isOpen: false,
  status: 'idle',
  error: null,
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
    actorId: notification?.actorId || null,
    entityType: notification?.entityType || null,
    entityId: notification?.entityId || null,
    dedupeKey: notification?.dedupeKey || null,
  }
}

const sortNotifications = (items = []) =>
  [...items].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))

const mergeNotifications = (current = [], incoming = []) => {
  const map = new Map()

  ;[...incoming, ...current].forEach((item) => {
    const normalized = normalize(item)
    const key = normalized.id || normalized.dedupeKey
    if (!key) return
    if (!map.has(key)) {
      map.set(key, normalized)
    } else {
      const existing = map.get(key)
      map.set(key, { ...existing, ...normalized, read: existing.read || normalized.read })
    }
  })

  return sortNotifications(Array.from(map.values())).slice(0, MAX_NOTIFICATIONS)
}

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (token) => {
    const { data } = await api.get('/api/notifications', {
      headers: { Authorization: `Bearer ${token}` },
    })

    return data.success ? data : null
  },
)

export const markNotificationReadAsync = createAsyncThunk(
  'notifications/markNotificationReadAsync',
  async ({ token, id }) => {
    const { data } = await api.patch(
      `/api/notifications/${id}/read`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    )

    return data.success ? data.notification : null
  },
)

export const markAllNotificationsReadAsync = createAsyncThunk(
  'notifications/markAllNotificationsReadAsync',
  async (token) => {
    const { data } = await api.patch(
      '/api/notifications/read-all',
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    )

    return data.success ? true : null
  },
)

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    hydrateNotifications: (state, action) => {
      const payload = action.payload
      const notifications = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.notifications)
          ? payload.notifications
          : []

      state.items = mergeNotifications(state.items, notifications)
      state.unreadCount =
        typeof payload?.unreadCount === 'number'
          ? payload.unreadCount
          : state.items.reduce((acc, notification) => acc + (notification.read ? 0 : 1), 0)
    },
    pushNotification: (state, action) => {
      const next = normalize(action.payload)
      const exists = state.items.find(
        (notification) =>
          notification.id === next.id ||
          (notification.dedupeKey && next.dedupeKey && notification.dedupeKey === next.dedupeKey),
      )

      if (exists) {
        state.items = mergeNotifications(state.items, [next])
      } else {
        state.items = sortNotifications([next, ...state.items]).slice(0, MAX_NOTIFICATIONS)
        if (!next.read) state.unreadCount += 1
      }
    },
    markNotificationRead: (state, action) => {
      const id = action.payload
      const item = state.items.find((notification) => notification.id === id)
      if (!item || item.read) return
      item.read = true
      state.unreadCount = Math.max(0, state.unreadCount - 1)
    },
    markAllNotificationsRead: (state) => {
      state.items.forEach((notification) => {
        notification.read = true
      })
      state.unreadCount = 0
    },
    toggleNotificationsOpen: (state) => {
      state.isOpen = !state.isOpen
    },
    closeNotifications: (state) => {
      state.isOpen = false
    },
    replaceNotifications: (state, action) => {
      const payload = action.payload || {}
      state.items = mergeNotifications([], payload.notifications || [])
      state.unreadCount =
        typeof payload.unreadCount === 'number'
          ? payload.unreadCount
          : state.items.reduce((acc, notification) => acc + (notification.read ? 0 : 1), 0)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = 'succeeded'
        if (action.payload) {
          state.items = mergeNotifications(state.items, action.payload.notifications || [])
          state.unreadCount =
            typeof action.payload.unreadCount === 'number'
              ? action.payload.unreadCount
              : state.items.reduce((acc, notification) => acc + (notification.read ? 0 : 1), 0)
        }
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error?.message || 'Failed to load notifications'
      })
      .addCase(markNotificationReadAsync.fulfilled, (state, action) => {
        if (!action.payload) return
        const item = state.items.find((notification) => notification.id === action.payload.id)
        if (item && !item.read) {
          item.read = true
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
      })
      .addCase(markAllNotificationsReadAsync.fulfilled, (state) => {
        state.items.forEach((notification) => {
          notification.read = true
        })
        state.unreadCount = 0
      })
  },
})

export const {
  hydrateNotifications,
  pushNotification,
  markNotificationRead,
  markAllNotificationsRead,
  toggleNotificationsOpen,
  closeNotifications,
  replaceNotifications,
} = notificationsSlice.actions

export default notificationsSlice.reducer
