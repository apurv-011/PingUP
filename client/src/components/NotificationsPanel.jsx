import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, Trash2, X } from 'lucide-react'
import { useAuth } from '@clerk/react'
import toast from 'react-hot-toast'
import {
  closeNotifications,
  clearNotificationsAsync,
  clearNotificationsLocally,
  fetchNotifications,
  markAllNotificationsRead,
  markAllNotificationsReadAsync,
  markNotificationRead,
  markNotificationReadAsync,
  deleteNotificationAsync,
  removeNotification,
} from '../features/notifications/notificationsSlice'
import ConfirmDialog from './ConfirmDialog'

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
    const d = Math.floor(h / 24)
    return `${d}d`
  } catch {
    return ''
  }
}

const NotificationsPanel = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { isOpen, items, unreadCount } = useSelector((s) => s.notifications)
  const panelRef = useRef(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [isClearingAll, setIsClearingAll] = useState(false)
  const [dialogState, setDialogState] = useState({ open: false, type: null, id: null })

  const visibleItems = useMemo(() => items.slice(0, 30), [items])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') dispatch(closeNotifications())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch, isOpen])

  useEffect(() => {
    if (!isOpen) return
    panelRef.current?.focus?.()
  }, [isOpen])

  const persistReadAll = async () => {
    dispatch(markAllNotificationsRead())
    const token = await getToken()
    if (token) {
      dispatch(markAllNotificationsReadAsync(token))
    }
  }

  const persistReadOne = async (notificationId) => {
    dispatch(markNotificationRead(notificationId))
    const token = await getToken()
    if (token) {
      dispatch(markNotificationReadAsync({ token, id: notificationId }))
    }
  }

  const requestDeleteNotification = (notificationId) => {
    setDialogState({
      open: true,
      type: 'single',
      id: notificationId,
    })
  }

  const confirmDeleteNotification = async () => {
    if (!dialogState.id) return
    setPendingDeleteId(dialogState.id)
    const token = await getToken()
    try {
      dispatch(removeNotification(dialogState.id))
      if (token) {
        const result = await dispatch(deleteNotificationAsync({ token, id: dialogState.id }))
        if (deleteNotificationAsync.rejected.match(result)) {
          throw new Error(result.error?.message || 'Failed to delete notification')
        }
      }
    } catch (error) {
      toast.error(error.message)
      if (token) {
        dispatch(fetchNotifications(token))
      }
    } finally {
      setPendingDeleteId(null)
      setDialogState({ open: false, type: null, id: null })
    }
  }

  const confirmClearNotifications = async () => {
    setIsClearingAll(true)
    const token = await getToken()
    try {
      dispatch(clearNotificationsLocally())
      if (token) {
        const result = await dispatch(clearNotificationsAsync(token))
        if (clearNotificationsAsync.rejected.match(result)) {
          throw new Error(result.error?.message || 'Failed to clear notifications')
        }
      }
    } catch (error) {
      toast.error(error.message)
      if (token) {
        dispatch(fetchNotifications(token))
      }
    } finally {
      setIsClearingAll(false)
      setDialogState({ open: false, type: null, id: null })
    }
  }

  return (
    <>
      <button
        type='button'
        aria-label='Close notifications'
        className={[
          'fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200 ease-out',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={() => dispatch(closeNotifications())}
      />

      <aside
        ref={panelRef}
        tabIndex={-1}
        role='dialog'
        aria-label='Notifications'
        className={[
          'fixed z-50 right-2 top-2 sm:right-4 sm:top-4 w-[calc(100vw-16px)] sm:w-96 max-w-[28rem]',
          'max-h-[calc(100dvh-16px)] sm:max-h-[calc(100dvh-32px)]',
          'rounded-2xl bg-white shadow-xl border border-black/10 overflow-hidden',
          'transition-transform transition-opacity duration-200 ease-out will-change-transform',
          isOpen
            ? 'opacity-100 translate-y-0 translate-x-0 pointer-events-auto'
            : 'opacity-0 translate-y-1 translate-x-2 pointer-events-none',
        ].join(' ')}
      >
        <div className='flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-linear-to-b from-indigo-50 to-white'>
          <div className='min-w-0'>
            <p className='font-semibold text-slate-900'>Notifications</p>
            <p className='text-xs text-slate-500'>
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              className='h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 transition text-slate-800 text-sm flex items-center gap-2 touch-manipulation'
              onClick={persistReadAll}
              disabled={items.length === 0 || unreadCount === 0}
            >
              <CheckCheck className='h-4 w-4' />
              Read
            </button>
            <button
              type='button'
              className='h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 transition text-slate-800 text-sm flex items-center gap-2 touch-manipulation'
              onClick={() => setDialogState({ open: true, type: 'clear', id: null })}
              disabled={items.length === 0}
            >
              <Trash2 className='h-4 w-4' />
              Clear
            </button>
            <button
              type='button'
              className='h-9 w-9 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 transition text-slate-800 flex items-center justify-center touch-manipulation'
              onClick={() => dispatch(closeNotifications())}
              aria-label='Close'
            >
              <X className='h-4 w-4' />
            </button>
          </div>
        </div>

        <div className='max-h-[calc(100dvh-120px)] overflow-y-auto no-scrollbar'>
          {visibleItems.length === 0 ? (
            <div className='p-6 text-sm text-slate-600'>
              No notifications yet.
            </div>
          ) : (
            <ul className='p-2'>
              {visibleItems.map((notification) => (
                <li key={notification.id}>
                  <button
                    type='button'
                    className={[
                      'w-full text-left flex gap-3 px-3 py-3 rounded-xl transition',
                      'hover:bg-slate-50 active:scale-[0.99] touch-manipulation',
                    ].join(' ')}
                    onClick={async () => {
                      await persistReadOne(notification.id)
                      if (notification.href) navigate(notification.href)
                      dispatch(closeNotifications())
                    }}
                  >
                    <div className='relative shrink-0'>
                      {notification.avatarUrl ? (
                        <img
                          src={notification.avatarUrl}
                          alt=''
                          className='h-10 w-10 rounded-full object-cover ring-1 ring-black/5'
                          loading='lazy'
                          decoding='async'
                        />
                      ) : (
                        <div className='h-10 w-10 rounded-full bg-indigo-100 ring-1 ring-black/5' />
                      )}
                      {!notification.read && (
                        <span className='absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-indigo-600 ring-2 ring-white' />
                      )}
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-start justify-between gap-3'>
                        <p className='text-sm font-medium text-slate-900 truncate'>{notification.title}</p>
                        <span className='text-[11px] text-slate-400 shrink-0'>{timeAgo(notification.createdAt)}</span>
                      </div>
                      {notification.body && (
                        <p className='text-sm text-slate-600 line-clamp-2'>{notification.body}</p>
                      )}
                    </div>
                    <span
                      role='button'
                      tabIndex={0}
                      className='shrink-0 h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500'
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        requestDeleteNotification(notification.id)
                      }}
                    >
                      {pendingDeleteId === notification.id ? (
                        <span className='h-3 w-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin' />
                      ) : (
                        <Trash2 className='h-4 w-4' />
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.type === 'clear' ? 'Clear all notifications?' : 'Delete notification?'}
        description={
          dialogState.type === 'clear'
            ? 'This removes every notification from your inbox and resets the badge count.'
            : 'This removes the notification from your inbox and updates your unread count.'
        }
        confirmLabel={dialogState.type === 'clear' ? 'Clear all' : 'Delete'}
      onCancel={() => setDialogState({ open: false, type: null, id: null })}
      onConfirm={dialogState.type === 'clear' ? confirmClearNotifications : confirmDeleteNotification}
        loading={isClearingAll || pendingDeleteId === dialogState.id}
      />
    </>
  )
}

export default NotificationsPanel
