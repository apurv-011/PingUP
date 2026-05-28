import React, { useMemo, useState } from 'react'
import { BadgeCheck, Heart, MessageCircle, Share2, Trash2 } from 'lucide-react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useAuth } from '@clerk/react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const escapeHtml = (value = '') =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const PostCard = ({ post, canDelete = false, onDelete = null, deleting = false }) => {
  const author = post?.user || {}
  const content = post?.content || ''
  const media = useMemo(() => {
    if (Array.isArray(post?.image_assets) && post.image_assets.length > 0) {
      return post.image_assets
    }
    if (Array.isArray(post?.media_urls) && post.media_urls.length > 0) {
      return post.media_urls
    }
    if (Array.isArray(post?.image_urls)) {
      return post.image_urls
    }
    return []
  }, [post?.image_assets, post?.image_urls, post?.media_urls])

  const postWithHashTags = escapeHtml(content).replace(/(#\w+)/g, '<span class = "text-indigo-600">$1</span>')
  const [likes, setLikes] = useState(Array.isArray(post?.likes_count) ? post.likes_count : [])
  const currentUser = useSelector((state) => state.user.value)
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const authorId = author._id || post?.user
  const currentUserId = currentUser?._id || ''

  const handleLike = async () => {
    try {
      const { data } = await api.post('/api/post/like', { postId: post._id }, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      })

      if (data.success) {
        toast.success(data.message)
        setLikes((prev) => {
          if (prev.includes(currentUserId)) {
            return prev.filter((id) => id !== currentUserId)
          }
          return [...prev, currentUserId]
        })
      } else {
        toast(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className='relative bg-white rounded-xl shadow p-4 space-y-4 w-full max-w-2xl'>
      {canDelete && onDelete && (
        <button
          type='button'
          onClick={onDelete}
          disabled={deleting}
          className='absolute top-3 right-3 h-9 w-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition disabled:opacity-60 touch-manipulation'
          aria-label='Delete post'
        >
          {deleting ? (
            <span className='h-4 w-4 rounded-full border-2 border-slate-300 border-t-transparent animate-spin' />
          ) : (
            <Trash2 className='h-4 w-4' />
          )}
        </button>
      )}
      <div onClick={() => authorId && navigate('/profile/' + authorId)} className='inline-flex items-center gap-3 cursor-pointer'>
        <img src={author.profile_picture} alt='' className='w-6 h-6 rounded-full shadow' />
        <div>
          <div className='flex items-center space-x-1'>
            <span>{author.full_name}</span>
            <BadgeCheck className='w-4 h-4 text-blue-500' />
          </div>
          <div className='text-gray-500 text-sm'>
            @{author.username} - {moment(post.createdAt).fromNow()}
          </div>
        </div>
      </div>

      {content && (
        <div className='text-gray-800 text-sm whitespace-pre-line' dangerouslySetInnerHTML={{ __html: postWithHashTags }} />
      )}

      {media.length > 0 && (
        <div className='grid grid-cols-2 gap-2'>
          {media.map((image, index) => {
            const src = typeof image === 'string' ? image : image?.url
            if (!src) return null
            return (
              <img
                src={src}
                key={index}
                alt=''
                className={`w-full h-36 object-cover rounded-lg ${media.length === 1 && 'col-span-2 h-auto'}`}
              />
            )
          })}
        </div>
      )}

      <div className='flex items-center gap-4 text-gray-600 text-sm pt-2 border-t border-gray-300'>
        <div className='flex items-center gap-1'>
          <Heart className={`w-4 h-4 cursor-pointer ${currentUserId && likes.includes(currentUserId) && 'text-red-500 fill-red-500'}`} onClick={handleLike} />
          <span>{likes.length}</span>
        </div>
        <div className='flex items-center gap-1'>
          <MessageCircle className='w-4 h-4' />
          <span>{12}</span>
        </div>
        <div className='flex items-center gap-1'>
          <Share2 size={16} />
          <span>{7}</span>
        </div>
      </div>
    </div>
  )
}

export default PostCard
