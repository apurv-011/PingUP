import React from 'react'
import { dummyUserData } from '../assets/assets'
import { MapPin, MessageCircle, Plus, UserPlus } from 'lucide-react';

const UserCard = ({ user }) => {

    const currentUser = dummyUserData;

    const handleFollow = async () => {

    }

    const handleConnectionRequest = async () => {

    }

    return (
        <div key={user._id} className='p-3 pt-4 flex flex-col justify-between shadow w-64 border border-gray-200 rounded-md'>
            <div className='text-center'>
                <img src={user.profile_picture} alt="" className='rounded-full w-12 shadow-md mx-auto' />
                <p className='mt-3 font-semibold'>{user.full_name}</p>
                {user.username && <p className='text-gray-500 font-light'>@{user.username}</p>}
                {user.bio && <p className='text-gray-600 mt-2 text-center text-sm px-3'>{user.bio}</p>}
            </div>
            <div className='flex items-center justify-center gap-2 mt-2 text-xs text-gray-600'>
                <div className='flex items-center gap-1 border border-gray-300 rounded-full px-3 py-1'>
                    <MapPin className='w-4 h-4' />{user.location}
                </div>
                <div className='flex items-center gap-1 border border-gray-300 rounded-full px-3 py-1'>
                    <span>{user.followers.length}</span> Followers
                </div>
            </div>

            <div className='flex mt-2 gap-2'>
                {/* Follow Button */}
                <button onClick={handleFollow} disabled={currentUser?.following.includes(user._id)} className='w-full py-2 rounded-md flex justify-center items-center gap-2 bg-linear-to-r from from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-95 transition text-white cursor-pointer'>
                    <UserPlus className='w-4 h-4' />{currentUser?.following.includes(user._id) ? "Following" : "Follow"}
                </button>

                {/* Connection Request button / Message button */}
                <button onClick={handleConnectionRequest} className='flex items-center justify-center w-12 border text-slate-500 group rounded-md cursor-pointer active:scale-95 transition'>
                    {
                        currentUser?.connections.includes(user._id) ? <MessageCircle className='w-5 h-5 group-hover:scale-105 transition' /> : <Plus className='w-5 h-5 group-hover:scale-105 transition' />
                    }
                </button>

            </div>
        </div>
    )
}

export default UserCard