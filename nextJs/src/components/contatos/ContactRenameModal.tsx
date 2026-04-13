'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil, Phone, User, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { modalPop, overlayFade } from '@/lib/motion/variants';
import styles from './ContactRenameModal.module.css';

type ContactRenameModalProps = {
  isOpen: boolean;
  initialName: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (nextName: string) => void | Promise<void>;
  subtitle?: string | null;
  title?: string;
  avatarUrl?: string | null;
};

export default function ContactRenameModal({
  avatarUrl,
  initialName,
  isOpen,
  loading = false,
  onClose,
  onConfirm,
  subtitle,
  title = 'Editar nome do contato',
}: ContactRenameModalProps) {
  const [mounted, setMounted] = useState(false);
  const [draftName, setDraftName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraftName(initialName);
  }, [initialName, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const cleanedName = useMemo(() => draftName.trim(), [draftName]);
  const isUnchanged = cleanedName === initialName.trim();
  const isInvalid = cleanedName.length === 0;

  const handleSubmit = async () => {
    if (loading || isInvalid || isUnchanged) {
      return;
    }

    await onConfirm(cleanedName);
  };

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className={styles.backdrop}
          onClick={onClose}
          variants={overlayFade}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            className={styles.modal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={modalPop}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className={styles.header}>
              <div>
                <span className={styles.eyebrow}>Contato</span>
                <p className={styles.description}>
                  Ajuste o nome exibido para manter a conversa organizada e o atendimento mais claro.
                </p>
              </div>

              <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Fechar modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.summaryCard}>
              <div className={styles.avatar}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={cleanedName || initialName || 'Contato'} />
                ) : (
                  <User size={18} />
                )}
              </div>

              <div className={styles.summaryText}>
                <strong>{initialName || 'Contato sem nome'}</strong>
                <span>
                  {subtitle || 'Sem número informado'}
                </span>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Novo nome</span>
              <div className={styles.inputWrap}>
                <Pencil size={16} className={styles.inputIcon} />
                <input
                  ref={inputRef}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  className={styles.input}
                  placeholder="Ex.: Cliente João"
                  maxLength={120}
                />
              </div>
              <p className={styles.helperText}>
                Esse nome aparece nas listas e no header da conversa para facilitar a identificação.
              </p>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleSubmit()}
                disabled={loading || isInvalid || isUnchanged}
              >
                {loading ? 'Salvando...' : 'Salvar nome'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
