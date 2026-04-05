'use client';

import { useState } from 'react';
import { X, User, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '../atendentes/AtendentesPage.module.css';

interface ModalProps {
  onClose: () => void;
  onSubmit: (data: { nome: string; whatsapp: string }) => Promise<void>;
}

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

export default function ModalNovoContato({ onClose, onSubmit }: ModalProps) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !whatsapp.trim()) return;
    setLoading(true);
    await onSubmit({ nome: nome.trim(), whatsapp: whatsapp.trim() });
    setLoading(false);
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
            <h2 className={styles.modalTitle}>Novo Contato</h2>
            <button className={styles.modalCloseBtn} onClick={onClose} disabled={loading}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome do Contato</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Ex: Maria Santos"
                  className={styles.formInput}
                  style={{ paddingLeft: 42 }}
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Número do WhatsApp</label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input
                  type="text"
                  required
                  maxLength={20}
                  placeholder="Ex: 5511999999999"
                  className={styles.formInput}
                  style={{ paddingLeft: 42 }}
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                />
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                Apenas números, incluindo código do país (DDI) e DDD.
              </p>
            </div>

            <div className={styles.modalActions}>
              <button 
                type="button" 
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className={styles.submitBtn}
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Adicionar Contato'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
