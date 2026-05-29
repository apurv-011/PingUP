import React, { useMemo, useState } from 'react'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from '@clerk/react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  clearNotificationsAsync,
  clearNotificationsLocally,
  fetchNotifications,
  markAllNotificationsRead,
  markAllNotificationsReadAsync,
  markNotificationRead,
  markNotificationReadAsync,
} from '../features/notifications/notificationsSlice'

const timeAgo = (iso) => {
  try {
    const then = new Date(iso).getTime()
    const now = Date.now()
    const s = Math.max(0, Math.floor((now - then) / 1000))
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  } catch {
    return ''
  }
}

const DesktopNotificationsPanel = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { items, unreadCount } = useSelector((state) => state.notifications)
  const [isBusy, setIsBusy] = useState(false)

  const visibleItems = useMemo(() => items.slice(0, 8), [items])

  const persistMarkAllRead = async () => {
    dispatch(markAllNotificationsRead())
    const token = await getToken()
    if (token) {
      dispatch(markAllNotificationsReadAsync(token))
    }
  }

  const persistReadOne = async (id) => {
    dispatch(markNotificationRead(id))
    const token = await getToken()
    if (token) {
      dispatch(markNotificationReadAsync({ token, id }))
    }
  }

  const clearAll = async () => {
    try {
      setIsBusy(true)
      dispatch(clearNotificationsLocally())
      const token = await getToken()
      if (token) {
        const result = await dispatch(clearNotificationsAsync(token))
        if (clearNotificationsAsync.rejected.match(result)) {
          throw new Error(result.error?.message || 'Failed to clear notifications')
        }
      }
    } catch (error) {
      toast.error(error.message)
      const token = await getToken()
      if (token) {
        dispatch(fetchNotifications(token))
      }
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className='bg-white max-w-xs mt-3 p-3 min-h-20 rounded-md shadow text-xs text-slate-800 border border-black/5'>
      <div className='flex items-center justify-between gap-3 mb-3'>
        <div className='flex items-center gap-2 min-w-0'>
          <span className='h-8 w-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center'>
            <Bell className='h-4 w-4' />
          </span>
          <div className='min-w-0'>
            <h3 className='font-semibold text-slate-800'>Notifications</h3>
            <p className='text-[11px] text-slate-500'>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        <span className='min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[11px] leading-5 text-center'>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      </div>

      <div className='flex items-center gap-2 mb-3'>
        <button
          type='button'
          className='flex-1 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 transition text-slate-800 text-[11px] flex items-center justify-center gap-1'
          onClick={persistMarkAllRead}
          disabled={items.length === 0 || unreadCount === 0}
        >
          <CheckCheck className='h-3.5 w-3.5' />
          Mark read
        </button>
        <button
          type='button'
          className='h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 transition text-slate-800 flex items-center justify-center'
          onClick={clearAll}
          disabled={items.length === 0 || isBusy}
          aria-label='Clear notifications'
        >
          <Trash2 className='h-3.5 w-3.5' />
        </button>
      </div>

      <div className='flex flex-col gap-2 max-h-96 overflow-y-auto no-scrollbar'>
        {visibleItems.length === 0 ? (
          <div className='rounded-lg border border-dashed border-slate-200 px-3 py-4 text-slate-500'>
            No notifications yet.
          </div>
        ) : (
          visibleItems.map((notification) => (
            <button
              key={notification.id}
              type='button'
              className='w-full flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 text-left hover:bg-slate-50 transition'
              onClick={async () => {
                await persistReadOne(notification.id)
                if (notification.href) navigate(notification.href)
              }}
            >
              <div className='relative shrink-0'>
                {notification.avatarUrl ? (
                  <img
                    src={notification.avatarUrl}
                    alt=''
                    className='h-9 w-9 rounded-full object-cover'
                    loading='lazy'
                    decoding='async'
                  />
                ) : (
                  <div className='h-9 w-9 rounded-full bg-indigo-100' />
                )}
                {!notification.read && (
                  <span className='absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-indigo-600 ring-2 ring-white' />
                )}
              </div>

              <div className='min-w-0 flex-1'>
                <div className='flex items-start justify-between gap-2'>
                  <p className='font-medium text-slate-900 truncate'>{notification.title}</p>
                  <span className='text-[10px] text-slate-400 shrink-0'>{timeAgo(notification.createdAt)}</span>
                </div>
                <p className='text-slate-500 line-clamp-2'>{notification.body || 'New activity'}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default DesktopNotificationsPanel
