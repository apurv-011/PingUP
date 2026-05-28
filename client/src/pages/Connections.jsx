import React, { useEffect, useState } from 'react'
import { Users, UserPlus, UserCheck, UserRoundPen, MessageSquare, UserMinus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useAuth } from '@clerk/react'
import { fetchConnections, removeConnectionLocally } from '../features/connections/connectionsSlice'
import api from '../api/axios'
import toast from 'react-hot-toast'
import ConfirmDialog from '../components/ConfirmDialog'


const Connections = () => {

  const [currentTab, setCurrentTab] = useState('Followers')
  const [pendingRemovalId, setPendingRemovalId] = useState(null)
  const [confirmRemoval, setConfirmRemoval] = useState({ open: false, user: null })

  const navigate = useNavigate()
  const { getToken } = useAuth();
  const dispatch = useDispatch()

  const { connections, pendingConnections, followers, following } = useSelector((state) => state.connections)

  const dataArray = [
    { label: 'Followers', value: followers, icon: Users },
    { label: 'Following', value: following, icon: UserCheck },
    { label: 'Pending', value: pendingConnections, icon: UserRoundPen },
    { label: 'Connections', value: connections, icon: UserPlus },
  ]

  const handleUnfollow = async (userId) => {
    try {
      const { data } = await api.post("/api/user/unfollow", { id: userId }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      })
      if (data.success) {
        toast.success(data.message)
        dispatch(fetchConnections(await getToken()))
      } else {
        toast(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const acceptConnection = async (userId) => {
    try {
      const { data } = await api.post("/api/user/accept", { id: userId }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      })
      if (data.success) {
        toast.success(data.message)
        dispatch(fetchConnections(await getToken()))
      } else {
        toast(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const requestRemoveConnection = (user) => {
    setConfirmRemoval({ open: true, user })
  }

  const confirmRemoveConnection = async () => {
    if (!confirmRemoval.user) return

    const targetUserId = confirmRemoval.user._id
    setPendingRemovalId(targetUserId)

    try {
      const token = await getToken()
      dispatch(removeConnectionLocally({ userId: targetUserId }))

      const { data } = await api.post(
        '/api/user/remove-connection',
        { id: targetUserId },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )

      if (data.success) {
        toast.success(data.message)
      } else {
        throw new Error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
      const token = await getToken()
      dispatch(fetchConnections(token))
    } finally {
      setPendingRemovalId(null)
      setConfirmRemoval({ open: false, user: null })
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getToken()
      if (cancelled) return
      dispatch(fetchConnections(token))
    })()
    return () => {
      cancelled = true
    }
  }, [dispatch, getToken])




  return (
    <div className='min-h-screen bg-slate-50'>
      <div className='max-w-6xl mx-auto p-4'>
        {/* Title */}
        <div className='mb-6'>
          <h1 className='text-3xl font-bold text-slate-900 mb-2'>Connections</h1>
          <p className='text-slate-600'>manage your network and discover new connections</p>
        </div>
        {/* Counts */}
        <div className='mb-6 flex flex-wrap gap-6'>
          {dataArray.map((item, index) => (
            <div key={index} className='flex flex-col items-center justify-center gap-1 border h-15 w-35 border-gray-200 bg-white shadow rounded-md'>
              <b>{item.value.length}</b>
              <p className='text-slate-600'>{item.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className='inline-flex flex-wrap items-center border border-gray-200 rounded-md p-1 bg-white shadow-sm'>
          {dataArray.map((tab) => (
            <button onClick={() => setCurrentTab(tab.label)} key={tab.label} className={`flex items-center px-2 py-1 text-sm cursor-pointer rounded-md transition-colors ${currentTab === tab.label ? 'bg-white font-medium text-black' : 'text-gray-500 hover:text-black'}`}>
              <tab.icon className='w-4 h-4' />
              <span className='ml-1'>{tab.label}</span>
              {tab.count !== undefined && (
                <span className='ml-2 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full'>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Connections */}
        <div className='flex flex-wrap gap-5 mt-4'>
          {dataArray.find((item) => item.label === currentTab).value.map((user) => (
            <div key={user._id} className='w-full max-w-76 flex gap-4 p-4 bg-white shadow rounded-md'>
              <img src={user.profile_picture} alt="" className='rounded-full w-8 h-8 shadow-md mx-auto' />
              <div className='flex-1'>
                <p className='font-medium text-slate-700'>{user.full_name}</p>
                <p className='text-slate-500'>@{user.username}</p>
                <p className='text-sm text-gray-600'>@{user.bio.slice(0, 30)}...</p>
                <div className='flex max-sm:flex-col gap-2 mt-2'>
                  {
                    <button onClick={() => navigate(`/profile/${user._id}`)} className='w-full p-2 text-sm rounded bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition text-white cursor-pointer'>
                      View Profile
                    </button>
                  }
                  {
                    currentTab === 'Following' && (
                      <button onClick={() => handleUnfollow(user._id)} className='w-full p-2 text-sm rounded bg-slate-100 hover:bg-slate-200 text-black active:scale-95 transition cursor-pointer'>Unfollow</button>
                    )
                  }
                  {
                    currentTab === 'Pending' && (
                      <button onClick={() => acceptConnection(user._id)} className='w-full p-2 text-sm rounded bg-slate-100 hover:bg-slate-200 text-black active:scale-95 transition cursor-pointer'>Accept</button>
                    )
                  }
                  {
                    currentTab === 'Connections' && (
                      <>
                        <button onClick={() => navigate(`/messages/${user._id}`)} className='w-full p-2 text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1'>
                          <MessageSquare className='w-4 h-4' />
                          Message</button>
                        <button
                          onClick={() => requestRemoveConnection(user)}
                          className='w-full p-2 text-sm rounded bg-rose-50 hover:bg-rose-100 text-rose-700 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1'
                        >
                          {pendingRemovalId === user._id ? (
                            <span className='h-4 w-4 rounded-full border-2 border-rose-600 border-t-transparent animate-spin' />
                          ) : (
                            <UserMinus className='w-4 h-4' />
                          )}
                          Remove
                        </button>
                      </>
                    )
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ConfirmDialog
        open={confirmRemoval.open}
        title='Remove this connection?'
        description='This removes the relationship and makes the chat read-only. Old messages stay available unless chat deletion mode is enabled on the server.'
        confirmLabel='Remove connection'
        onCancel={() => setConfirmRemoval({ open: false, user: null })}
        onConfirm={confirmRemoveConnection}
        loading={Boolean(pendingRemovalId)}
      />
    </div>
  )
}

export default Connections
