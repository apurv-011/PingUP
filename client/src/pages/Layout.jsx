import React, { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Loading from '../components/Loading'
import { useSelector } from 'react-redux'

const Layout = () => {

    const user = useSelector((state) => state.user.value)

    const [sideBarOpen, setSideBarOpen] = useState(false)
    const mainRef = useRef(null)
    const { pathname } = useLocation()

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth'

        const container = mainRef.current
        if (container && typeof container.scrollTo === 'function') {
            container.scrollTo({ top: 0, behavior: scrollBehavior })
        } else {
            window.scrollTo({ top: 0, behavior: scrollBehavior })
        }

        if (prefersReducedMotion || !container) return

        container.classList.remove('page-enter')
        // Force reflow so the animation reliably re-triggers on route changes.
        void container.offsetHeight
        container.classList.add('page-enter')
    }, [pathname])

    return user ? (
        <div className='w-full flex h-screen overflow-hidden'>

            <Sidebar sideBarOpen={sideBarOpen} setSideBarOpen={setSideBarOpen} />

            {sideBarOpen && (
                <button
                    type='button'
                    aria-label='Close menu'
                    className='sm:hidden fixed inset-0 bg-black/30 z-40'
                    onClick={() => setSideBarOpen(false)}
                />
            )}

            <div
                ref={mainRef}
                className='flex-1 min-w-0 bg-slate-50 overflow-y-auto'
            >
                <Outlet />
            </div>
            {
                sideBarOpen ?
                    <X className='sm:hidden fixed top-2 right-2 p-2 z-50 bg-white rounded-md shadow w-9 h-9 text-gray-700' onClick={() => setSideBarOpen(false)} />
                    :
                    <Menu className='sm:hidden fixed top-2 right-2 p-2 z-50 bg-white rounded-md shadow w-9 h-9 text-gray-700' onClick={() => setSideBarOpen(true)} />
            }
        </div>
    ) : (
        <Loading />
    )
}

export default Layout
