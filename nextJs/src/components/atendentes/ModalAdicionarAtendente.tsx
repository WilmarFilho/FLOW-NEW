'use client';

import { useState, useEffect } from 'react';
import { X, User, Mail, Lock, Phone, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import styles from './AtendentesPage.module.css';

interface ModalProps {
  onClose: () => void;
  onSuccess: () => void;
  editMode?: boolean;
  atendente?: any;
}

interface WhatsappConnection {
  id: string;
  nome: string;
  status: string;
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: 20,
    transition: { duration: 0.2 }
  },
} as const;

export default function ModalAdicionarAtendente({ onClose, onSuccess, editMode = false, atendente }: ModalProps) {
  const [formData, setFormData] = useState({
    nome_completo: '',
    email: '',
    password: '',
    whatsapp_ids: [] as string[]
  });
  const [whatsappConnections, setWhatsappConnections] = useState<WhatsappConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingConnections, setFetchingConnections] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editMode && atendente) {
      setFormData({
        nome_completo: atendente.profile?.nome_completo || '',
        email: atendente.profile?.email || '', // Email might be hidden in returning query sometimes
        password: '', // Password is not returned
        whatsapp_ids: atendente.whatsapp_ids || []
      });
    }
    fetchConnections();
  }, [editMode, atendente]);

  const fetchConnections = async () => {
    setFetchingConnections(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/whatsapp`, {
        headers: { 'x-user-id': session.user.id }
      });

      if (response.ok) {
        const data = await response.json();
        setWhatsappConnections(data);
      }
    } catch (err) {
      console.error('Erro ao buscar conexões:', err);
    } finally {
      setFetchingConnections(false);
    }
  };

  const toggleWhatsapp = (id: string) => {
    setFormData(prev => ({
      ...prev,
      whatsapp_ids: prev.whatsapp_ids.includes(id)
        ? prev.whatsapp_ids.filter(wid => wid !== id)
        : [...prev.whatsapp_ids, id]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = editMode 
        ? `${NEXT_PUBLIC_API_URL}/atendentes/${atendente.id}` 
        : `${NEXT_PUBLIC_API_URL}/atendentes`;
      
      const method = editMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Erro ao salvar atendente');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        className={styles.modalBackdrop}
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        <motion.div 
          className={styles.modal}
          variants={modalVariants}
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>
              {editMode ? 'Editar Atendente' : 'Novo Atendente'}
            </h2>
            <button className={styles.modalCloseBtn} onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {error && <div className={styles.formError}>{error}</div>}

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome Completo</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input
                  type="text"
                  className={styles.formInput}
                  style={{ paddingLeft: 42 }}
                  placeholder="Ex: João da Silva"
                  required
                  value={formData.nome_completo}
                  onChange={e => setFormData({ ...formData, nome_completo: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>E-mail de Acesso</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input
                  type="email"
                  className={styles.formInput}
                  style={{ paddingLeft: 42 }}
                  placeholder="joao@exemplo.com"
                  required
                  disabled={editMode}
                  value={editMode ? atendente.profile?.email : formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              {editMode && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>O e-mail não pode ser alterado após o cadastro.</p>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                {editMode ? 'Nova Senha (opcional)' : 'Senha de Acesso'}
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input
                  type="password"
                  className={styles.formInput}
                  style={{ paddingLeft: 42 }}
                  placeholder={editMode ? 'Deixe em branco para manter' : 'Min 6 caracteres'}
                  required={!editMode}
                  minLength={6}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Conexões permitidas</label>
              {fetchingConnections ? (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Carregando conexões...</p>
              ) : whatsappConnections.length > 0 ? (
                <div className={styles.connectionsGrid}>
                  {whatsappConnections.map(conn => (
                    <div 
                      key={conn.id} 
                      className={`${styles.connectionOption} ${formData.whatsapp_ids.includes(conn.id) ? styles.connectionOptionActive : ''}`}
                      onClick={() => toggleWhatsapp(conn.id)}
                    >
                      <div style={{ 
                        width: 16, height: 16, borderRadius: 4, 
                        border: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: formData.whatsapp_ids.includes(conn.id) ? '#1269f4' : 'transparent',
                        borderColor: formData.whatsapp_ids.includes(conn.id) ? '#1269f4' : 'rgba(255,255,255,0.2)'
                      }}>
                        {formData.whatsapp_ids.includes(conn.id) && <Check size={12} color="#fff" />}
                      </div>
                      <span className={styles.connectionOptionText}>{conn.nome}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'rgba(239, 68, 68, 0.7)' }}>Você não possui conexões de WhatsApp configuradas.</p>
              )}
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
                Cancelar
              </button>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Salvando...' : editMode ? 'Salvar Alterações' : 'Criar Atendente'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
