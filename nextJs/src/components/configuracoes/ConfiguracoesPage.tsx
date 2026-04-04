'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Save, Shield, Settings, User, UploadCloud } from 'lucide-react';
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

type TabType = 'perfil' | 'sistema';

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
        </AnimatePresence>
      </div>
    </div>
  );
}

