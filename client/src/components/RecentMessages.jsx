import React, { useCallback, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import moment from 'moment'
import { useAuth, useUser } from '@clerk/react'
import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { fetchRecentMessages } from '../features/messages/messagesSlice'

const RecentMessages = () => {
  const dispatch = useDispatch()
  const { user } = useUser()
  const { getToken } = useAuth()
  const { connections } = useSelector((state) => state.connections)
  const recentMessages = useSelector((state) => state.messages.recentMessages)

  const allowedConnectionIds = useMemo(
    () => new Set(connections.map((connection) => connection._id)),
    [connections],
  )

  const visibleMessages = useMemo(() => {
    return recentMessages
      .filter((message) => {
        const senderId = message.from_user_id?._id || message.from_user_id
        const recipientId = message.to_user_id?._id || message.to_user_id
        return allowedConnectionIds.has(senderId) || allowedConnectionIds.has(recipientId)
      })
      .map((message) => {
        const ownMessage = String(message.from_user_id?._id || message.from_user_id) === String(user?._id)
        const partner = ownMessage ? message.to_user_id : message.from_user_id

        return {
          ...message,
          partner,
          partnerId: partner?._id || partner,
          isIncoming: String(message.to_user_id?._id || message.to_user_id) === String(user?._id),
        }
      })
  }, [allowedConnectionIds, recentMessages, user?._id])

  const loadRecentMessages = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const result = await dispatch(fetchRecentMessages(token))
      if (fetchRecentMessages.rejected.match(result)) {
        throw new Error(result.error?.message || 'Failed to load recent messages')
      }
    } catch (error) {
      toast.error(error.message)
    }
  }, [dispatch, getToken])

  useEffect(() => {
    if (!user?._id) return
    loadRecentMessages()
  }, [loadRecentMessages, user?._id, connections])

  return (
    <div className='bg-white max-w-xs mt-3 p-3 min-h-20 rounded-md shadow text-xs text-slate-800'>
      <h3 className='font-semibold text-slate-800 mb-3'>Recent Messages</h3>
      <div className='flex flex-col max-h-38 overflow-y-auto no-scrollbar'>
        {visibleMessages.length === 0 ? (
          <div className='rounded-lg border border-dashed border-slate-200 px-3 py-4 text-slate-500'>
            No recent messages yet.
          </div>
        ) : (
          visibleMessages.map((message) => (
            <Link
              to={`/messages/${message.partnerId}`}
              key={message._id || message.id || message.conversation_key}
              className='flex items-start gap-2 py-2 hover:bg-slate-100 rounded-lg px-2'
            >
              <img
                src={message.partner?.profile_picture}
                alt=''
                className='w-6 h-6 rounded-full shrink-0'
                loading='lazy'
                decoding='async'
              />
              <div className='w-full min-w-0'>
                <div className='flex justify-between gap-2'>
                  <p className='font-medium truncate'>{message.partner?.full_name}</p>
                  <p className='text-[10px] text-slate-400 shrink-0'>{moment(message.createdAt).fromNow()}</p>
                </div>
                <div className='flex justify-between gap-2'>
                  <p className='text-gray-500 truncate'>{message.preview || message.text || 'Media'}</p>
                  {message.isIncoming && !message.seen && (
                    <p className='bg-indigo-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[10px] shrink-0'>
                      1
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

export default RecentMessages
