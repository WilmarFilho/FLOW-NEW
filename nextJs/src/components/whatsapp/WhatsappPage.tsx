'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import { supabase } from '@/lib/supabaseClient';
import { apiRequest, API_URL } from '@/lib/api/client';
import { logger } from '@/lib/logger.api';
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
import ConnectionCard from './ConnectionCard';
import ConnectionModal from './ConnectionModal';
import TestModal from './TestModal';
import styles from './WhatsappPage.module.css';
import type { WhatsappConnection } from './ConnectionCard';

type FilterStatus = 'todos' | 'connected' | 'disconnected' | 'deleted';

// ── SWR Fetchers ──────────────────────────────────────────────────
const fetchConnections = async (uid: string) => {
  return apiRequest<WhatsappConnection[]>('/whatsapp?includeDeleted=all', { userId: uid });
};

const fetchAgentes = async () => {
  const { data, error } = await supabase
    .from('agentes_ia')
    .select('id, nome, descricao');
  if (error) throw error;
  return data || [];
};

const fetchConhecimentos = async (uid: string) => {
  const { data, error } = await supabase
    .from('conhecimentos')
    .select('id, titulo')
    .eq('user_id', uid);
  if (error) throw error;
  return data || [];
};

// ── SWR Config ────────────────────────────────────────────────────
const SWR_OPTIONS = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 10_000, // Deduplicate requests within 10s
  errorRetryCount: 3,
};

// ── Framer Motion Variants ────────────────────────────────────────
const filterBarVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.2,
    },
  },
};

const filterChipVariant = {
  hidden: { opacity: 0, y: 10, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 25 },
  },
};

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

