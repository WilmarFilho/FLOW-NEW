'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, MessageSquarePlus, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { modalPop, overlayFade } from '@/lib/motion/variants';
import styles from './ConversationsPage.module.css';
import type { ConversationOptions } from './types';

interface NewConversationModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  options?: ConversationOptions;
  onClose: () => void;
  onSubmit: (payload: {
    whatsapp_connection_id: string;
    contato_id?: string;
    contact_name?: string;
    contact_whatsapp?: string;
  }) => Promise<void>;
}

export default function NewConversationModal({
  isOpen,
  isSubmitting,
  options,
  onClose,
  onSubmit,
}: NewConversationModalProps) {
  const [connectionId, setConnectionId] = useState('');
  const [contactId, setContactId] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [search, setSearch] = useState('');

  const resetState = () => {
    setConnectionId('');
    setContactId('');
    setManualMode(false);
    setContactName('');
    setContactWhatsapp('');
    setSearch('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return options?.contacts ?? [];
    }

    return (options?.contacts ?? []).filter((contact) => {
      return (
        contact.nome.toLowerCase().includes(query) ||
        contact.whatsapp.toLowerCase().includes(query)
      );
    });
  }, [options?.contacts, search]);

  const handleSubmit = async () => {
    if (!connectionId) {
      return;
    }

    if (manualMode) {
      await onSubmit({
        whatsapp_connection_id: connectionId,
        contact_name: contactName,
        contact_whatsapp: contactWhatsapp,
      });
      resetState();
      return;
    }

    if (!contactId) {
      return;
    }

    await onSubmit({
      whatsapp_connection_id: connectionId,
      contato_id: contactId,
    });
    resetState();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.modalBackdrop}
          variants={overlayFade}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleClose}
        >
          <motion.div
            className={styles.modalShell}
            variants={modalPop}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>Nova conversa</span>
                <h2 className={styles.modalTitle}>Começar atendimento</h2>
                <p className={styles.modalDescription}>
                  Escolha a conexão, selecione um contato existente ou cadastre um novo
                  número para abrir o chat.
                </p>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={handleClose}
                aria-label="Fechar modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <section className={styles.modalSection}>
                <div className={styles.sectionHeader}>
                  <h3>Conexão ativa</h3>
                  <span>{options?.connections.length ?? 0} disponíveis</span>
                </div>

                <div className={styles.optionGrid}>
                  {(options?.connections ?? []).map((connection) => {
                    const isSelected = connection.id === connectionId;

                    return (
                      <button
                        key={connection.id}
                        type="button"
                        className={`${styles.optionCard} ${
                          isSelected ? styles.optionCardActive : ''
                        }`}
                        onClick={() => setConnectionId(connection.id)}
                      >
                        <div className={styles.optionCardContent}>
                          <strong>{connection.nome}</strong>
                          <span>{connection.numero || 'Conexão pronta para conversar'}</span>
                        </div>
                        {isSelected && <CheckCircle2 size={18} />}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={styles.modalSection}>
                <div className={styles.sectionHeader}>
                  <h3>Contato</h3>
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => {
                      setManualMode((current) => !current);
                      setContactId('');
                    }}
                  >
                    {manualMode ? 'Escolher da base' : 'Cadastrar novo número'}
                  </button>
                </div>

                {manualMode ? (
                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      <span>Nome</span>
                      <input
                        value={contactName}
                        onChange={(event) => setContactName(event.target.value)}
                        placeholder="Nome do contato"
                      />
                    </label>
                    <label className={styles.field}>
                      <span>WhatsApp</span>
                      <input
                        value={contactWhatsapp}
                        onChange={(event) => setContactWhatsapp(event.target.value)}
                        placeholder="5511999999999"
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    <label className={styles.searchField}>
                      <Search size={16} />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar por nome ou número"
                      />
                    </label>

                    <div className={styles.contactList}>
                      {filteredContacts.map((contact) => {
                        const isSelected = contact.id === contactId;

                        return (
                          <button
                            key={contact.id}
                            type="button"
                            className={`${styles.contactOption} ${
                              isSelected ? styles.contactOptionActive : ''
                            }`}
                            onClick={() => setContactId(contact.id)}
                          >
                            <div className={styles.contactIdentity}>
                              <div className={styles.contactAvatar}>
                                {contact.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={contact.avatar_url} alt={contact.nome} />
                                ) : (
                                  <span>{contact.nome.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <div className={styles.contactInfo}>
                                <strong>{contact.nome}</strong>
                                <span>{contact.whatsapp}</span>
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 size={18} />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.ghostButton} onClick={handleClose}>
                <ArrowLeft size={16} />
                Cancelar
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleSubmit()}
                disabled={
                  isSubmitting ||
                  !connectionId ||
                  (!manualMode && !contactId) ||
                  (manualMode && (!contactName.trim() || !contactWhatsapp.trim()))
                }
              >
                <MessageSquarePlus size={16} />
                {isSubmitting ? 'Criando...' : 'Abrir conversa'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(modalContent, document.body);
}
