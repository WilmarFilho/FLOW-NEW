'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import styles from '../atendentes/AtendentesPage.module.css';

interface ModalConfirmacaoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
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

export default function ModalConfirmacao({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false,
}: ModalConfirmacaoProps) {
  if (!isOpen) return null;

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
          className={`${styles.modal} ${styles.deleteConfirm}`}
          style={{ maxWidth: '400px', textAlign: 'center' }}
          variants={modalVariants}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: variant === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(242, 228, 22, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: variant === 'danger' ? '#ef4444' : '#f2e416'
            }}>
              <AlertTriangle size={32} />
            </div>
          </div>

          <h2 className={styles.modalTitle} style={{ marginBottom: '12px' }}>{title}</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px', textWrap: 'balance' }}>
            {message}
          </p>

          <div className={styles.deleteActions} style={{ display: 'flex', gap: '12px' }}>
            <button
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={loading}
              style={{ flex: 1 }}
            >
              {cancelText}
            </button>
            <button
              className={variant === 'danger' ? styles.deleteBtn : styles.submitBtn}
              onClick={onConfirm}
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? 'Processando...' : confirmText}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
