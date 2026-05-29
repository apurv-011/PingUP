/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useState } from 'react'
import { assets } from '../assets/assets'
import Loading from '../components/Loading'
import StoriesBar from '../components/StoriesBar'
import PostCard from '../components/PostCard'
import RecentMessages from '../components/RecentMessages'
import DesktopNotificationsPanel from '../components/DesktopNotificationsPanel'
import { useAuth } from '@clerk/react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const Feed = () => {

  const [feeds, setFeeds] = useState([])
  const [loading, setLoading] = useState(true)
  const { getToken } = useAuth()

  const fetchFeeds = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/api/post/feed', {headers: {Authorization: `Bearer ${await getToken()}`}})
      if(data.success) {
        setFeeds(data.posts)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
    setLoading(false)
  }, [getToken])

  useEffect(() => {
    fetchFeeds()
  }, [fetchFeeds])

  useEffect(() => {
    const handlePostEvent = (event) => {
      const payload = event?.detail
      if (payload?.type !== 'post_deleted' || !payload.postId) return
      setFeeds((current) => current.filter((post) => post._id !== payload.postId))
    }

    window.addEventListener('pingup:post-event', handlePostEvent)
    return () => window.removeEventListener('pingup:post-event', handlePostEvent)
  }, [])


  return !loading ? (
    <div className='h-full overflow-y-scroll no-scrollbar py-8 xl:pr-3 flex items-start justify-center xl:gap-6'>
      {/* Stories and post list */}
      <div>
        <StoriesBar />
        <div className='py-2 space-y-4'>
          {feeds.map((post)=>(
            <PostCard key={post._id} post={post} />
          ))}
        </div>
      </div>

      {/* Right sidebar */}

      <div className='max-xl:hidden sticky top-0 w-full max-w-xs'>
        <div className='max-w-xs bg-white text-xs p-2 rounded-md inline-flex flex-col gap-2 shadow'>
          <h3 className='text-slate-800 font-semibold'>Sponsored</h3>
          <img src={assets.sponsored_img} className='w-65 h-40 rounded-md' alt="" />
          <p className='text-slate-600'>Email Marketing</p>
          <p className='text-slate-400'>Supercharge your marketing with a powerful, easy-to-use platform built for results.</p>
        </div>
        <div className='grid grid-cols-2 gap-3 items-start'>
          <RecentMessages />
          <DesktopNotificationsPanel />
        </div>
      </div>

    </div>
  ) : <Loading />
}

export default Feed
