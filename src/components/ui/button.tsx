'use client'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary'
  className?: string
}

export function Button({ children, onClick, variant = 'primary', className = '' }: ButtonProps) {
  const baseClass = variant === 'primary' ? 'btn-richy' : 'bg-gray-800 text-white'
  return (
    <button 
      onClick={onClick}
      className={`${baseClass} ${className}`}
    >
      {children}
    </button>
  )
}