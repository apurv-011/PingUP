import React from 'react'
import { X } from 'lucide-react'

const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  tone = 'danger',
  children,
}) => {
  if (!open) return null

  const accentClass =
    tone === 'danger'
      ? 'from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700'
      : 'from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4'>
      <div className='w-full max-w-md rounded-2xl bg-white shadow-2xl border border-black/10 overflow-hidden'>
        <div className='flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-200'>
          <div>
            <h3 className='text-lg font-semibold text-slate-900'>{title}</h3>
            <p className='text-sm text-slate-600 mt-1'>{description}</p>
          </div>
          <button
            type='button'
            onClick={onCancel}
            className='h-9 w-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600'
            aria-label='Close dialog'
          >
            <X className='h-4 w-4' />
          </button>
        </div>
        {children && <div className='px-5 pt-4'>{children}</div>}
        <div className='flex items-center justify-end gap-3 px-5 py-4 bg-slate-50'>
          <button
            type='button'
            onClick={onCancel}
            className='h-10 px-4 rounded-lg bg-white border border-gray-200 text-slate-700 hover:bg-slate-50'
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type='button'
            onClick={onConfirm}
            disabled={loading}
            className={[
              'h-10 px-4 rounded-lg text-white bg-linear-to-r transition',
              accentClass,
              loading ? 'opacity-70 cursor-wait' : 'active:scale-95',
            ].join(' ')}
          >
            {loading ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
