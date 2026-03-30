import React from 'react';
// CSS Modules
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'primary' | 'secondary'; 
}

export default function Button({
  label,
  variant = 'primary',
  onClick,
  ...rest
}: ButtonProps) {
  
  const buttonClasses = `${styles.button} ${styles[variant]}`;

  return (
    <button
      onClick={onClick}
      className={buttonClasses}
      {...rest} 
    >
      {label}
    </button>
  );
}