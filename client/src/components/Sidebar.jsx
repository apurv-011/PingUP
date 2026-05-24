import { assets } from '../assets/assets'
import { Link, useNavigate } from 'react-router-dom'
import MenuItems from './MenuItems'
import { CirclePlus, LogOut } from 'lucide-react'
import { UserButton, useClerk } from '@clerk/react'
import { useSelector } from 'react-redux'

const Sidebar = ({ sideBarOpen, setSideBarOpen }) => {

    const navigate = useNavigate()
    const user = useSelector((state) => state.user.value)
    const { signOut } = useClerk()

    return (
        <div
            className={[
                'w-56 bg-white border-r border-gray-200 flex flex-col justify-between items-center',
                'sm:static sm:translate-x-0',
                'max-sm:fixed max-sm:left-0 max-sm:top-0 max-sm:bottom-0 max-sm:z-50',
                'transition-transform duration-300 ease-out',
                sideBarOpen ? 'max-sm:translate-x-0' : 'max-sm:-translate-x-full',
            ].join(' ')}
        >
            <div className='w-full'>
                <img onClick={() => navigate('/')} src={assets.logo} className='w-20 ml-4 my-2 cursor-pointer' alt="" />
                <hr className='border-gray-300 mb-4' />
                <MenuItems setSideBarOpen={setSideBarOpen} />
                <Link to='/create-post' className='flex items-center justify-center gap-2 py-2.5 mt-4 mx-4 rounded-lg bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-800 active:scale-95 transition text-white cursor-pointer'>
                    <CirclePlus className='w-3 h-3' />
                    Create Post
                </Link>
            </div>

            <div className='w-full border-t border-gray-200 p-2 px-4 flex items-center justify-between'>
                <div className='flex gap-2 items-center cursor-pointer'>
                    <UserButton />
                    <div>
                        <h1 className='text-sm font-medium'>{user?.full_name}</h1>
                        <p className='text-xs text-gray-500'>@{user?.username}</p>
                    </div>
                </div>
                <LogOut onClick={signOut} className='w-3.5 text-gray-400 hover:text-gray-700 transition cursor-pointer' />
            </div>
        </div>
    )
}

export default Sidebar