export default function WhatsappPage() {
  const [filter, setFilter] = useState<FilterStatus>('todos');
  const [userId, setUserId] = useState<string>('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editConnection, setEditConnection] = useState<WhatsappConnection | null>(null);
  const [reconnectConnection, setReconnectConnection] = useState<WhatsappConnection | null>(null);
  const [testConnection, setTestConnection] = useState<WhatsappConnection | null>(null);
  const [deleteConnection, setDeleteConnection] = useState<WhatsappConnection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch authenticated user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // ── SWR Hooks ─────────────────────────────────────────────────
  const {
    data: connections = [],
    isLoading: isLoadingConns,
    mutate: mutateConnections,
  } = useSWR(
    userId ? ['whatsapp:connections', userId] : null,
    ([, uid]) => fetchConnections(uid),
    SWR_OPTIONS
  );

  const { data: agentes = [], isLoading: isLoadingAgentes } = useSWR(
    'whatsapp:agentes',
    fetchAgentes,
    SWR_OPTIONS
  );

  const { data: conhecimentos = [], isLoading: isLoadingConhecimentos } = useSWR(
    userId ? ['whatsapp:conhecimentos', userId] : null,
    ([, uid]) => fetchConhecimentos(uid),
    SWR_OPTIONS
  );

  const isLoading = !userId || isLoadingConns || isLoadingAgentes || isLoadingConhecimentos;

  // Supabase Realtime subscription — optimistically updates SWR cache
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('whatsapp-connections-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_connections',
        },
        (payload) => {
          const record = (payload.new || payload.old) as {
            user_id?: string;
            id?: string;
            deleted_at?: string | null;
          } | null;
          if (record?.user_id && record.user_id !== userId) return;

          // Optimistically update SWR cache
          mutateConnections((current = []) => {
            if (payload.eventType === 'INSERT') {
              return [payload.new as WhatsappConnection, ...current];
            } else if (payload.eventType === 'UPDATE') {
              return current.map((conn) =>
                conn.id === (payload.new as WhatsappConnection).id
                  ? { ...conn, ...(payload.new as WhatsappConnection) }
                  : conn
              );
            } else if (payload.eventType === 'DELETE') {
              return current.filter(
                (conn) => conn.id !== ((payload.old as { id?: string } | null)?.id)
              );
            }
            return current;
          }, { revalidate: false });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, mutateConnections]);

  // Filtered connections
  const filteredConnections = connections.filter((conn) => {
    if (filter === 'todos') return !conn.deleted_at;
    if (filter === 'connected') return !conn.deleted_at && conn.status === 'connected';
    if (filter === 'disconnected') return !conn.deleted_at && conn.status === 'disconnected';
    if (filter === 'deleted') return Boolean(conn.deleted_at);
    return false;
  });

  // Create connection
  const handleCreate = useCallback(
    async (data: {
      nome: string;
      cor: string;
      numero?: string;
      agente_id?: string;
      conhecimento_id?: string;
      business_hours?: {
        timezone?: string;
        days?: Record<string, Array<{ start: string; end: string }>>;
      };
      appointment_slot_minutes?: number;
      useQR: boolean;
    }) => {
      const result = await apiRequest<{ connection?: { id?: string | null } }>('/whatsapp', {
        method: 'POST',
        userId,
        body: {
          nome: data.nome,
          cor: data.cor,
          numero: data.numero,
          agente_id: data.agente_id,
          conhecimento_id: data.conhecimento_id,
          business_hours: data.business_hours,
          appointment_slot_minutes: data.appointment_slot_minutes,
        },
      });
      // Revalidate connections after create
      mutateConnections();
      return {
        ...result,
        connectionId: result?.connection?.id || null,
      };
    },
    [userId, mutateConnections]
  );

  // Update connection
  const handleUpdate = useCallback(
    async (
      id: string,
      data: {
        nome?: string;
        cor?: string;
        agente_id?: string;
        conhecimento_id?: string;
        business_hours?: {
          timezone?: string;
          days?: Record<string, Array<{ start: string; end: string }>>;
        };
        appointment_slot_minutes?: number;
      },
    ) => {
      const updated = await apiRequest<Partial<WhatsappConnection>>(`/whatsapp/${id}`, {
        method: 'PUT',
        userId,
        body: data,
      });
      // Optimistic update + revalidate
      mutateConnections(
        (current = []) => current.map((c) => (c.id === id ? { ...c, ...updated } : c)),
        { revalidate: true }
      );
    },
    [userId, mutateConnections]
  );

  // Cancel pending connection
  const handleCancelConnection = useCallback(
    async (connectionId: string) => {
      try {
        await apiRequest(`/whatsapp/${connectionId}`, {
          method: 'DELETE',
          userId,
        });
        mutateConnections(
          (current = []) => current.filter((c) => c.id !== connectionId),
          { revalidate: false }
        );
      } catch (err) {
        logger.error('whatsapp.cancelConnection', err);
      }
    },
    [userId, mutateConnections]
  );

  // Delete connection
  const handleDelete = useCallback(
    async (conn: WhatsappConnection) => {
      setIsDeleting(true);
      try {
        await apiRequest(`/whatsapp/${conn.id}`, {
          method: 'DELETE',
          userId,
        });
        mutateConnections(
          (current = []) => current.filter((c) => c.id !== conn.id),
          { revalidate: false }
        );
        setDeleteConnection(null);
      } catch (err) {
        logger.error('whatsapp.delete', err);
      } finally {
        setIsDeleting(false);
      }
    },
    [userId, mutateConnections]
  );

  const handleReconnect = useCallback(
    async (conn: WhatsappConnection) => {
      const result = await apiRequest<{ qrCode?: string | null; pairingCode?: string | null; connectionId?: string | null }>(`/whatsapp/${conn.id}/reconnect`, {
        method: 'POST',
        userId,
      });

      mutateConnections();
      return {
        qrCode: result?.qrCode || null,
        pairingCode: result?.pairingCode || null,
        connectionId: result?.connectionId || conn.id,
      };
    },
    [userId, mutateConnections]
  );

  const activeConnections = connections.filter((c) => !c.deleted_at);
  const connectedCount = activeConnections.filter((c) => c.status === 'connected').length;
  const totalCount = activeConnections.length;

  return (
    <motion.div
      className={styles.pageWrapper}
      style={{ position: 'relative' }}
      variants={pageEntrance}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        className={`${styles.pageHeader} ${isLoading ? styles.contentBlurred : ''}`}
        variants={headerEntrance}
        initial="hidden"
        animate="visible"
      >
        <div>
          <h1>WhatsApps</h1>
          <p>
            Gerencie suas conexões do WhatsApp.{' '}
            {totalCount > 0 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {connectedCount}/{totalCount} conectados
              </motion.span>
            )}
          </p>
        </div>
        <motion.button
          className={styles.addButton}
          onClick={() => setShowCreateModal(true)}
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring' as const, stiffness: 400, damping: 17 }}
        >
          <Plus size={18} />
          Adicionar Conexão
        </motion.button>
      </motion.div>

      {/* Filter Bar */}
      <motion.div
        className={`${styles.filterBar} ${isLoading ? styles.contentBlurred : ''}`}
        variants={filterBarVariants}
        initial="hidden"
        animate="visible"
      >
        {(['todos', 'connected', 'disconnected', 'deleted'] as FilterStatus[]).map((f) => (
          <motion.button
            key={f}
            className={`${styles.filterChip} ${filter === f ? styles.filterChipActive : ''}`}
            onClick={() => setFilter(f)}
            variants={filterChipVariant}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            layout
          >
            {f === 'todos'
              ? 'Todos'
              : f === 'connected'
                ? 'Conectados'
                : f === 'disconnected'
                  ? 'Desconectados'
                  : 'Excluídas'}
          </motion.button>
        ))}
      </motion.div>

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
              Carregando conexões…
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <motion.div
        className={isLoading ? styles.contentBlurred : ''}
        animate={{ filter: isLoading ? 'blur(6px)' : 'blur(0px)', opacity: isLoading ? 0.5 : 1 }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence mode="wait">
          {!isLoading && filteredConnections.length === 0 ? (
            <motion.div
              key="empty"
              className={styles.emptyState}
              variants={emptyStateEntrance}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div className={styles.emptyIcon} variants={emptyStateChild}>
                <MessageCircle size={36} color="rgba(255,255,255,0.3)" />
              </motion.div>
              <motion.h3 variants={emptyStateChild}>
                {totalCount === 0
                  ? 'Nenhuma conexão ainda'
                  : 'Nenhuma conexão com este filtro'}
              </motion.h3>
              <motion.p variants={emptyStateChild}>
                {totalCount === 0
                  ? 'Adicione sua primeira conexão WhatsApp para começar a automatizar seu atendimento.'
                  : 'Tente alterar o filtro para ver mais conexões.'}
              </motion.p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              className={styles.connectionGrid}
              variants={listStagger}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence>
                {filteredConnections.map((conn) => (
                  <motion.div
                    key={conn.id}
                    variants={cardEntrance}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                    layoutId={conn.id}
                  >
                    <ConnectionCard
                      connection={conn}
                      onEdit={(c) => setEditConnection(c)}
                      onDelete={(c) => setDeleteConnection(c)}
                      onTest={(c) => setTestConnection(c)}
                      onReconnect={(c) => setReconnectConnection(c)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Create Modal */}
      <ConnectionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        agentes={agentes}
        conhecimentos={conhecimentos}
        onSubmit={handleCreate}
        onUpdate={handleUpdate}
        onCancelConnection={handleCancelConnection}
      />

      {/* Edit Modal */}
      {editConnection && (
        <ConnectionModal
          isOpen={true}
          onClose={() => setEditConnection(null)}
          editMode
          connection={editConnection}
          agentes={agentes}
          conhecimentos={conhecimentos}
          onSubmit={handleCreate}
          onUpdate={handleUpdate}
          onCancelConnection={handleCancelConnection}
        />
      )}

      {/* Reconnect Modal */}
      {reconnectConnection && (
        <ConnectionModal
          isOpen={true}
          onClose={() => setReconnectConnection(null)}
          reconnectMode
          connection={reconnectConnection}
          agentes={agentes}
          conhecimentos={conhecimentos}
          onSubmit={handleCreate}
          onUpdate={handleUpdate}
          onCancelConnection={handleCancelConnection}
          onReconnect={(connectionId) =>
            handleReconnect(
              reconnectConnection.id === connectionId
                ? reconnectConnection
                : { ...reconnectConnection, id: connectionId }
            )
          }
        />
      )}

      {/* Test Modal */}
      <TestModal
        isOpen={!!testConnection}
        onClose={() => setTestConnection(null)}
        connection={testConnection}
        apiUrl={API_URL}
        userId={userId}
      />

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConnection && (
          <motion.div
            className={styles.modalBackdrop}
            onClick={() => setDeleteConnection(null)}
            variants={overlayFade}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className={styles.modal}
              onClick={(e) => e.stopPropagation()}
              variants={modalPop}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Excluir Conexão</h2>
                <motion.button
                  className={styles.modalCloseBtn}
                  onClick={() => setDeleteConnection(null)}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring' as const, stiffness: 400, damping: 17 }}
                >
                  <X size={20} />
                </motion.button>
              </div>
              <div className={styles.deleteConfirm}>
                <p>
                  Tem certeza que deseja excluir <strong>{deleteConnection.nome}</strong>?
                  <br />
                  Esta ação não pode ser desfeita e a instância será removida permanentemente.
                </p>
                <div className={styles.deleteActions}>
                  <motion.button
                    className={styles.cancelBtn}
                    onClick={() => setDeleteConnection(null)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(deleteConnection)}
                    disabled={isDeleting}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {isDeleting ? 'Excluindo...' : 'Excluir'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
