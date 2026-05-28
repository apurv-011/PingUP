import React from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

const Notification = ({ t, message }) => {

    const navigate = useNavigate()
    const sender = message?.from_user_id || {}
    const preview = message?.text ? message.text.slice(0, 50) : 'Sent you a message'

    return (
        <div className='max-w-md w-full bg-white shadow-lg rounded-lg flex border border-gray-300 hover:scale-105 transition'>
            <div className='flex-1 p-4'>
                <div className='flex items-start'>
                    <img src={sender.profile_picture} alt="" className='h-10 w-10 rounded-full shrink-0 mt-0.5' />
                    <div className='ml-3 flex-1'>
                        <p className='text-sm font-medium text-gray-900'>
                            {sender.full_name || 'New message'}</p>
                        <p className='text-sm text-gray-500'>{preview}</p>
                    </div>
                </div>
            </div>


            <div className='flex border border-gray-200'>
                <button onClick={() => {
                    navigate(`/messages/${sender._id}`)
                    toast.dismiss(t.id)
                }} className='p-4 text-indigo-400 font-semibold'>Reply</button>
            </div>

        </div>
    )
}

export default Notification
