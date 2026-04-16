'use client';

import { useState, useRef, ChangeEvent, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Save, Shield, Settings, User, UploadCloud, Plug, AlertTriangle, CreditCard, Loader2, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { apiFetch, apiRequest } from '@/lib/api/client';
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
  agendamento_automatico_ia: boolean;
  alerta_atendentes_intervencao_ia: boolean;
  assinante_profile_id: string;
  plano: string;
  mensagens_enviadas: number;
  limite_mensagens_mensais: number;
  contatos_usados_campanhas: number;
  limite_contatos_campanhas: number;
  stripe_customer_id: string | null;
}

interface ConfiguracoesPageProps {
  initialData: InitialData;
}

type TabType = 'perfil' | 'sistema' | 'integracoes' | 'assinatura';

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
  const [agendamentoAutomaticoIa, setAgendamentoAutomaticoIa] = useState(initialData.agendamento_automatico_ia);
  const [alertaAtendentesIntervencaoIa, setAlertaAtendentesIntervencaoIa] = useState(initialData.alerta_atendentes_intervencao_ia);

  // Integrações State
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; email: string | null }>({ connected: false, email: null });
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Assinatura State
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const plans = [
    {
      id: 'prod_TtWwXIpxANb0GU',
      name: 'Iniciante',
      mensal: 400,
      anual: 4000,
      features: ['Até 1.200 mensagens/mês', 'Até 200 contatos em campanhas', 'Suporte Padrão'],
      color: 'from-white-500 to-white-400',
    },
    {
      id: 'prod_TtWx8O8eVpJuAt',
      name: 'Intermediário',
      mensal: 700,
      anual: 7000,
      features: ['Até 1.800 mensagens/mês', 'Até 300 contatos em campanhas', 'Suporte Prioritário'],
      popular: true,
      color: 'from-blue-500 to-blue-400',
    },
    {
      id: 'prod_TtWwDnPoyUyOg2',
      name: 'Avançado',
      mensal: 900,
      anual: 9000,
      features: ['Até 3.000 mensagens/mês', 'Até 500 contatos em campanhas', 'Suporte VIP / Setup Auxiliado'],
      color: 'from-white-500 to-white-400',
    },
  ];

  const handleCheckout = async (productId: string) => {
    setLoadingPlan(productId);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/stripe/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: initialData.auth_id,
          productId,
          interval: 'month',
          origin: window.location.origin,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao gerar sessão de pagamento.');
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      toast.error('Erro ao redirecionar para pagamento: ' + (e as Error).message);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleGerenciarAssinatura = async () => {
    setIsLoadingPortal(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/stripe/customer-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: initialData.assinante_profile_id,
          origin: window.location.origin
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao abrir portal do cliente');
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      toast.error('Erro ao acessar gerenciador de assinaturas.');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const fetchGoogleStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/google/status', { userId: initialData.auth_id });
      if (res.ok) {
        const data = await res.json();
        setGoogleStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [initialData.auth_id]);

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

    void fetchGoogleStatus();
  }, [fetchGoogleStatus]);

  const handleConnectGoogle = async () => {
    setIsLoadingGoogle(true);
    try {
      const res = await apiFetch('/google/auth-url', { userId: initialData.auth_id });
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
      const res = await apiFetch('/google/disconnect', {
        method: 'DELETE',
        userId: initialData.auth_id,
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

      await apiRequest('/profile', {
        method: 'PATCH',
        userId: initialData.auth_id,
        body: {
          nome_completo: nome,
          cidade,
          endereco,
          numero
        },
      });

      router.refresh();
      setSenha('');
      toast.success('Perfil atualizado com sucesso!');
    } catch (err: unknown) {
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

      const response = await apiFetch('/profile/avatar', {
        method: 'POST',
        userId: initialData.auth_id,
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar foto de perfil');
      }

      const { foto_perfil } = await response.json();
      setFotoUrl(foto_perfil);

      router.refresh();
      toast.success('Foto de perfil atualizada!');
    } catch (err: unknown) {
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
          Perfil
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
        {initialData.tipo_de_usuario !== 'atendente' && (
          <>
            <button
              className={`${styles.tabButton} ${activeTab === 'integracoes' ? styles.active : ''}`}
              onClick={() => handleTabChange('integracoes')}
            >
              <Plug size={18} />
              Integrações
              {activeTab === 'integracoes' && <motion.div layoutId="tabIndicator_config" className={styles.tabIndicator} />}
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'assinatura' ? styles.active : ''}`}
              onClick={() => handleTabChange('assinatura')}
            >
              <CreditCard size={18} />
              Assinatura
              {activeTab === 'assinatura' && <motion.div layoutId="tabIndicator_config" className={styles.tabIndicator} />}
            </button>
          </>
        )}
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
                      className={`${styles.input} ${initialData.tipo_de_usuario === 'atendente' ? styles.readOnly : ''}`}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder={initialData.tipo_de_usuario === 'atendente' ? "Ocultado por segurança" : "Deixe em branco para manter a atual"}
                      disabled={initialData.tipo_de_usuario === 'atendente'}
                      title={initialData.tipo_de_usuario === 'atendente' ? 'Apenas admins podem realizar a troca de senha do seu acesso.' : ''}
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
                      className={`${styles.input} ${initialData.tipo_de_usuario === 'atendente' ? styles.readOnly : ''}`}
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="Ex: 50"
                      disabled={initialData.tipo_de_usuario === 'atendente'}
                      title={initialData.tipo_de_usuario === 'atendente' ? 'Apenas o administrador pode alterar o seu número no sistema.' : ''}
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
                    <h4>Agendamento automático pela IA {initialData.tipo_de_usuario === 'atendente' && <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginLeft: '8px' }}>Admin</span>}</h4>
                    <p>Permite que a IA ofereça horários livres e confirme agendamentos automaticamente nas conversas.</p>
                  </div>
                  <div
                    className={`${styles.toggleSwitch} ${agendamentoAutomaticoIa ? styles.active : ''}`}
                    style={{ opacity: initialData.tipo_de_usuario === 'atendente' ? 0.5 : 1, cursor: initialData.tipo_de_usuario === 'atendente' ? 'not-allowed' : 'pointer' }}
                    onClick={() => {
                      if (initialData.tipo_de_usuario !== 'atendente') setAgendamentoAutomaticoIa(!agendamentoAutomaticoIa);
                    }}
                  >
                    <div className={styles.toggleKnob} />
                  </div>
                </div>

                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h4>Alertar atendentes quando a IA pedir ajuda {initialData.tipo_de_usuario === 'atendente' && <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginLeft: '8px' }}>Admin</span>}</h4>
                    <p>Envia notificações para os números dos atendentes vinculados à conexão quando houver necessidade de intervenção humana.</p>
                  </div>
                  <div
                    className={`${styles.toggleSwitch} ${alertaAtendentesIntervencaoIa ? styles.active : ''}`}
                    style={{ opacity: initialData.tipo_de_usuario === 'atendente' ? 0.5 : 1, cursor: initialData.tipo_de_usuario === 'atendente' ? 'not-allowed' : 'pointer' }}
                    onClick={() => {
                      if (initialData.tipo_de_usuario !== 'atendente') setAlertaAtendentesIntervencaoIa(!alertaAtendentesIntervencaoIa);
                    }}
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
                      await apiRequest('/profile', {
                        method: 'PATCH',
                        userId: initialData.auth_id,
                        body: {
                          mostra_nome_mensagens: mostraNomeMensagens,
                          agendamento_automatico_ia: agendamentoAutomaticoIa,
                          alerta_atendentes_intervencao_ia: alertaAtendentesIntervencaoIa,
                        },
                      });

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

          {activeTab === 'assinatura' && (
            <motion.div
              key="assinatura"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={styles.tabPanel}
            >
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Sua Assinatura</h3>

                <div className={styles.settingItem} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                  <div className={styles.settingInfo}>
                    <h4>Plano <span style={{ textTransform: 'capitalize', }}>{initialData.plano}</span></h4>
                    <p>Aqui você pode ver o uso do seu plano no mês atual.</p>
                  </div>

                  <div style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', width: '100%' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', color: '#a1a1aa', fontWeight: 500 }}>Mensagens Trafegadas</span>
                        <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>{initialData.mensagens_enviadas} / {initialData.limite_mensagens_mensais}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (initialData.mensagens_enviadas / initialData.limite_mensagens_mensais) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #3b82f6)', borderRadius: '4px' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', color: '#a1a1aa', fontWeight: 500 }}>Contatos em Campanhas</span>
                        <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>{initialData.contatos_usados_campanhas} / {initialData.limite_contatos_campanhas}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (initialData.contatos_usados_campanhas / initialData.limite_contatos_campanhas) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #3b82f6)', borderRadius: '4px' }} />
                      </div>
                    </div>
                  </div>

                  <button
                    className={styles.saveBtn}
                    onClick={handleGerenciarAssinatura}
                    disabled={isLoadingPortal || initialData.tipo_de_usuario !== 'superadmin' && initialData.tipo_de_usuario !== 'admin'}
                    style={{ marginTop: '1rem', background: '#fff', color: '#000', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {isLoadingPortal ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                    {isLoadingPortal ? 'Redirecionando...' : 'Gerenciar Assinatura'}
                  </button>
                  {initialData.tipo_de_usuario === 'atendente' && (
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Apenas o administrador da área pode gerenciar a assinatura.</p>
                  )}

                  {initialData.tipo_de_usuario !== 'atendente' && (
                    <div className="mt-8 w-full pt-12 border-t border-white/5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                        {plans.map((plan) => {
                          const price = plan.mensal;
                          const subtitle = 'Cobrado mensalmente';

                          return (
                            <motion.div
                              key={plan.id}
                              className={`relative py-6 flex flex-col p-5 rounded-2xl border transition-all duration-300 ${plan.popular
                                ? 'border-blue-500/50 bg-blue-950/20 shadow-[0_0_40px_-15px_rgba(99,102,241,0.3)]'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                                }`}
                            >
                              {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-blue-500 to-blue-500 rounded-full flex items-center gap-1 shadow-lg">
                                  <Sparkles className="w-3 h-3 text-white" />
                                  <span className="text-[10px] font-bold text-white tracking-wide uppercase font-inter">Recomendado</span>
                                </div>
                              )}

                              <div className="mb-6">
                                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                                <div className="flex items-baseline gap-1 mt-2">
                                  <span className="text-gray-400 text-base font-medium">R$</span>
                                  <span className="text-3xl font-black text-white tracking-tight">{price}</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1 font-medium">{subtitle}</p>
                              </div>

                              <div className="flex-1">
                                <ul className="space-y-3 mb-6">
                                  {plan.features.map((feat, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${plan.color}`}>
                                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                      </div>
                                      <span className="text-sm text-gray-300 font-medium leading-relaxed">{feat}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <button
                                onClick={() => handleCheckout(plan.id)}
                                disabled={loadingPlan === plan.id}
                                style={{ border: 'none' }}
                                className={`w-full cursor-pointer py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${plan.popular
                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/25'
                                  : 'bg-white text-black hover:bg-gray-100'
                                  } ${loadingPlan === plan.id ? 'opacity-80 cursor-wait' : ''}`}
                              >
                                {loadingPlan === plan.id ? (
                                  <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
                                ) : (
                                  'Assinar Agora'
                                )}
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
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
