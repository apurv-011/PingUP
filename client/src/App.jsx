import React, { Suspense, lazy, useEffect, useRef } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/react'
import toast, { Toaster } from 'react-hot-toast'
import { useDispatch, useSelector } from 'react-redux'
import { fetchUser } from './features/user/userSlice.js'
import { fetchConnections, removeConnectionLocally } from './features/connections/connectionsSlice.js'
import {
  addMessage,
  removeMessageForViewer,
  touchMessageFeed,
  resetMessages,
  updateMessage,
} from './features/messages/messagesSlice.js'
import Notification from './components/Notification.jsx'
import RouteFallback from './components/RouteFallback.jsx'
import {
  clearNotificationsLocally,
  fetchNotifications,
  pushNotification,
  removeNotification,
} from './features/notifications/notificationsSlice.js'
import { apiBaseUrl } from './api/axios.js'

const Login = lazy(() => import('./pages/Login'))
const Layout = lazy(() => import('./pages/Layout'))
const Feed = lazy(() => import('./pages/Feed'))
const Messages = lazy(() => import('./pages/Messages'))
const ChatBox = lazy(() => import('./pages/ChatBox'))
const Connections = lazy(() => import('./pages/Connections'))
const Discover = lazy(() => import('./pages/Discover'))
const Profile = lazy(() => import('./pages/Profile'))
const CreatePost = lazy(() => import('./pages/CreatePost'))

const App = () => {
  const currentUser = useSelector((state) => state.user.value)
  const { user } = useUser()
  const { getToken } = useAuth()
  const { pathname } = useLocation()
  const pathnameRef = useRef(pathname)

  const dispatch = useDispatch()

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      const token = await getToken()
      dispatch(fetchUser(token))
      dispatch(fetchConnections(token))
      dispatch(fetchNotifications(token))
    }

    fetchData()
  }, [user, getToken, dispatch])

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (!currentUser?._id) return undefined

    const eventSource = new EventSource(apiBaseUrl + '/api/message/' + currentUser._id)

    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data)

      if (payload?.type === 'message') {
        const message = payload.message
        const senderId = message?.from_user_id?._id || message?.from_user_id
        const recipientId = message?.to_user_id?._id || message?.to_user_id
        const isActiveChat =
          pathnameRef.current === `/messages/${senderId}` ||
          pathnameRef.current === `/messages/${recipientId}`

        if (payload.action === 'created') {
          if (isActiveChat) {
            dispatch(addMessage(message))
          } else {
            dispatch(touchMessageFeed())
            dispatch(
              pushNotification({
                type: 'message',
                title: message.from_user_id?.full_name || message.from_user_id?.username || 'New message',
                body: message.text ? message.text.slice(0, 80) : 'Sent you a message',
                href: `/messages/${senderId}`,
                avatarUrl: message.from_user_id?.profile_picture || null,
                createdAt: message.createdAt,
                read: false,
                meta: { messageId: message._id },
              }),
            )
            toast.custom(
              (t) => <Notification t={t} message={message} />,
              { position: 'bottom-right' },
            )
          }
          return
        }

        if (payload.action === 'deleted' || payload.action === 'deleted_for_everyone') {
          dispatch(removeMessageForViewer(payload.messageId || message?._id))
          dispatch(touchMessageFeed())
          return
        }

        if (payload.action === 'media_deleted') {
          if (isActiveChat) {
            dispatch(updateMessage(message))
          }
          dispatch(touchMessageFeed())
          return
        }

        if (payload.type === 'conversation_removed') {
          dispatch(touchMessageFeed())
        }
      }
    }

    return () => {
      eventSource.close()
    }
  }, [currentUser?._id, dispatch])

  useEffect(() => {
    if (!currentUser?._id) return undefined

    const postSource = new EventSource(apiBaseUrl + '/api/post/stream/' + currentUser._id)

    postSource.onmessage = (event) => {
      const payload = JSON.parse(event.data)
      if (!payload || payload.type === 'connected') return

      window.dispatchEvent(new CustomEvent('pingup:post-event', { detail: payload }))
    }

    return () => {
      postSource.close()
    }
  }, [currentUser?._id])

  useEffect(() => {
    if (!currentUser?._id) return undefined

    const notificationSource = new EventSource(
      apiBaseUrl + '/api/notifications/stream/' + currentUser._id,
    )

    notificationSource.onmessage = (event) => {
      const payload = JSON.parse(event.data)

      if (payload?.type === 'notification' && payload.notification) {
        dispatch(pushNotification(payload.notification))
      }

      if (payload?.type === 'notification_deleted' && payload.id) {
        dispatch(removeNotification(payload.id))
      }

      if (payload?.type === 'notifications_cleared') {
        dispatch(clearNotificationsLocally())
      }
    }

    return () => {
      notificationSource.close()
    }
  }, [currentUser?._id, dispatch])

  useEffect(() => {
    if (!currentUser?._id) return undefined

    const connectionSource = new EventSource(
      apiBaseUrl + '/api/user/stream/' + currentUser._id,
    )

    connectionSource.onmessage = (event) => {
      const payload = JSON.parse(event.data)

      if (payload?.type !== 'connection_removed') return

      dispatch(removeConnectionLocally(payload))
      dispatch(touchMessageFeed())

      if (payload.mode === 'delete' && pathnameRef.current === `/messages/${payload.targetUserId}`) {
        dispatch(resetMessages())
      }

      ;(async () => {
        const token = await getToken()
        if (token) {
          dispatch(fetchConnections(token))
        }
      })()
    }

    return () => {
      connectionSource.close()
    }
  }, [currentUser?._id, dispatch, getToken])

  return (
    <>
      <Toaster />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path='/' element={!user ? <Login /> : <Layout />}>
            <Route index element={<Feed />} />
            <Route path='messages' element={<Messages />} />
            <Route path='messages/:userId' element={<ChatBox />} />
            <Route path='connections' element={<Connections />} />
            <Route path='discover' element={<Discover />} />
            <Route path='profile' element={<Profile />} />
            <Route path='profile/:profileId' element={<Profile />} />
            <Route path='create-post' element={<CreatePost />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}

export default App
