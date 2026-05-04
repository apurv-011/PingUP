import React from 'react'
import { assets } from '../assets/assets'
import { Star } from 'lucide-react'
import { SignIn } from '@clerk/react'

const Login = () => {
    return (
        <div className='min-h-screen flex flex-col md:flex-row'>
            {/* Background Image */}
            <img src={assets.bgImage} alt="" className='absolute top-0 left-0 -z-1 w-full h-full object-cover' />
            {/* Left Side : Branding*/}
            <div className='flex-1 flex flex-col items-start justify-between p-4 md:p-8 lg:pl-32'>
                <img src={assets.logo} alt="" className='h-8 object-contain' />
                <div>
                    <div className='flex items-center gap-3 mb-4 max-md:mt-8'>
                        <img src={assets.group_users} alt="" className='h-4 md:h-8' />
                        <div>
                            <div className='flex'>
                                {Array(5).fill(0).map((_, i) => (<Star key={i} className='size-3 md:size-3.5 text-transparent fill-amber-500' />))}
                            </div>
                            <p>Used by 12k+ developers</p>
                        </div>
                    </div>
                    <h1 className='text-2xl md:text-4xl md:pb-2 font-bold bg-linear-to-r from-indigo-950 to-indigo-800 bg-clip-text text-transparent'>More than just friends truly connect</h1>
                    <p className='text-xl md:text-2xl text-indigo-900 max-w-62 md:max-w-md'>Connect with global community on PingUP</p>
                </div>
                <span className='md:h-8'></span>
            </div>
            {/* Right Side : Login Form */}
            <div className='flex-1 flex items-center justify-center p-4 sm:p-8 min-h-'>
                <SignIn app  />
            </div>
        </div>
    )
}

export default Login