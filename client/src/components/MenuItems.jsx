import React from 'react'
import { menuItemsData } from '../assets/assets'
import { NavLink } from 'react-router-dom'

const MenuItems = ({setSideBarOpen}) => {

  const prefetchRoute = (to) => {
    const run = () => {
      switch (to) {
        case '/':
          return import('../pages/Feed')
        case '/messages':
          return import('../pages/Messages')
        case '/connections':
          return import('../pages/Connections')
        case '/discover':
          return import('../pages/Discover')
        case '/profile':
          return import('../pages/Profile')
        case '/create-post':
          return import('../pages/CreatePost')
        default:
          return null
      }
    }

    if (typeof window === 'undefined') return
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 800 })
    } else {
      setTimeout(run, 150)
    }
  }

  return (
    <div className='px-3 text-gray-600 space-y-1 font-medium'>
        {
            menuItemsData.map(({to, label, Icon})=>(
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={()=>setSideBarOpen(false)}
                  onMouseEnter={() => prefetchRoute(to)}
                  onFocus={() => prefetchRoute(to)}
                  onTouchStart={() => prefetchRoute(to)}
                  className={({isActive})=>`px-3.5 py-1.5 flex items-center gap-2 rounded-xl ${isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'}`}
                >
                    {React.createElement(Icon, { className: 'w-4 h-4' })}
                    {label}
                </NavLink>
            ))
        }
    </div>
  )
}

export default MenuItems
