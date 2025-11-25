import React from 'react';

interface RetroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger';
}

export const RetroButton: React.FC<RetroButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseStyles = "relative px-6 py-2 font-mono uppercase tracking-wider font-bold transition-transform active:translate-y-1 active:shadow-none border-b-4 border-r-4 rounded-lg";
  
  const variants = {
    primary: "bg-amber-600 text-amber-50 border-amber-800 hover:bg-amber-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]",
    danger: "bg-red-700 text-red-50 border-red-900 hover:bg-red-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};