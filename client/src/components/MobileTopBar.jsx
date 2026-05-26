import React from 'react'
import { Menu, X } from 'lucide-react'
import NotificationsButton from './NotificationsButton'

const MobileTopBar = ({
  sideBarOpen,
  setSideBarOpen,
  showChrome,
}) => {
  return (
    <div
      className={[
        'sm:hidden sticky top-0 z-30',
        'h-14 px-3',
        'bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75',
        'border-b border-black/5',
        'flex items-center justify-between',
        'pt-[env(safe-area-inset-top)]',
      ].join(' ')}
    >
      <button
        type='button'
        aria-label={sideBarOpen ? 'Close menu' : 'Open menu'}
        aria-controls='app-sidebar'
        aria-expanded={sideBarOpen}
        className={[
          'h-11 w-11 rounded-lg bg-white/95 shadow ring-1 ring-black/5',
          'flex items-center justify-center text-gray-700',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2',
          'active:scale-95 transition will-change-transform touch-manipulation',
          'transition-opacity duration-200 ease-out',
          showChrome ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={() => setSideBarOpen((v) => !v)}
      >
        {sideBarOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
      </button>

      <div
        className={[
          'transition-opacity duration-200 ease-out',
          showChrome && !sideBarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      >
        <NotificationsButton />
      </div>
    </div>
  )
}

export default MobileTopBar

