import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImageIcon, SendHorizonal } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import api from '../api/axios';
import { addMessage, fetchMessages, resetMessages } from '../features/messages/messagesSlice';
import toast from 'react-hot-toast';

const ChatBox = () => {

  const { messages } = useSelector((state) => state.messages);
  const { userId } = useParams()
  const { getToken } = useAuth()
  const dispatch = useDispatch()

  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [user, setUser] = useState(null)
  const scrollContainerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const scrollRafRef = useRef(null)

  const connections = useSelector((state) => state.connections.connections)

  const fetchUserMessages = useCallback(async () => {
    try {
      const token = await getToken();
      dispatch(fetchMessages({ token, userId }))
    } catch (error) {
      toast.error(error?.message || 'Failed to load messages')
    }
  }, [dispatch, getToken, userId])



  const sendMessage = async () => {
    try {
      if (!text && !image) {
        return
      }
      const token = await getToken();
      const formData = new FormData();
      formData.append('to_user_id', userId)
      formData.append('text', text)

      image && formData.append('image', image);

      const { data } = await api.post('/api/message/send', formData, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (data.success) {
        setText('')
        setImage(null)
        dispatch(addMessage(data.message))
      } else {
        throw new Error(data.message)
      }

    } catch (error) {
      toast.error(error.message)
    }
  }

  useEffect(() => {
    fetchUserMessages()

    return () => {
      dispatch(resetMessages())
    }
  }, [dispatch, fetchUserMessages])

  useEffect(() => {
    if (connections.length > 0) {
      const user = connections.find(connection => connection._id === userId)
      setUser(user)
    }
  }, [connections, userId])



  useEffect(() => {
    if (!isNearBottom) return
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' })
  }, [isNearBottom, messages])

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  }, [messages])

  const imagePreviewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [])


  return user && (
    <div className='flex flex-col h-dvh max-h-dvh bg-slate-50'>
      <div className='shrink-0 flex items-center gap-2 py-2 pl-14 pr-3 sm:px-3 md:px-8 bg-linear-to-b from-indigo-50 to-purple-50 border-b border-gray-200'>
        <img src={user.profile_picture} alt="" className='size-9 rounded-full' />
        <div>
          <p className='font-medium'>{user.full_name}</p>
          <p className='text-sm text-gray-500 -mt-1.5'>@{user.username}</p>
        </div>
      </div>
      <div
        ref={scrollContainerRef}
        onScroll={() => {
          if (scrollRafRef.current) return
          scrollRafRef.current = requestAnimationFrame(() => {
            scrollRafRef.current = null
            const el = scrollContainerRef.current
            if (!el) return
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
            const nextNearBottom = distanceFromBottom < 64
            setIsNearBottom((prev) => (prev === nextNearBottom ? prev : nextNearBottom))
          })
        }}
        className='flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 md:px-8'
      >
        <div className='space-y-3 max-w-4xl mx-auto'>
          {
            sortedMessages.map((message, index) => (
              <div key={index} className={`flex flex-col ${message.to_user_id !== user._id ? 'items-start' : 'items-end'}`}>
                <div className={`px-3 py-2 text-sm max-w-[85%] sm:max-w-sm md:max-w-md bg-white text-slate-700 rounded-2xl shadow-sm border border-black/5 break-words whitespace-pre-wrap ${message.to_user_id !== user._id ? 'rounded-bl-md' : 'rounded-br-md'}`}>
                  {message.message_type === 'image' && <img src={message.media_url} className='w-full max-w-sm rounded-lg mb-1' alt="" />}
                  <p>{message.text}</p>
                </div>
              </div>
            ))
          }
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className='shrink-0 sticky bottom-0 left-0 right-0 bg-slate-50/90 backdrop-blur supports-[backdrop-filter]:bg-slate-50/70 pb-[env(safe-area-inset-bottom)]'>
        <div className='px-3 pt-2 pb-3 md:px-8'>
          <div className='flex items-center gap-3 pl-4 pr-2 py-2 bg-white w-full max-w-xl mx-auto border border-gray-200 shadow-sm rounded-full'>
            <input
              type="text"
              className='flex-1 outline-none text-slate-700 bg-transparent min-w-0'
              placeholder='Type a message...'
              inputMode='text'
              autoComplete='off'
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              onChange={(e) => setText(e.target.value)}
              value={text}
            />
            <label htmlFor="image" className='shrink-0 cursor-pointer touch-manipulation'>
              {
                imagePreviewUrl ?
                  <img src={imagePreviewUrl} alt="Selected" className='h-8 w-8 rounded object-cover' /> :
                  <ImageIcon className='size-6 text-gray-400' />
              }
              <input type="file" id='image' accept='image/*' hidden onChange={(e) => setImage(e.target.files?.[0] || null)} />
            </label>
            <button
              type='button'
              onClick={sendMessage}
              className='shrink-0 bg-linear-to-br from-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-800 active:scale-95 cursor-pointer text-white h-9 w-9 rounded-full flex items-center justify-center transition will-change-transform touch-manipulation'
              aria-label='Send message'
            >
              <SendHorizonal size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatBox
