import React, { Suspense, useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Loading from '../components/Loading'
import { useSelector } from 'react-redux'
import RouteFallback from '../components/RouteFallback'
import NotificationsButton from '../components/NotificationsButton'
import NotificationsPanel from '../components/NotificationsPanel'
import { useDispatch } from 'react-redux'
import { hydrateNotifications } from '../features/notifications/notificationsSlice'

const Layout = () => {

    const user = useSelector((state) => state.user.value)
    const notificationsItems = useSelector((state) => state.notifications.items)
    const dispatch = useDispatch()

    const [sideBarOpen, setSideBarOpen] = useState(false)
    const [showMobileChrome, setShowMobileChrome] = useState(true)
    const mainRef = useRef(null)
    const { pathname } = useLocation()
    const rafRef = useRef(null)

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

    useEffect(() => {
        const isSmallScreen = window.matchMedia?.('(max-width: 639px)')?.matches
        if (!isSmallScreen) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSideBarOpen(false)
    }, [pathname])

    useEffect(() => {
        try {
            const raw = localStorage.getItem('pingup.notifications.v1')
            if (!raw) return
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) dispatch(hydrateNotifications(parsed))
        } catch {
            // ignore
        }
    }, [dispatch])

    useEffect(() => {
        try {
            localStorage.setItem('pingup.notifications.v1', JSON.stringify(notificationsItems.slice(0, 50)))
        } catch {
            // ignore
        }
    }, [notificationsItems])

    useEffect(() => {
        const container = mainRef.current
        if (!container) return

        const onScroll = () => {
            if (rafRef.current) return
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null
                const st = container.scrollTop
                const next = st <= 8
                setShowMobileChrome((prev) => (prev === next ? prev : next))
            })
        }

        container.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            container.removeEventListener('scroll', onScroll)
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [])

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
                className={[
                    'flex-1 min-w-0 bg-slate-50 overflow-y-auto',
                    'max-sm:transition-[padding] max-sm:duration-200 max-sm:ease-out',
                    showMobileChrome ? 'max-sm:pt-16' : 'max-sm:pt-3',
                ].join(' ')}
            >
                <Suspense fallback={<RouteFallback variant='outlet' />}>
                    <Outlet />
                </Suspense>
            </div>

            <NotificationsPanel />

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
                    'transition-transform transition-opacity duration-200 ease-out',
                    showMobileChrome ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none',
                ].join(' ')}
                onClick={() => setSideBarOpen((v) => !v)}
            >
                {sideBarOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
            </button>

            <div
                className={[
                    'sm:hidden fixed right-3 top-3 z-50',
                    'transition-transform transition-opacity duration-200 ease-out',
                    showMobileChrome && !sideBarOpen
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 -translate-y-3 pointer-events-none',
                ].join(' ')}
            >
                <NotificationsButton />
            </div>
        </div>
    ) : (
        <Loading />
    )
}

export default Layout
