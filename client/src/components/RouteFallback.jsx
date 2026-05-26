import React from 'react'

const RouteFallback = ({ variant = 'page' }) => {
  if (variant === 'outlet') {
    return (
      <div className='p-4 md:p-6'>
        <div className='mx-auto max-w-4xl'>
          <div className='h-7 w-40 rounded bg-slate-200/70 animate-pulse mb-4' />
          <div className='space-y-3'>
            <div className='h-24 rounded-xl bg-white shadow-sm border border-black/5 animate-pulse' />
            <div className='h-24 rounded-xl bg-white shadow-sm border border-black/5 animate-pulse' />
            <div className='h-24 rounded-xl bg-white shadow-sm border border-black/5 animate-pulse' />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-dvh bg-slate-50 flex items-center justify-center p-6'>
      <div className='w-full max-w-sm'>
        <div className='h-10 w-10 rounded-xl bg-indigo-200 animate-pulse mb-4' />
        <div className='h-5 w-40 rounded bg-slate-200/70 animate-pulse mb-2' />
        <div className='h-4 w-64 rounded bg-slate-200/70 animate-pulse mb-6' />
        <div className='h-24 rounded-2xl bg-white shadow-sm border border-black/5 animate-pulse' />
      </div>
    </div>
  )
}

export default RouteFallback

