import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, ImageIcon, MoreHorizontal, SendHorizonal, ShieldOff } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import api from '../api/axios'
import { addMessage, fetchMessages, removeMessage, resetMessages, updateMessage } from '../features/messages/messagesSlice'
import toast from 'react-hot-toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { getRealtimeSocket, joinConversationRoom, leaveConversationRoom } from '../services/realtimeSocket'

const LONG_PRESS_DELAY = 500

const ChatBox = () => {
  const { messages } = useSelector((state) => state.messages)
  const currentUser = useSelector((state) => state.user.value)
  const connections = useSelector((state) => state.connections.connections)
  const { userId } = useParams()
  const { getToken } = useAuth()
  const dispatch = useDispatch()

  const [text, setText] = useState('')
  const [media, setMedia] = useState(null)
  const [chatPartner, setChatPartner] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [deletingMessageId, setDeletingMessageId] = useState(null)
  const [openMenuMessageId, setOpenMenuMessageId] = useState(null)
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState(null)
  const [isNearBottom, setIsNearBottom] = useState(true)

  const scrollContainerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const scrollRafRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const pendingMessageIdRef = useRef(null)
  const mediaPreviewUrl = useMemo(() => (media ? URL.createObjectURL(media) : null), [media])

  const activeConnection = useMemo(
    () => connections.find((connection) => connection._id === userId) || null,
    [connections, userId],
  )

  const conversationKey = useMemo(() => {
    if (!currentUser?._id || !userId) return null
    return [currentUser._id, userId].sort().join(':')
  }, [currentUser?._id, userId])

  const canSendMessages = Boolean(activeConnection)

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [messages],
  )

  const isOwnMessage = useCallback(
    (message) => String(message.from_user_id?._id || message.from_user_id || '') === String(currentUser?._id || ''),
    [currentUser?._id],
  )

  const fetchUserMessages = useCallback(async () => {
    try {
      const token = await getToken()
      return dispatch(fetchMessages({ token, userId }))
    } catch (error) {
      toast.error(error?.message || 'Failed to load messages')
      return null
    }
  }, [dispatch, getToken, userId])

  const fetchPartnerProfile = useCallback(async () => {
    try {
      const token = await getToken()
      const { data } = await api.post(
        '/api/user/profiles',
        { profileId: userId },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      if (data.success) {
        setChatPartner(data.profile)
      }
    } catch (error) {
      toast.error(error?.message || 'Failed to load profile')
    }
  }, [getToken, userId])

  useEffect(() => {
    fetchUserMessages()
    fetchPartnerProfile()

    return () => {
      dispatch(resetMessages())
    }
  }, [dispatch, fetchPartnerProfile, fetchUserMessages])

  useEffect(() => {
    if (activeConnection) {
      setChatPartner(activeConnection)
      return
    }

    if (!chatPartner) {
      fetchPartnerProfile()
    }
  }, [activeConnection, chatPartner, fetchPartnerProfile])

  useEffect(() => {
    if (conversationKey) {
      joinConversationRoom(conversationKey)
    }

    return () => {
      if (conversationKey) {
        leaveConversationRoom(conversationKey)
      }
    }
  }, [conversationKey])

  useEffect(() => {
    if (!mediaPreviewUrl) return undefined
    return () => URL.revokeObjectURL(mediaPreviewUrl)
  }, [mediaPreviewUrl])

  useEffect(() => {
    if (!isNearBottom || !scrollContainerRef.current) return
    if (!scrollRafRef.current && scrollContainerRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isNearBottom, sortedMessages.length])

  useEffect(() => {
    setOpenMenuMessageId(null)
    setPendingDeleteMessage(null)
    setIsNearBottom(true)
  }, [userId])

  useEffect(() => {
    if (!openMenuMessageId) return undefined

    const handlePointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      if (target.closest(`[data-message-id="${openMenuMessageId}"]`)) return
      setOpenMenuMessageId(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openMenuMessageId])

  useEffect(() => {
    return () => {
      clearTimeout(longPressTimerRef.current)
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [])

  const sendMessage = async () => {
    try {
      if (!text.trim() && !media) return
      if (!canSendMessages) {
        toast.error('This chat is read-only after the connection was removed.')
        return
      }

      setIsSending(true)
      const clientMessageId = crypto.randomUUID()
      pendingMessageIdRef.current = clientMessageId
      const messageText = text.trim()
      const optimisticMessage = {
        _id: clientMessageId,
        client_message_id: clientMessageId,
        clientMessageId,
        from_user_id: currentUser,
        to_user_id: activeConnection || chatPartner || { _id: userId },
        conversation_key: conversationKey,
        text: messageText,
        message_type: media?.type?.startsWith('image/')
          ? 'image'
          : media?.type?.startsWith('video/')
            ? 'video'
            : media?.type?.startsWith('audio/')
              ? 'audio'
              : media
                ? 'document'
                : 'text',
        createdAt: new Date().toISOString(),
        seen: false,
        pending: true,
      }

      dispatch(addMessage(optimisticMessage))

      const socket = getRealtimeSocket()
      if (socket?.connected && !media) {
        try {
          await new Promise((resolve, reject) => {
            socket.emit(
              'send-message',
              {
                to_user_id: userId,
                text: messageText,
                client_message_id: clientMessageId,
              },
              (ack) => {
                if (!ack?.success) {
                  reject(new Error(ack?.message || 'Failed to send message'))
                  return
                }

                dispatch(updateMessage(ack.message))
                resolve(ack)
              },
            )
          })

          setText('')
          setMedia(null)
          pendingMessageIdRef.current = null
          return
        } catch (socketError) {
          console.warn('Socket send failed, falling back to HTTP:', socketError.message)
        }
      }

      const token = await getToken()
      const formData = new FormData()
      formData.append('to_user_id', userId)
      formData.append('text', messageText)
      formData.append('client_message_id', clientMessageId)
      if (media) {
        formData.append('media', media)
      }

      const { data } = await api.post('/api/message/send', formData, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!data.success) {
        throw new Error(data.message)
      }

      setText('')
      setMedia(null)
      dispatch(updateMessage(data.message))
      pendingMessageIdRef.current = null
    } catch (error) {
      if (pendingMessageIdRef.current) {
        dispatch(removeMessage(pendingMessageIdRef.current))
        pendingMessageIdRef.current = null
      }
      toast.error(error.message)
    } finally {
      setIsSending(false)
    }
  }

  const requestDeleteMessage = (message) => {
    setOpenMenuMessageId(null)
    setPendingDeleteMessage(message)
  }

  const confirmDeleteMessage = async () => {
    if (!pendingDeleteMessage?._id) return

    const messageId = pendingDeleteMessage._id

    try {
      setDeletingMessageId(messageId)
      dispatch(removeMessage(messageId))
      setPendingDeleteMessage(null)

      const token = await getToken()
      const { data } = await api.delete(`/api/message/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!data.success) {
        throw new Error(data.message)
      }

      toast.success(data.message)
    } catch (error) {
      await fetchUserMessages()
      setPendingDeleteMessage(null)
      toast.error(error.message)
    } finally {
      setDeletingMessageId(null)
    }
  }

  const handleMenuOpen = (message) => {
    if (!isOwnMessage(message)) return
    setOpenMenuMessageId((current) => (current === message._id ? null : message._id))
  }

  const beginLongPress = (message) => {
    if (!isOwnMessage(message)) return
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => {
      handleMenuOpen(message)
    }, LONG_PRESS_DELAY)
  }

  const cancelLongPress = () => {
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  const renderMedia = (message) => {
    const mediaPayload = message.media || (message.media_url ? { url: message.media_url } : null)
    if (!mediaPayload?.url) return null

    const mediaType = mediaPayload.kind || message.message_type

    if (mediaType === 'image') {
      return <img src={mediaPayload.url} className='w-full max-w-sm rounded-lg mb-2' alt='' />
    }

    if (mediaType === 'video') {
      return <video src={mediaPayload.url} controls className='w-full max-w-sm rounded-lg mb-2' />
    }

    if (mediaType === 'audio') {
      return <audio src={mediaPayload.url} controls className='w-full max-w-sm mb-2' />
    }

    return (
      <a
        href={mediaPayload.url}
        target='_blank'
        rel='noreferrer'
        className='mb-2 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200'
      >
        <FileText className='h-4 w-4' />
        Open document
      </a>
    )
  }

  if (!chatPartner) {
    return (
      <div className='flex h-dvh items-center justify-center bg-slate-50 text-slate-500'>
        Loading conversation...
      </div>
    )
  }

  return (
    <div className='flex flex-col h-dvh max-h-dvh bg-slate-50'>
      <div className='shrink-0 flex items-center gap-2 py-2 pl-14 pr-3 sm:px-3 md:px-8 bg-linear-to-b from-indigo-50 to-purple-50 border-b border-gray-200'>
        <img src={chatPartner.profile_picture} alt='' className='size-9 rounded-full' />
        <div className='min-w-0'>
          <p className='font-medium text-slate-900 truncate'>{chatPartner.full_name}</p>
          <p className='text-sm text-gray-500 -mt-1.5 truncate'>@{chatPartner.username}</p>
        </div>
        <div className='ml-auto flex items-center gap-2'>
          {!canSendMessages && (
            <div className='flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700 border border-amber-200'>
              <ShieldOff className='h-3.5 w-3.5' />
              Read only
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={() => {
          if (scrollRafRef.current) return
          scrollRafRef.current = requestAnimationFrame(() => {
            scrollRafRef.current = null
            const element = scrollContainerRef.current
            if (!element) return
            const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
            setIsNearBottom(distanceFromBottom < 64)
          })
        }}
        className='flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 md:px-8'
      >
        <div className='space-y-3 max-w-4xl mx-auto'>
          {sortedMessages.map((message) => {
            const ownMessage = isOwnMessage(message)
            const menuOpen = openMenuMessageId === message._id

            return (
              <div key={message._id} className={`flex flex-col ${ownMessage ? 'items-end' : 'items-start'}`}>
                <div
                  data-message-id={message._id}
                  className={[
                    'relative px-3 py-2 text-sm max-w-[85%] sm:max-w-sm md:max-w-md rounded-2xl shadow-sm border border-black/5 break-words whitespace-pre-wrap transition',
                    ownMessage ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-white text-slate-700 rounded-bl-md',
                  ].join(' ')}
                  onContextMenu={(event) => {
                    if (!ownMessage) return
                    event.preventDefault()
                    handleMenuOpen(message)
                  }}
                  onTouchStart={() => beginLongPress(message)}
                  onTouchEnd={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                >
                  <>
                    {renderMedia(message)}
                    {message.text && <p>{message.text}</p>}
                  </>

                  {ownMessage && (
                    <button
                      type='button'
                      onClick={() => handleMenuOpen(message)}
                      className='absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white text-slate-600 border border-gray-200 shadow-sm flex items-center justify-center hover:bg-slate-50 active:scale-95 transition touch-manipulation'
                      aria-label='Message options'
                    >
                      <MoreHorizontal className='h-4 w-4' />
                    </button>
                  )}

                  {menuOpen && ownMessage && (
                    <div className='absolute right-0 top-full mt-2 z-20 w-44 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden'>
                      <button
                        type='button'
                        onClick={() => requestDeleteMessage(message)}
                        className='w-full px-4 py-3 text-left text-sm text-rose-600 hover:bg-rose-50 transition'
                      >
                        Delete / Unsend
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className='shrink-0 sticky bottom-0 left-0 right-0 bg-slate-50/90 backdrop-blur supports-[backdrop-filter]:bg-slate-50/70 pb-[env(safe-area-inset-bottom)]'>
        <div className='px-3 pt-2 pb-3 md:px-8'>
          <div className='max-w-xl mx-auto space-y-2'>
            {!canSendMessages && (
              <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
                This conversation is read-only because the connection was removed.
              </div>
            )}
            <div className='flex items-center gap-3 pl-4 pr-2 py-2 bg-white w-full border border-gray-200 shadow-sm rounded-full'>
              <input
                type='text'
                className='flex-1 outline-none text-slate-700 bg-transparent min-w-0'
                placeholder='Type a message...'
                inputMode='text'
                autoComplete='off'
                onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && sendMessage()}
                onChange={(event) => setText(event.target.value)}
                value={text}
                disabled={!canSendMessages || isSending}
              />
              <label htmlFor='media' className='shrink-0 cursor-pointer touch-manipulation'>
                {mediaPreviewUrl && media?.type?.startsWith('image/') ? (
                  <img src={mediaPreviewUrl} alt='Selected' className='h-8 w-8 rounded object-cover' />
                ) : (
                  <ImageIcon className='size-6 text-gray-400' />
                )}
                <input
                  type='file'
                  id='media'
                  accept='image/*,video/*,audio/*,application/*'
                  hidden
                  onChange={(event) => setMedia(event.target.files?.[0] || null)}
                  disabled={!canSendMessages || isSending}
                />
              </label>
              <button
                type='button'
                onClick={sendMessage}
                disabled={!canSendMessages || isSending}
                className='shrink-0 bg-linear-to-br from-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-800 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 cursor-pointer text-white h-9 w-9 rounded-full flex items-center justify-center transition will-change-transform touch-manipulation'
                aria-label='Send message'
              >
                {isSending ? (
                  <span className='h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin' />
                ) : (
                  <SendHorizonal size={14} />
                )}
              </button>
            </div>
            {media && (
              <div className='flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600'>
                <span className='truncate'>{media.name}</span>
                <button
                  type='button'
                  onClick={() => setMedia(null)}
                  className='rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200'
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteMessage)}
        title='Delete this message?'
        description='Delete this message for everyone?'
        confirmLabel='Delete'
        onCancel={() => setPendingDeleteMessage(null)}
        onConfirm={confirmDeleteMessage}
        loading={Boolean(deletingMessageId)}
      />
    </div>
  )
}

export default ChatBox
