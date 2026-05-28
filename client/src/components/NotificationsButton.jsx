import React from 'react'
import { Bell } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { toggleNotificationsOpen } from '../features/notifications/notificationsSlice'

const NotificationsButton = ({ className = '' }) => {
  const dispatch = useDispatch()
  const { unreadCount, isOpen } = useSelector((s) => s.notifications)

  return (
    <button
      type='button'
      aria-label='Notifications'
      aria-expanded={isOpen}
      className={[
        'relative h-11 w-11 shrink-0 rounded-lg bg-white/95 shadow ring-1 ring-black/5',
        'flex items-center justify-center text-gray-700',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2',
        'active:scale-95 transition will-change-transform touch-manipulation',
        className,
      ].join(' ')}
      onClick={() => dispatch(toggleNotificationsOpen())}
    >
      <Bell className='h-5 w-5' />
      {unreadCount > 0 && (
        <span className='absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[11px] leading-5 text-center ring-2 ring-white'>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

export default NotificationsButton
