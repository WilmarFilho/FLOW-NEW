'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from '../AuthForm.module.css';

interface RegisterFormProps {
  onSwitchView?: () => void;
  onSuccess?: () => void;
}

export default function RegisterForm({ onSwitchView, onSuccess }: RegisterFormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Step 2
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');

  const handleNextStep = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !senha.trim() || !confirmarSenha.trim()) {
      setErrorMessage('Por favor, preencha todos os campos.');
      return;
    }

    if (senha !== confirmarSenha) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    setStep(2);
  };

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!nome.trim() || !cidade.trim() || !endereco.trim()) {
      setErrorMessage('Por favor, preencha os dados obrigatórios do perfil.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          nome_completo: nome,
          cidade,
          endereco,
          numero
        }
      }
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      if (onSuccess) onSuccess();
      else window.location.href = '/login?mode=confirm-email';
    }

    setLoading(false);
  };

  const handleKeyDownStep1 = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNextStep();
    }
  };

  const handleKeyDownStep2 = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRegister();
    }
  };

  return (
    <div className={styles.loginBox}>
      <div className={styles.wrapperLogo}>
        <img src="/assets/logo.svg" alt="Logo" width={100} />
      </div>

      <h2 className={styles.title}>Criar Conta</h2>

      {step === 1 && (
        <>
          <p className={styles.description}>Precisamos de algumas informações para começar.</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            disabled={loading}
            onKeyDown={handleKeyDownStep1}
          />
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            disabled={loading}
            onKeyDown={handleKeyDownStep1}
          />
          <input
            type="password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            placeholder="Confirmar Senha"
            disabled={loading}
            onKeyDown={handleKeyDownStep1}
          />

          {errorMessage && <span className={styles.error}>{errorMessage}</span>}

          <button onClick={handleNextStep} disabled={loading} style={{ marginTop: '10px' }}>
            Continuar
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <p className={styles.description}>Quase lá! Fale um pouco sobre você.</p>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome Completo *"
            disabled={loading}
            onKeyDown={handleKeyDownStep2}
          />

          <input
            type="text"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Cidade *"
            disabled={loading}
            onKeyDown={handleKeyDownStep2}
          />

          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <input
              style={{ flex: 3 }}
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Endereço *"
              disabled={loading}
              onKeyDown={handleKeyDownStep2}
            />
            <input
              style={{ flex: 1 }}
              type="text"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Nº"
              disabled={loading}
              onKeyDown={handleKeyDownStep2}
            />
          </div>

          {errorMessage && <span className={styles.error}>{errorMessage}</span>}

          <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '10px' }}>
            <button onClick={() => { setErrorMessage(null); setStep(1); }} disabled={loading} style={{ background: 'transparent', border: '1px solid #333' }}>
              Voltar
            </button>
            <button onClick={handleRegister} disabled={loading}>
              {loading ? 'Criando conta...' : 'Finalizar Registro'}
            </button>
          </div>
        </>
      )}

      <div className={styles.links} style={{ marginTop: '20px' }}>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (onSwitchView) onSwitchView();
            else window.location.href = '/login';
          }}
        >
          Já possui uma conta? <br /> <span>Fazer Login</span>
        </a>
      </div>
    </div>
  );
}
