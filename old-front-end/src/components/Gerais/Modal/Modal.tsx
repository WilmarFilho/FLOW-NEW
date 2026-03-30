// Libs
import type { PropsWithChildren } from 'react';
// Css
import styles from './Modal.module.css'
// Assets
import Icon from '../Icons/Icons';

interface ModalProps {
  isOpen: boolean;
  isSubmitting?: boolean;
  transparent?: boolean;
  onSave?: () => void;
  onClose: () => void;
  title: string;
  labelSubmit?: string;
  step?: 1 | 2 | 3 | undefined;
}

export default function Modal({
  isOpen,
  onClose,
  onSave,
  labelSubmit,
  isSubmitting,
  children,
  title,
  transparent,
  step,
}: PropsWithChildren<ModalProps>) {
  if (!isOpen) return null;

  const handleOverlayClick = () => {
    onClose();
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className={transparent ? styles.modalOverlayTransparent : styles.modalOverlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title">
      <div className={styles.modalContent} onClick={handleContentClick}>
        <header className={styles.modalHeader}>
          <h2>{title}</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Fechar modal">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className={styles.modalBody}>{children}</div>
        {( step === 2 || step === undefined ) && labelSubmit && (
          <footer className={styles.modalFooter}>
            <button
              disabled={isSubmitting}
              onClick={onClose}
              className={styles.cancelButton}
            >
              Cancelar
            </button>
            <button
              disabled={isSubmitting}
              onClick={onSave}
              className={styles.submitButton}
            >
              {isSubmitting ? (
                <>
                  <div className={styles.spinner}></div>
                  Carregando...
                </>
              ) : (
                <>
                {labelSubmit} <Icon nome='save' />
                </>
              )}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}


