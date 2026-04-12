'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from '../AuthForm.module.css';

interface LoginFormProps {
  onSwitchView?: (view?: any) => void;
  onForgot?: () => void;
}

export default function LoginForm({ onSwitchView, onForgot }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !senha.trim()) {
      setErrorMessage('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      // redirect or set user globally
      window.location.href = '/home';
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className={styles.loginBox}>
      <div className={styles.wrapperLogo}>
        <img src="/assets/logo.svg" alt="Logo" width={100} />
      </div>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-mail"
        disabled={loading}
        onKeyDown={handleKeyDown}
      />
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha"
        disabled={loading}
        onKeyDown={handleKeyDown}
      />

      {errorMessage && <span className={styles.error}>{errorMessage}</span>}

      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>

      <div className={styles.divider}>ou</div>

      <button onClick={handleGoogleLogin} disabled={loading} className={styles.socialBtn}>
        <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/24/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          <path d="M1 1h22v22H1z" fill="none" />
        </svg>
        Entrar com Google
      </button>

      <div className={styles.links}>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (onForgot) onForgot();
            else window.location.href = '/login?mode=forgot-password';
          }}
        >
          Esqueci minha senha
        </a>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (onSwitchView) onSwitchView();
            else window.location.href = '/register';
          }}
        >
          Ainda não possui conta? <br /> <span>Criar conta</span>
        </a>
      </div>
    </div>
  );
}
