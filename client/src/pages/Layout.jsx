import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Loading from '../components/Loading'
import { useSelector } from 'react-redux'

const Layout = () => {

    const user = useSelector((state)=>state.user.value)

    const [sideBarOpen, setSideBarOpen] = useState(false)
    return user ? (
        <div className='w-full flex h-screen'>

            <Sidebar sideBarOpen={sideBarOpen} setSideBarOpen={setSideBarOpen} />

            <div className='flex-1 bg-slate-50'>
                <Outlet />
            </div>
            {
                sideBarOpen ?
                    <X className='absolute top-2 right-2 p-2 z-100 bg-white rounded-md shadow w-8 h-8 text-gray-600 sm:hidden' onClick={() => setSideBarOpen(false)} />
                    :
                    <Menu className='absolute top-2 right-2 p-2 z-100 bg-white rounded-md shadow w-8 h-8 text-gray-600 sm:hidden' onClick={() => setSideBarOpen(true)} />
            }
        </div>
    ) : (
        <Loading />
    )
}

export default Layout