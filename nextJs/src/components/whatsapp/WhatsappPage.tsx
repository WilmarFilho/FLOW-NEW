'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger.api';
import ConnectionCard from './ConnectionCard';
import ConnectionModal from './ConnectionModal';
import TestModal from './TestModal';
import styles from './WhatsappPage.module.css';
import type { WhatsappConnection } from './ConnectionCard';

type FilterStatus = 'todos' | 'connected' | 'disconnected';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── SWR Fetchers ──────────────────────────────────────────────────
const fetchConnections = async (uid: string) => {
  const res = await fetch(`${API_URL}/whatsapp`, {
    headers: { 'x-user-id': uid },
  });
  if (!res.ok) throw new Error('Falha ao buscar conexões');
  return (await res.json()) as WhatsappConnection[];
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
const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const headerVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay: 0.1 },
  },
};

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

const gridVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 25, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: -10,
    transition: { duration: 0.25, ease: 'easeInOut' as const },
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

const emptyStateVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as const,
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const emptyChildVariant = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
};

const modalBackdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 350, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 30,
    transition: { duration: 0.2, ease: 'easeIn' as const },
  },
};

export default function WhatsappPage() {
  const [filter, setFilter] = useState<FilterStatus>('todos');
  const [userId, setUserId] = useState<string>('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editConnection, setEditConnection] = useState<WhatsappConnection | null>(null);
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
          const record = (payload.new || payload.old) as any;
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
              return current.filter((conn) => conn.id !== (payload.old as any).id);
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
    if (filter === 'todos') return true;
    return conn.status === filter;
  });

  // Create connection
  const handleCreate = useCallback(
    async (data: {
      nome: string;
      numero?: string;
      agente_id?: string;
      conhecimento_id?: string;
      useQR: boolean;
    }) => {
      const response = await fetch(`${API_URL}/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          nome: data.nome,
          numero: data.numero,
          agente_id: data.agente_id,
          conhecimento_id: data.conhecimento_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao criar conexão');
      }

      const result = await response.json();
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
    async (id: string, data: { nome?: string; agente_id?: string; conhecimento_id?: string }) => {
      const response = await fetch(`${API_URL}/whatsapp/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar conexão');
      }

      const updated = await response.json();
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
        await fetch(`${API_URL}/whatsapp/${connectionId}`, {
          method: 'DELETE',
          headers: { 'x-user-id': userId },
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
        const response = await fetch(`${API_URL}/whatsapp/${conn.id}`, {
          method: 'DELETE',
          headers: { 'x-user-id': userId },
        });

        if (response.ok) {
          // Optimistic removal
          mutateConnections(
            (current = []) => current.filter((c) => c.id !== conn.id),
            { revalidate: false }
          );
          setDeleteConnection(null);
        }
      } catch (err) {
        logger.error('whatsapp.delete', err);
      } finally {
        setIsDeleting(false);
      }
    },
    [userId, mutateConnections]
  );

  const connectedCount = connections.filter((c) => c.status === 'connected').length;
  const totalCount = connections.length;

  return (
    <motion.div
      className={styles.pageWrapper}
      style={{ position: 'relative' }}
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        className={`${styles.pageHeader} ${isLoading ? styles.contentBlurred : ''}`}
        variants={headerVariants}
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
        {(['todos', 'connected', 'disconnected'] as FilterStatus[]).map((f) => (
          <motion.button
            key={f}
            className={`${styles.filterChip} ${filter === f ? styles.filterChipActive : ''}`}
            onClick={() => setFilter(f)}
            variants={filterChipVariant}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            layout
          >
            {f === 'todos' ? 'Todos' : f === 'connected' ? 'Conectados' : 'Desconectados'}
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
              variants={emptyStateVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div className={styles.emptyIcon} variants={emptyChildVariant}>
                <MessageCircle size={36} color="rgba(255,255,255,0.3)" />
              </motion.div>
              <motion.h3 variants={emptyChildVariant}>
                {totalCount === 0
                  ? 'Nenhuma conexão ainda'
                  : 'Nenhuma conexão com este filtro'}
              </motion.h3>
              <motion.p variants={emptyChildVariant}>
                {totalCount === 0
                  ? 'Adicione sua primeira conexão WhatsApp para começar a automatizar seu atendimento.'
                  : 'Tente alterar o filtro para ver mais conexões.'}
              </motion.p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              className={styles.connectionGrid}
              variants={gridVariants}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence>
                {filteredConnections.map((conn) => (
                  <motion.div
                    key={conn.id}
                    variants={cardVariants}
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
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className={styles.modal}
              onClick={(e) => e.stopPropagation()}
              variants={modalVariants}
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
