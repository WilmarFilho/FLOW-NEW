'use client';

import { useState } from 'react';
import { X, Type, Palette, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '../atendentes/AtendentesPage.module.css';

interface ModalProps {
  onClose: () => void;
  onSubmit: (nome: string, cor: string, descricao: string) => Promise<void>;
}

const coresHex = ["#3b82f6", "#f97316", "#22c55e", "#ef4444", "#a855f7", "#ec4899", "#14b8a6"];

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

export default function ModalNovaLista({ onClose, onSubmit }: ModalProps) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cor, setCor] = useState(coresHex[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setLoading(true);
    await onSubmit(nome.trim(), cor, descricao.trim());
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
            <h2 className={styles.modalTitle}>Nova Lista</h2>
            <button className={styles.modalCloseBtn} onClick={onClose} disabled={loading}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome da Lista</label>
              <div style={{ position: 'relative' }}>
                <Type size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input
                  type="text"
                  required
                  maxLength={40}
                  placeholder="Ex: Em Follow-up"
                  className={styles.formInput}
                  style={{ paddingLeft: 42 }}
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cor de Destaque</label>
              <div style={{ position: 'relative' }}>
                <Palette size={16} style={{ position: 'absolute', left: 14, top: 12, opacity: 0.4 }} />
                <div 
                  className={styles.formInput} 
                  style={{ paddingLeft: 42, minHeight: '52px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}
                >
                  {coresHex.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCor(c)}
                      className={`w-8 h-8 rounded-full transition-all ${cor === c ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                      disabled={loading}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Descrição da Lista</label>
              <div style={{ position: 'relative' }}>
                <FileText size={16} style={{ position: 'absolute', left: 14, top: 14, opacity: 0.4 }} />
                <textarea
                  maxLength={220}
                  placeholder="Ex: Lista para contatos que pediram reunião, proposta ou demonstraram intenção clara de avançar."
                  className={styles.formInput}
                  style={{ paddingLeft: 42, minHeight: 110, resize: 'vertical', paddingTop: 14 }}
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  disabled={loading}
                />
              </div>
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
                {loading ? 'Criando...' : 'Criar Lista'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
