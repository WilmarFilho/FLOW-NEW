'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Save, Shield, Settings, User, UploadCloud, Plug, Trash2, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import styles from './ConfiguracoesPage.module.css';

interface InitialData {
  auth_id: string;
  email: string;
  nome_completo: string;
  foto_perfil: string;
  tipo_de_usuario: string;
  cidade: string;
  endereco: string;
  numero: string;
  mostra_nome_mensagens: boolean;
  notificacao_para_entrar_conversa: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ConfiguracoesPageProps {
  initialData: InitialData;
}

type TabType = 'perfil' | 'sistema' | 'integracoes';

export default function ConfiguracoesPage({ initialData }: ConfiguracoesPageProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('perfil');
  const [isSaving, setIsSaving] = useState(false);

  // Perfil State
  const [nome, setNome] = useState(initialData.nome_completo);
  const [fotoUrl, setFotoUrl] = useState(initialData.foto_perfil);
  const [senha, setSenha] = useState('');
  const [cidade, setCidade] = useState(initialData.cidade);
  const [endereco, setEndereco] = useState(initialData.endereco);
  const [numero, setNumero] = useState(initialData.numero);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sistema State
  const [mostraNomeMensagens, setMostraNomeMensagens] = useState(initialData.mostra_nome_mensagens);
  const [notificacaoEntrarConversa, setNotificacaoEntrarConversa] = useState(initialData.notificacao_para_entrar_conversa);

  // Integrações State
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; email: string | null }>({ connected: false, email: null });
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const err = urlParams.get('error');

    if (success === 'google') {
      toast.success('Autenticação com o Google Calendar concluída com sucesso!');
      setActiveTab('integracoes');
    } else if (err === 'google') {
      toast.error('O Google negou a autorização ou ocorreu um erro.');
      setActiveTab('integracoes');
    }

