'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from '../AuthForm.module.css';

interface ResetPasswordFormProps {
  onSwitchView?: () => void;
}

export default function ResetPasswordForm({ onSwitchView }: ResetPasswordFormProps) {
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tipoUsuario, setTipoUsuario] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profile').select('tipo_de_usuario').eq('auth_id', user.id).single()
          .then(({ data }) => {
            if (data?.tipo_de_usuario === 'atendente') {
              setTipoUsuario('atendente');
              setErrorMessage('Somente seu administrador pode alterar sua senha.');
            }
          });
      }
    });
  }, []);

  // If we are doing implicit flow with hash fragment, we can just update user password:
  const handleUpdatePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (tipoUsuario === 'atendente') return;
    
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!senha.trim() || !confirmarSenha.trim()) {
      setErrorMessage('Por favor, preencha todos os campos.');
      return;
    }

    if (senha !== confirmarSenha) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: senha
    });

    if (error) {
       setErrorMessage(error.message);
    } else {
       setSuccessMessage('Senha atualizada com sucesso! Você já pode acessar a plataforma.');
       setTimeout(() => {
         if (onSwitchView) onSwitchView();
         else window.location.href = '/login';
       }, 2000);
    }
    
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleUpdatePassword();
    }
  };

  return (
    <div className={styles.loginBox}>
      <div className={styles.wrapperLogo}>
        <img src="/assets/logo.svg" alt="Logo" width={100} />
      </div>

      <h2>Definir Nova Senha</h2>

      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Nova Senha"
        disabled={loading || tipoUsuario === 'atendente'}
        onKeyDown={handleKeyDown}
      />
      <input
        type="password"
        value={confirmarSenha}
        onChange={(e) => setConfirmarSenha(e.target.value)}
        placeholder="Confirmar Nova Senha"
        disabled={loading || tipoUsuario === 'atendente'}
        onKeyDown={handleKeyDown}
      />

      {errorMessage && <span className={styles.error}>{errorMessage}</span>}
      {successMessage && <span style={{ color: '#4ade80' }}>{successMessage}</span>}

      <button onClick={handleUpdatePassword} disabled={loading}>
        {loading ? 'Atualizando...' : 'Salvar Nova Senha'}
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
