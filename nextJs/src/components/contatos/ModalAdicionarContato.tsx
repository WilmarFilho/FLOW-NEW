'use client';

import { useState, useEffect } from 'react';
import { X, Search, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '../atendentes/AtendentesPage.module.css';

interface ModalProps {
  onClose: () => void;
  onSubmit: (contatoIds: string[]) => Promise<void>;
  listaNome?: string;
  userId: string;
  existingIds?: string[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 }
  },
};

export default function ModalAdicionarContato({ onClose, onSubmit, listaNome, userId, existingIds = [] }: ModalProps) {
  const [contatos, setContatos] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadContatos() {
      try {
        const res = await fetch(`${API_URL}/contatos`, {
          headers: { 'x-user-id': userId }
        });
        if (res.ok) {
          const data = await res.json();
          setContatos(data);
        }
      } catch (err) {
        console.error("Erro ao carregar contatos", err);
      } finally {
        setLoadingContacts(false);
      }
    }
    loadContatos();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    await onSubmit(selectedIds);
    setSubmitting(false);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const filtered = contatos.filter(c => {
    if (existingIds.includes(c.id)) return false;
    return c.nome.toLowerCase().includes(search.toLowerCase()) ||
           c.whatsapp.includes(search);
  }).slice(0, 10); // Show max 10 for performance in dropdown

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
          style={{ display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}
          variants={modalVariants}
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Vincular Contato {listaNome ? `- ${listaNome}` : ''}</h2>
            <button
              className={styles.modalCloseBtn}
              onClick={onClose}
              disabled={submitting}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className={styles.formGroup} style={{ marginBottom: 0, paddingBottom: 10 }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input
                  type="text"
                  placeholder="Buscar por nome ou numero..."
                  className={styles.formInput}
                  style={{ paddingLeft: 42 }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10" style={{ padding: '12px 0' }}>
              {loadingContacts ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)' }}>
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent flex-shrink-0 animate-spin rounded-full mb-4" />
                  <p style={{ fontSize: 14, margin: 0 }}>Carregando seus contatos...</p>
                </div>
              ) : filtered.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map(c => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleSelection(c.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 12,
                          borderRadius: 12,
                          border: '1px solid',
                          borderColor: isSelected ? '#1269f4' : 'transparent',
                          backgroundColor: isSelected ? 'rgba(18, 105, 244, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: 4,
                          border: '1px solid',
                          borderColor: isSelected ? '#1269f4' : 'rgba(255,255,255,0.2)',
                          background: isSelected ? '#1269f4' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                        {c.avatar_url ? (
                          <img src={c.avatar_url} style={{ width: 32, height: 32, borderRadius: '50%' }} alt="" />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(18, 105, 244, 0.2)', color: '#1269f4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <User size={14} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: '#fff', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{c.nome}</p>
                          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{c.whatsapp}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: 14, padding: '16px 0' }}>Nenhum contato encontrado.</p>
              )}
            </div>

            <div className={styles.modalActions} style={{ marginTop: 12, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={submitting || selectedIds.length === 0}
              >
                {submitting ? 'Salvando...' : `Adicionar ${selectedIds.length > 0 ? `(${selectedIds.length})` : ''}`}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