    fetchGoogleStatus();
  }, [initialData.auth_id]);

  const fetchGoogleStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/google/status`, {
        headers: { 'x-user-id': initialData.auth_id }
      });
      if (res.ok) {
        const data = await res.json();
        setGoogleStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConnectGoogle = async () => {
    setIsLoadingGoogle(true);
    try {
      const res = await fetch(`${API_URL}/google/auth-url`, {
        headers: { 'x-user-id': initialData.auth_id }
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Não foi possível gerar a autorização do Google');
        setIsLoadingGoogle(false);
      }
    } catch {
      toast.error('Erro ao conectar permissão do Google');
      setIsLoadingGoogle(false);
    }
  };

  const handleDisconnectGoogle = () => {
    setShowDisconnectConfirm(true);
  };

  const confirmDisconnectGoogle = async () => {
    setShowDisconnectConfirm(false);
    setIsLoadingGoogle(true);
    try {
      const res = await fetch(`${API_URL}/google/disconnect`, {
        method: 'DELETE',
        headers: { 'x-user-id': initialData.auth_id }
      });
      if (res.ok) {
        toast.success("Integração do Google Calendar desconectada.");
        setGoogleStatus({ connected: false, email: null });
      } else {
        toast.error("Erro ao desconectar a conta");
      }
    } catch {
      toast.error("Erro na requisição.");
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleSavePerfil = async () => {
    setIsSaving(true);

    try {
      if (senha) {
        const { error: passError } = await supabase.auth.updateUser({ password: senha });
        if (passError) throw passError;
      }

      const response = await fetch(`${API_URL}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': initialData.auth_id
        },
        body: JSON.stringify({
          nome_completo: nome,
          cidade,
          endereco,
          numero
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar perfil');
      }

      router.refresh();
      setSenha('');
      toast.success('Perfil atualizado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar o perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      setIsUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/profile/avatar`, {
        method: 'POST',
        headers: {
          'x-user-id': initialData.auth_id
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar foto de perfil');
      }

      const { foto_perfil } = await response.json();
      setFotoUrl(foto_perfil);

      router.refresh();
      toast.success('Foto de perfil atualizada!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao fazer upload da foto. O bucket avatars existe?');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Configurações</h1>
          <p>Gerencie seu perfil e as preferências da plataforma FLOW</p>
        </div>
      </div>

      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabButton} ${activeTab === 'perfil' ? styles.active : ''}`}
          onClick={() => handleTabChange('perfil')}
        >
          <User size={18} />
          Meu Perfil
          {activeTab === 'perfil' && <motion.div layoutId="tabIndicator_config" className={styles.tabIndicator} />}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'sistema' ? styles.active : ''}`}
          onClick={() => handleTabChange('sistema')}
        >
          <Settings size={18} />
          Sistema
          {activeTab === 'sistema' && <motion.div layoutId="tabIndicator_config" className={styles.tabIndicator} />}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'integracoes' ? styles.active : ''}`}
          onClick={() => handleTabChange('integracoes')}
        >
          <Plug size={18} />
          Integrações
          {activeTab === 'integracoes' && <motion.div layoutId="tabIndicator_config" className={styles.tabIndicator} />}
        </button>
      </div>

      <div className={styles.contentArea}>
        <AnimatePresence mode="wait">
          {activeTab === 'perfil' && (
            <motion.div
              key="perfil"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={styles.tabPanel}
            >
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Dados da Conta</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>E-mail de Login <Shield size={12} style={{ marginLeft: 4, display: 'inline' }} /></label>
                    <input
                      type="email"
                      className={`${styles.input} ${styles.readOnly}`}
                      value={initialData.email}
                      disabled
                      title="E-mail gerido via provedor de autenticação"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Tipo de Conta <Shield size={12} style={{ marginLeft: 4, display: 'inline' }} /></label>
                    <input
                      type="text"
                      className={`${styles.input} ${styles.readOnly}`}
                      value={initialData.tipo_de_usuario.toUpperCase()}
                      disabled
                    />
                  </div>
                </div>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Informações Pessoais</h3>

                <div className={styles.avatarSection}>
                  <div
                    className={styles.avatarWrapper}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {fotoUrl ? (
                      <img src={fotoUrl} alt="Avatar" className={styles.avatarImage} />
                    ) : (
                      <div className={styles.avatarFallback}>
                        {nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={styles.avatarOverlay}>
                      <Camera size={24} />
                    </div>
                  </div>

                  <div className={styles.avatarActions}>
                    <input
                      type="file"
                      accept="image/*"
                      className={styles.hiddenFileInput}
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      disabled={isUploading}
                    />
                    <button
                      className={styles.uploadBtn}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || isSaving}
                    >
                      {isUploading ? 'Enviando...' : (
                        <>
                          <UploadCloud size={16} />
                          Alterar Foto de Perfil
                        </>
                      )}
                    </button>
                    <p>Ao inserir, a imagem será salva automaticamente. (Recomendado JPG, PNG, GIF. Máx 2MB)</p>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Nome Completo</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Identificação principal"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Nova Senha</label>
                    <input
                      type="password"
                      className={styles.input}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Deixe em branco para manter a atual"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Endereço</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Ex: Rua Direita"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Número</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="Ex: 50"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Cidade</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Ex: São Paulo"
                    />
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button
                    className={styles.saveBtn}
                    onClick={handleSavePerfil}
                    disabled={isSaving || isUploading}
                  >
                    <Save size={18} />
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'sistema' && (
            <motion.div
              key="sistema"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={styles.tabPanel}
            >


              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Mensagens do WhatsApp</h3>

                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h4>Mostrar meu nome nas mensagens</h4>
                    <p>Exibe seu nome atrelado a sua conta abaixo de cada envio na caixa do WhatsApp pelo painel.</p>
                  </div>
                  <div
                    className={`${styles.toggleSwitch} ${mostraNomeMensagens ? styles.active : ''}`}
                    onClick={() => setMostraNomeMensagens(!mostraNomeMensagens)}
                  >
                    <div className={styles.toggleKnob} />
                  </div>
                </div>

                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h4>Aviso automático ao atender</h4>
                    <p>Envia uma mensagem automática informando que você assumiu o atendimento da conversa.</p>
                  </div>
                  <div
                    className={`${styles.toggleSwitch} ${notificacaoEntrarConversa ? styles.active : ''}`}
                    onClick={() => setNotificacaoEntrarConversa(!notificacaoEntrarConversa)}
                  >
                    <div className={styles.toggleKnob} />
                  </div>
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  className={styles.saveBtn}
                  onClick={async () => {
                    setIsSaving(true);
                    try {
                      const response = await fetch(`${API_URL}/profile`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-user-id': initialData.auth_id
                        },
                        body: JSON.stringify({
                          mostra_nome_mensagens: mostraNomeMensagens,
                          notificacao_para_entrar_conversa: notificacaoEntrarConversa
                        })
                      });

                      if (!response.ok) {
                        throw new Error('Falha ao atualizar configurações');
                      }

                      router.refresh();
                      toast.success('Configurações de sistema salvas!');
                    } catch (err) {
                      console.error(err);
                      toast.error('Erro ao salvar preferências.');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving}
                >
                  <Save size={18} />
                  {isSaving ? 'Salvando...' : 'Salvar Preferências'}
                </button>
              </div>

            </motion.div>
          )}

          {activeTab === 'integracoes' && (
            <motion.div
              key="integracoes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={styles.tabPanel}
            >
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Conexões Externas</h3>

                <div className={styles.settingItem} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                  <div className={styles.settingInfo}>
                    <h4>Google Calendar</h4>
                    <p>Conecte sua conta do Google para sincronizar os agendamentos da plataforma diretamente com sua agenda profissional.</p>
                  </div>

                  {googleStatus?.connected ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ display: 'block', color: '#F2E416', fontWeight: 600, marginBottom: '0.25rem' }}>Conectado</span>
                        <span style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>Vinculado a: <strong>{googleStatus.email}</strong></span>
                      </div>
                      <button
                        onClick={handleDisconnectGoogle}
                        disabled={isLoadingGoogle}
                        style={{ padding: '0.5rem 1rem', background: 'rgba(239, 68, 68, 0.8)', color: '#FFF', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                      >
                        {isLoadingGoogle ? 'Aguarde...' : 'Desconectar'}
                      </button>
                    </div>
                  ) : (
                    <button
                      className={styles.saveBtn}
                      onClick={handleConnectGoogle}
                      disabled={isLoadingGoogle}
                      style={{ background: '#fff', color: '#09090b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      {isLoadingGoogle ? 'Redirecionando...' : 'Conectar com Google'}
                    </button>
                  )}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showDisconnectConfirm && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(10px)',
              padding: '1.5rem'
            }}
          >
            <motion.div
              style={{
                width: '100%', maxWidth: '420px',
                background: 'var(--gradient-surface)',
                border: `1px solid var(--color-border)`,
                borderRadius: '28px', overflow: 'hidden',
                boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.6)',
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', margin: '0 auto 20px auto' }}>
                  <AlertTriangle size={32} />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '12px', letterSpacing: '-0.02em' }}>Desconectar Google?</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', marginBottom: '32px', lineHeight: 1.6, textWrap: 'balance' }}>
                  Ao desconectar, seus agendamentos no FLOW não serão mais sincronizados com sua agenda do Google.
                  Você poderá reconectar a qualquer momento.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setShowDisconnectConfirm(false)}
                    style={{
                      flex: 1, padding: '14px', borderRadius: '16px', fontWeight: 600, border: '1px solid var(--color-border)',
                      background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer'
                    }}
                  >
                    Manter Conexão
                  </button>
                  <button
                    onClick={confirmDisconnectGoogle}
                    style={{
                      flex: 1, padding: '14px', borderRadius: '16px', fontWeight: 700, border: 'none',
                      background: '#ef4444', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    Sim, Desconectar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

