import React, { Suspense, useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Loading from '../components/Loading'
import { useSelector } from 'react-redux'
import RouteFallback from '../components/RouteFallback'

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

    useEffect(() => {
        const isSmallScreen = window.matchMedia?.('(max-width: 639px)')?.matches
        if (!isSmallScreen) return

        const originalOverflow = document.body.style.overflow
        if (sideBarOpen) document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = originalOverflow
        }
    }, [sideBarOpen])

    return user ? (
        <div className='w-full flex h-dvh overflow-hidden'>

            <Sidebar sideBarOpen={sideBarOpen} setSideBarOpen={setSideBarOpen} />

            <button
                type='button'
                aria-label='Close menu'
                className={[
                    'sm:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]',
                    'transition-opacity duration-200 ease-out',
                    sideBarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
                ].join(' ')}
                onClick={() => setSideBarOpen(false)}
            />

            <div
                ref={mainRef}
                className='flex-1 min-w-0 bg-slate-50 overflow-y-auto'
            >
                <Suspense fallback={<RouteFallback variant='outlet' />}>
                    <Outlet />
                </Suspense>
            </div>

            <button
                type='button'
                aria-label={sideBarOpen ? 'Close menu' : 'Open menu'}
                aria-controls='app-sidebar'
                aria-expanded={sideBarOpen}
                className={[
                    'sm:hidden fixed left-3 top-3 z-50',
                    'h-11 w-11 rounded-lg bg-white/95 shadow ring-1 ring-black/5',
                    'flex items-center justify-center text-gray-700',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2',
                    'active:scale-95 transition will-change-transform touch-manipulation',
                ].join(' ')}
                onClick={() => setSideBarOpen((v) => !v)}
            >
                {sideBarOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
            </button>
        </div>
    ) : (
        <Loading />
    )
}

export default Layout
