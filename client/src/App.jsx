import React, { Suspense, lazy, useRef } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/react'
import toast, { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { fetchUser } from './features/user/userSlice.js'
import { fetchConnections } from './features/connections/connectionsSlice.js'
import { addMessage } from './features/messages/messagesSlice.js'
import { useSelector } from 'react-redux'
import Notification from './components/Notification.jsx'
import RouteFallback from './components/RouteFallback.jsx'
import { fetchNotifications, pushNotification } from './features/notifications/notificationsSlice.js'

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
  const { getToken } = useAuth();
  const { pathname } = useLocation()
  const pathnameRef = useRef(pathname)

  const dispatch = useDispatch()

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        const token = await getToken()
        dispatch(fetchUser(token))
        dispatch(fetchConnections(token))
        dispatch(fetchNotifications(token))
      }
    }
    fetchData()

  }, [user, getToken, dispatch])

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (currentUser?._id) {
      const eventSource = new EventSource(
        import.meta.env.VITE_BASEURL + '/api/message/' + currentUser._id
      )

      eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data)

        if (pathnameRef.current === ('/messages/' + message.from_user_id._id)) {
          dispatch(addMessage(message))
        } else {
          dispatch(
            pushNotification({
              type: 'message',
              title: message.from_user_id.full_name,
              body: message.text ? message.text.slice(0, 80) : 'Sent you a message',
              href: `/messages/${message.from_user_id._id}`,
              avatarUrl: message.from_user_id.profile_picture,
              createdAt: message.createdAt,
              read: false,
              meta: { messageId: message._id },
            })
          )
          toast.custom((t)=>(
            <Notification t={t} message={message} />
          ), {position: "bottom-right"})
        }
      }
      return () => {
        eventSource.close()
      }
    }
  }, [currentUser?._id, dispatch])

  useEffect(() => {
    if (!currentUser?._id) return

    const notificationSource = new EventSource(
      import.meta.env.VITE_BASEURL + '/api/notifications/stream/' + currentUser._id
    )

    notificationSource.onmessage = (event) => {
      const payload = JSON.parse(event.data)
      if (payload?.type !== 'notification' || !payload.notification) return

      dispatch(pushNotification(payload.notification))
    }

    return () => {
      notificationSource.close()
    }
  }, [currentUser?._id, dispatch])




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
    </ >
  )
}

export default App
