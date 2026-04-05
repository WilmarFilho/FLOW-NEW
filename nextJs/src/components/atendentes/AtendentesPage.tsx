'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, User, Calendar, MessageCircle, Edit2, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import { supabase } from '@/lib/supabaseClient';
import { apiRequest } from '@/lib/api/client';
import {
  pageEntrance,
  headerEntrance,
  listStagger,
  cardEntrance,
  overlayFade,
  modalPop,
  emptyStateEntrance,
  emptyStateChild,
} from '@/lib/motion/variants';
import ModalAdicionarAtendente from './ModalAdicionarAtendente';
import styles from './AtendentesPage.module.css';

interface AtendenteData {
  id: string;
  created_at: string;
  numero: string | null;
  whatsapp_ids: string[];
  profile: {
    auth_id: string;
    nome_completo: string;
    foto_perfil: string | null;
    status: boolean;
    email?: string;
  };
}

const fetchAtendentes = async (uid: string) => {
  return apiRequest<AtendenteData[]>('/atendentes', { userId: uid });
};

const SWR_OPTIONS = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 10_000,
  errorRetryCount: 3,
};

// ── Framer Motion Variants ────────────────────────────────────────
const loadingOverlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.4, ease: 'easeInOut' as const },
  },
};

const spinnerVariants = {
  hidden: { scale: 0.5, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 260, damping: 20 },
  },
};

export default function AtendentesPage() {
  const [userId, setUserId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editAtendente, setEditAtendente] = useState<AtendenteData | null>(null);
  const [deleteAtendente, setDeleteAtendente] = useState<AtendenteData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const {
    data: atendentes = [],
    isLoading: isSwrLoading,
    mutate: mutateAtendentes,
  } = useSWR(
    userId ? ['atendentes', userId] : null,
    ([, uid]) => fetchAtendentes(uid),
    SWR_OPTIONS
  );

  const isLoading = !userId || isSwrLoading;

  const handleSuccess = () => {
    setIsModalOpen(false);
    setEditAtendente(null);
    mutateAtendentes();
  };

  const handleDelete = async () => {
    if (!deleteAtendente) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/atendentes/${deleteAtendente.id}`, {
        method: 'DELETE',
        userId,
      });

      mutateAtendentes(
        (current = []) => current.filter((a) => a.id !== deleteAtendente.id),
        { revalidate: false }
      );
      setDeleteAtendente(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir atendente');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      className={styles.pageWrapper}
      style={{ position: 'relative' }}
      variants={pageEntrance}
      initial="hidden"
      animate="visible"
    >
      <motion.header className={`${styles.pageHeader} ${isLoading ? styles.contentBlurred : ''}`} variants={headerEntrance}>
        <div>
          <h1>Contas de Atendentes</h1>
          <p>
            Gerencie o acesso de sua equipe à plataforma.
          </p>
        </div>
        <motion.button
          className={styles.addButton}
          onClick={() => setIsModalOpen(true)}
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={18} />
          <span>Novo Atendente</span>
        </motion.button>
      </motion.header>

      {error && <div className={styles.formError}>{error}</div>}

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className={styles.loadingOverlay}
            variants={loadingOverlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className={styles.loadingSpinnerRing}
              variants={spinnerVariants}
              initial="hidden"
              animate="visible"
            />
            <motion.span
              className={styles.loadingMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              Carregando atendentes...
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={isLoading ? styles.contentBlurred : ''}
        animate={{ filter: isLoading ? 'blur(6px)' : 'blur(0px)', opacity: isLoading ? 0.5 : 1 }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence mode="wait">
          {!isLoading && atendentes.length === 0 ? (
            <motion.div
              key="empty"
              className={styles.emptyState}
              variants={emptyStateEntrance}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div className={styles.emptyIcon} variants={emptyStateChild}>
                <Users size={36} color="rgba(255,255,255,0.3)" />
              </motion.div>
              <motion.h3 variants={emptyStateChild}>Nenhum atendente cadastrado</motion.h3>
              <motion.p variants={emptyStateChild}>Comece criando seu primeiro atendente para distribuir suas conversas.</motion.p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              className={styles.atendenteGrid}
              variants={listStagger}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence>
                {atendentes.map(atendente => (
                  <motion.div
                    key={atendente.id}
                    className={styles.card}
                    variants={cardEntrance}
                    layout
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardInfo}>
                        <h3>{atendente.profile?.nome_completo || 'Sem Nome'}</h3>
                        <div className={styles.statusBadge + ' ' + (atendente.profile?.status !== false ? styles.statusActive : styles.statusInactive)}>
                          <span className={styles.statusDot} />
                          {atendente.profile?.status !== false ? 'Ativo' : 'Inativo'}
                        </div>
                      </div>
                      <User color="rgba(255,255,255,0.2)" size={24} />
                    </div>

                      <div className={styles.cardMeta}>
                        <div className={styles.metaItem}>
                          <MessageCircle size={14} />
                          <span className={styles.metaValue}>
                            {atendente.whatsapp_ids?.length || 0} Conexões vinculadas
                          </span>
                        </div>
                        <div className={styles.metaItem}>
                          <User size={14} />
                          <span className={styles.metaValue}>
                            {atendente.numero || 'Sem número para alerta'}
                          </span>
                        </div>
                        <div className={styles.metaItem}>
                          <Calendar size={14} />
                          <span className={styles.metaValue}>
                          Criado em {new Date(atendente.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => setEditAtendente(atendente)}
                      >
                        <Edit2 size={14} />
                        <span>Editar</span>
                      </button>
                      <button
                        className={styles.actionBtn + ' ' + styles.actionBtnDanger}
                        onClick={() => setDeleteAtendente(atendente)}
                      >
                        <Trash2 size={14} />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Add/Edit Modal */}
      {(isModalOpen || editAtendente) && (
        <ModalAdicionarAtendente
          onClose={() => {
            setIsModalOpen(false);
            setEditAtendente(null);
          }}
          onSuccess={handleSuccess}
          editMode={!!editAtendente}
          atendente={editAtendente}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteAtendente && (
          <motion.div
            className={styles.modalBackdrop}
            variants={overlayFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setDeleteAtendente(null)}
          >
            <motion.div
              className={styles.modal}
              variants={modalPop}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Excluir Atendente</h2>
                <button className={styles.modalCloseBtn} onClick={() => setDeleteAtendente(null)}>
                  <X size={20} />
                </button>
              </div>
              <div className={styles.deleteConfirm}>
                <p>
                  Tem certeza que deseja excluir <strong>{deleteAtendente.profile?.nome_completo}</strong>?<br />
                  Seu acesso à plataforma será removido permanentemente.
                </p>
                <div className={styles.deleteActions}>
                  <button
                    className={styles.cancelBtn}
                    onClick={() => setDeleteAtendente(null)}
                    disabled={isDeleting}
                  >
                    Cancelar
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
