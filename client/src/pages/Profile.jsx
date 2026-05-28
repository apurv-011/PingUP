/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Loading from '../components/Loading'
import UserProfileInfo from '../components/UserProfileInfo'
import PostCard from '../components/PostCard'
import moment from 'moment'
import ProfileModel from '../components/ProfileModel'
import { useAuth } from '@clerk/react'
import api from '../api/axios.js'
import { toast } from 'react-hot-toast'
import { useSelector } from 'react-redux'
import ConfirmDialog from '../components/ConfirmDialog'

const PROFILE_PAGE_SIZE = 12

const hasMedia = (post) => {
  if (Array.isArray(post?.image_assets) && post.image_assets.length > 0) return true
  if (Array.isArray(post?.media_urls) && post.media_urls.length > 0) return true
  if (Array.isArray(post?.image_urls) && post.image_urls.length > 0) return true
  return false
}

const Profile = () => {
  const currentUser = useSelector((state) => state.user.value)
  const { getToken } = useAuth()
  const { profileId } = useParams()

  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [activeTab, setActiveTab] = useState('posts')
  const [showEdit, setShowEdit] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pendingDeletePost, setPendingDeletePost] = useState(null)
  const [deletingPostId, setDeletingPostId] = useState(null)
  const loadMoreRef = useRef(null)
  const deleteRollbackRef = useRef(null)

  const profileUserId = profileId || currentUser?._id

  const fetchUser = useCallback(
    async (profileIdToFetch, pageToFetch = 1, replace = true) => {
      if (!profileIdToFetch) return

      const token = await getToken()
      try {
        const response = await api.post(
          '/api/user/profiles',
          {
            profileId: profileIdToFetch,
            page: pageToFetch,
            limit: PROFILE_PAGE_SIZE,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )

        if (response.data.success) {
          setUser(response.data.profile)
          setHasMore(Boolean(response.data.hasMore))
          setPage(response.data.page || pageToFetch)
          setPosts((prev) => {
            const nextPosts = response.data.posts || []
            if (replace) return nextPosts

            const merged = new Map()
            ;[...prev, ...nextPosts].forEach((post) => {
              if (!merged.has(post._id)) merged.set(post._id, post)
            })
            return Array.from(merged.values())
          })
        } else {
          toast.error(response.data.message)
        }
      } catch (error) {
        toast.error(error.message)
      }
    },
    [getToken],
  )

  useEffect(() => {
    if (!profileUserId) return
    setPosts([])
    setPage(1)
    setHasMore(true)
    fetchUser(profileUserId, 1, true)
  }, [fetchUser, profileUserId])

  useEffect(() => {
    const handlePostEvent = (event) => {
      const payload = event?.detail
      if (payload?.type !== 'post_deleted' || !payload.postId) return
      setPosts((current) => current.filter((post) => post._id !== payload.postId))
    }

    window.addEventListener('pingup:post-event', handlePostEvent)
    return () => window.removeEventListener('pingup:post-event', handlePostEvent)
  }, [])

  useEffect(() => {
    if (activeTab !== 'posts' || !hasMore || loadingMore || !profileUserId) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) return
        setLoadingMore(true)
        fetchUser(profileUserId, page + 1, false).finally(() => setLoadingMore(false))
      },
      { root: null, rootMargin: '200px', threshold: 0.1 },
    )

    const target = loadMoreRef.current
    if (target) observer.observe(target)

    return () => observer.disconnect()
  }, [activeTab, fetchUser, hasMore, loadingMore, page, profileUserId])

  const mediaPosts = useMemo(() => posts.filter(hasMedia), [posts])

  const handleDeletePost = async () => {
    if (!pendingDeletePost) return

    const postId = pendingDeletePost._id
    const snapshot = deleteRollbackRef.current ? [...deleteRollbackRef.current] : [...posts]

    try {
      setDeletingPostId(postId)
      setPosts((current) => current.filter((post) => post._id !== postId))
      setPendingDeletePost(null)

      const token = await getToken()
      const { data } = await api.delete(`/api/post/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!data.success) {
        throw new Error(data.message)
      }

      toast.success(data.message)
      deleteRollbackRef.current = null
    } catch (error) {
      setPosts(snapshot)
      toast.error(error.message)
    } finally {
      setDeletingPostId(null)
      deleteRollbackRef.current = null
    }
  }

  return user ? (
    <div className='relative h-full overflow-y-scroll bg-gray-50 p-4'>
      <div className='max-w-3xl mx-auto'>
        <div className='bg-white rounded-2xl shadow overflow-hidden'>
          <div className='h-32 md:h-44 bg-linear-to-r from-indigo-200 via-purple-200 to-pink-200'>
            {user.cover_photo && <img src={user.cover_photo} alt='' className='w-full h-full object-cover' />}
          </div>
          <UserProfileInfo user={user} posts={posts} profileId={profileId} setShowEdit={setShowEdit} />
        </div>

        <div className='mt-4'>
          <div className='bg-white rounded-xl shadow p-1 flex max-w-md mx-auto'>
            {['posts', 'media', 'likes'].map((tab) => (
              <button
                onClick={() => setActiveTab(tab)}
                key={tab}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'posts' && (
            <div className='mt-3 flex flex-col items-center gap-4'>
              {posts.map((post) => (
                <PostCard
                  post={post}
                  key={post._id}
                  canDelete={String(currentUser?._id || '') === String(user?._id || '')}
                  deleting={deletingPostId === post._id}
                  onDelete={() => {
                    deleteRollbackRef.current = [...posts]
                    setPendingDeletePost(post)
                  }}
                />
              ))}
              {hasMore && <div ref={loadMoreRef} className='h-10 w-full' />}
              {loadingMore && <p className='text-sm text-gray-500'>Loading more posts...</p>}
            </div>
          )}

          {activeTab === 'media' && (
            <div className='flex flex-wrap gap-3 mt-3 max-w-6xl'>
              {mediaPosts.length === 0 ? (
                <p className='text-sm text-gray-500'>No media posts yet.</p>
              ) : (
                mediaPosts.map((post) =>
                  (post.image_assets?.length
                    ? post.image_assets
                    : post.media_urls?.length
                      ? post.media_urls
                      : post.image_urls || []
                  ).map((image, index) => {
                    const src = typeof image === 'string' ? image : image?.url
                    if (!src) return null

                    return (
                      <a href={src} target='_blank' rel='noreferrer' key={`${post._id}-${index}`} className='relative group'>
                        <img src={src} className='w-64 aspect-video object-cover rounded-lg' alt='' />
                        <p className='absolute bottom-0 right-0 text-xs p-1 px-3 backdrop-blur-xl text-white opacity-0 group-hover:opacity-100 transition duration-300'>
                          Posted {moment(post.createdAt).fromNow()}
                        </p>
                      </a>
                    )
                  }),
                )
              )}
            </div>
          )}
        </div>
      </div>
      {showEdit && <ProfileModel setShowEdit={setShowEdit} />}
      <ConfirmDialog
        open={Boolean(pendingDeletePost)}
        title='Delete post?'
        description='Are you sure you want to delete this post? This action cannot be undone.'
        confirmLabel='Delete'
        onCancel={() => setPendingDeletePost(null)}
        onConfirm={handleDeletePost}
        loading={Boolean(deletingPostId)}
      />
    </div>
  ) : (
    <Loading />
  )
}

export default Profile
