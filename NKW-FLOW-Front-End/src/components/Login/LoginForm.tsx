import { useState } from 'react';
import { useAuth } from '../../hooks/auth/useAuth';
import styles from './LoginForm.module.css';
import Icon from '../../components/Gerais/Icons/Icons';

interface ApiError {
  response?: {
    status?: number;
  };
  message?: string;
}

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();

  const handleLogin = async () => {
    setErrorMessage(null);

    // Valida campos
    if (!email.trim() || !senha.trim()) {
      setErrorMessage('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);

    try {
      await login(email, senha);
    } catch (err: unknown) {
      // Refinamento de tipo seguro
      const apiError = err as ApiError;

      if (apiError.response?.status === 401) {
        setErrorMessage('E-mail ou senha incorretos.');
      } else if (apiError.message) {
        setErrorMessage(apiError.message);
      } else {
        setErrorMessage('Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Permite submit com Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className={styles.loginBox}>
      <div className={styles.wrapperLogo}>
        <Icon nome="logo" />
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
    </div>
  );
}