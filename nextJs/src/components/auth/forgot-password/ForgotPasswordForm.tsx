'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from '../AuthForm.module.css';

interface ForgotPasswordFormProps {
  onSwitchView?: () => void;
}

export default function ForgotPasswordForm({ onSwitchView }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage('Por favor, informe o seu e-mail.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login?mode=reset-password`,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage('E-mail de recuperação enviado com sucesso! Verifique a sua caixa de entrada.');
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleReset();
    }
  };

  return (
    <div className={styles.loginBox}>
      <div className={styles.wrapperLogo}>
        <img src="/assets/logo.svg" alt="Logo" width={100} />
      </div>

      <h2 className={styles.title}>Recuperar Senha</h2>
      <p className={styles.description}>Informe o seu e-mail para enviarmos um link de recuperação.</p>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-mail"
        disabled={loading}
        onKeyDown={handleKeyDown}
      />

      {errorMessage && <span className={styles.error}>{errorMessage}</span>}
      {successMessage && <span style={{ color: '#4ade80' }}>{successMessage}</span>}

      <button onClick={handleReset} disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar Link'}
      </button>

      <div className={styles.links}>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (onSwitchView) onSwitchView();
            else window.location.href = '/login';
          }}
        >
          Lembrou da senha? <span>Voltar ao login</span>
        </a>
      </div>
    </div>
  );
}
