'use client';

import { useState } from 'react';
import LoginForm from './login/LoginForm';
import RegisterForm from './register/RegisterForm';
import ForgotPasswordForm from './forgot-password/ForgotPasswordForm';
import ResetPasswordForm from './reset-password/ResetPasswordForm';
import ConfirmEmailForm from './confirm-email/ConfirmEmailForm';
import styles from './AuthForm.module.css';

interface AuthContainerProps {
  initialView?: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'confirm-email';
}

export default function AuthContainer({ initialView = 'login' }: AuthContainerProps) {
  const [view, setView] = useState<'login' | 'register' | 'forgot-password' | 'reset-password' | 'confirm-email'>(initialView);

  const renderView = () => {
    switch (view) {
      case 'register':
        return <RegisterForm onSwitchView={() => setView('login')} onSuccess={() => setView('confirm-email')} />;
      case 'forgot-password':
        return <ForgotPasswordForm onSwitchView={() => setView('login')} />;
      case 'reset-password':
        return <ResetPasswordForm onSwitchView={() => setView('login')} />;
      case 'confirm-email':
        return <ConfirmEmailForm onSwitchView={() => setView('login')} />;
      case 'login':
      default:
        return (
          <LoginForm
            onSwitchView={(newView) => setView(newView || 'register')}
            onForgot={() => setView('forgot-password')}
          />
        );
    }
  };

  return (
    <div key={view} className={styles.cardContainer}>
      {renderView()}
    </div>
  );
}
