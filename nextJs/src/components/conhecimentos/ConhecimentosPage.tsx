'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import useSWR from 'swr';
import {
  Plus,
  BookOpenText,
  Database,
  MessageSquare,
  Pencil,
  Trash2,
  Layers,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import ChatCollector from './ChatCollector';
import styles from './ConhecimentosPage.module.css';

interface Conhecimento {
  id: string;
  user_id: string;
  titulo: string;
  descricao?: string;
  status: string;
  resumo?: string;
  percentual_conclusao?: number;
  total_chunks: number;
  created_at: string;
  updated_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const fetchConhecimentos = async (userId: string): Promise<Conhecimento[]> => {
  const res = await fetch(`${API_URL}/conhecimentos`, {
    headers: { 'x-user-id': userId },
  });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

const SWR_OPTIONS = {
  revalidateOnFocus: true,
  dedupingInterval: 10000,
};

// ─── Animation Variants ───
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', damping: 20, stiffness: 260 },
  },
};

export default function ConhecimentosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [chatTarget, setChatTarget] = useState<Conhecimento | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Conhecimento | null>(null);
  const [editTarget, setEditTarget] = useState<Conhecimento | null>(null);
  const [newTitulo, setNewTitulo] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // SWR
  const {
    data: conhecimentos = [],
    isLoading,
    mutate,
  } = useSWR(
    userId ? ['conhecimentos', userId] : null,
    ([, uid]) => fetchConhecimentos(uid),
    SWR_OPTIONS,
  );

  const isPageLoading = !userId || isLoading;

  // ─── Create ───
  const handleCreate = async () => {
    if (!newTitulo.trim() || !userId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/conhecimentos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          titulo: newTitulo.trim(),
          descricao: newDescricao.trim() || undefined,
        }),
      });
      const created = await res.json();
      setShowCreateModal(false);
      setNewTitulo('');
      setNewDescricao('');
      await mutate();
      // Open chat immediately for the new base
      setChatTarget(created);
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Edit ───
  const handleEdit = async () => {
    if (!editTarget || !userId) return;
    setIsSubmitting(true);
    try {
      await fetch(`${API_URL}/conhecimentos/${editTarget.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          titulo: newTitulo.trim(),
          descricao: newDescricao.trim() || undefined,
        }),
      });
      setEditTarget(null);
      setNewTitulo('');
      setNewDescricao('');
      await mutate();
    } catch (err) {
      console.error('Edit failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Delete ───
  const handleDelete = async () => {
    if (!deleteTarget || !userId) return;
    setIsSubmitting(true);
    try {
      await fetch(`${API_URL}/conhecimentos/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId },
      });
      setDeleteTarget(null);
      await mutate();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (base: Conhecimento) => {
    setNewTitulo(base.titulo);
    setNewDescricao(base.descricao || '');
    setEditTarget(base);
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ready':
        return { label: 'Pronta', className: styles.statusReady };
      case 'error':
        return { label: 'Erro', className: styles.statusError };
      default:
        return { label: 'Em construção', className: styles.statusBuilding };
    }
  };

  const handleChatStatusChange = useCallback(() => {
    mutate();
  }, [mutate]);

  return (
    <div className={styles.pageContainer} style={{ position: 'relative' }}>
      {/* Loading */}
      <AnimatePresence>
        {isPageLoading && (
          <motion.div
            className={styles.loadingOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.4, ease: 'easeInOut' } }}
          >
            <motion.div
              className={styles.loadingSpinnerRing}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 20 } }}
            />
            <motion.span
              className={styles.loadingMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              Carregando bases de conhecimento...
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        className={`${styles.header} ${isPageLoading ? styles.contentBlurred : ''}`}
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className={styles.titleArea}>
          <h1>Bases de Conhecimento</h1>
          <p>Gerencie as bases que alimentam a IA dos seus agentes</p>
        </div>
        <motion.button
          className={styles.addButton}
          onClick={() => {
            setNewTitulo('');
            setNewDescricao('');
            setShowCreateModal(true);
          }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={18} />
          Nova Base
        </motion.button>
      </motion.div>

      {/* Content */}
      <motion.div
        className={isPageLoading ? styles.contentBlurred : ''}
        animate={{ filter: isPageLoading ? 'blur(6px)' : 'blur(0px)', opacity: isPageLoading ? 0.5 : 1 }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence mode="wait">
          {!isPageLoading && conhecimentos.length === 0 ? (
            <motion.div
              key="empty"
              className={styles.emptyState}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.2 }}
            >
          <div className={styles.emptyIcon}>
            <BookOpenText size={36} color="#fff" />
          </div>
          <h2>Nenhuma base criada ainda</h2>
          <p>
            Crie sua primeira base de conhecimento para que a IA possa atender
            seus clientes com informações sobre o seu negócio.
          </p>
          <button
            className={styles.emptyButton}
            onClick={() => {
              setNewTitulo('');
              setNewDescricao('');
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} />
            Criar primeira base
          </button>
        </motion.div>
          ) : (
            <motion.div
              key="grid"
              className={styles.grid}
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0 }}
            >
          {conhecimentos.map((base) => {
            const status = statusLabel(base.status);
            return (
              <motion.div
                key={base.id}
                className={styles.card}
                variants={itemVariants}
                layout
                onClick={() => setChatTarget(base)}
              >
                {/* Card Header */}
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>{base.titulo}</h3>
                    {base.descricao && (
                      <p className={styles.cardDesc}>{base.descricao}</p>
                    )}
                  </div>
                  <span className={`${styles.statusBadge} ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                {/* Card Body */}
                <div className={styles.cardBody}>
                  {base.resumo ? (
                    <p className={styles.resumo}>{base.resumo}</p>
                  ) : (
                    <p className={styles.resumo} style={{ fontStyle: 'italic' }}>
                      Nenhuma informação coletada ainda. Clique para começar.
                    </p>
                  )}
                </div>

                {/* Card Meta */}
                <div className={styles.cardMeta}>
                  <div className={styles.metaItem}>
                    <Layers size={14} />
                    {base.total_chunks || 0} chunks
                  </div>
                  <div className={styles.metaItem}>
                    <Database size={14} />
                    {new Date(base.created_at).toLocaleDateString('pt-BR')}
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      className={styles.trainBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatTarget(base);
                      }}
                    >
                      <MessageSquare size={13} />
                      Treinar
                    </button>
                    <button
                      className={styles.iconBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(base);
                      }}
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(base);
                      }}
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Create Modal ─── */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Nova Base de Conhecimento</h2>
              <div className={styles.formGroup}>
                <label>Nome da Base *</label>
                <input
                  className={styles.formInput}
                  placeholder="Ex: Manual de Vendas, Cardápio..."
                  value={newTitulo}
                  onChange={(e) => setNewTitulo(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label>Descrição (opcional)</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Uma breve descrição do que esta base contém..."
                  value={newDescricao}
                  onChange={(e) => setNewDescricao(e.target.value)}
                />
              </div>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button
                  className={styles.submitBtn}
                  onClick={handleCreate}
                  disabled={!newTitulo.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Criando...' : 'Criar e Treinar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Edit Modal ─── */}
      <AnimatePresence>
        {editTarget && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditTarget(null)}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Editar Base</h2>
              <div className={styles.formGroup}>
                <label>Nome da Base *</label>
                <input
                  className={styles.formInput}
                  value={newTitulo}
                  onChange={(e) => setNewTitulo(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label>Descrição (opcional)</label>
                <textarea
                  className={styles.formTextarea}
                  value={newDescricao}
                  onChange={(e) => setNewDescricao(e.target.value)}
                />
              </div>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setEditTarget(null)}>
                  Cancelar
                </button>
                <button
                  className={styles.submitBtn}
                  onClick={handleEdit}
                  disabled={!newTitulo.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Delete Confirm ─── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              className={styles.deleteConfirm}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Excluir Base</h2>
              <p>
                Tem certeza que deseja excluir <strong>{deleteTarget.titulo}</strong>?
                Todos os dados, arquivos e histórico de treinamento serão removidos permanentemente.
              </p>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>
                  Cancelar
                </button>
                <button
                  className={styles.deleteBtnConfirm}
                  onClick={handleDelete}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Chat Collector ─── */}
      <AnimatePresence>
        {chatTarget && userId && (
          <ChatCollector
            key={chatTarget.id}
            conhecimentoId={chatTarget.id}
            titulo={chatTarget.titulo}
            userId={userId}
            status={chatTarget.status}
            percentualConclusao={chatTarget.percentual_conclusao}
            onClose={() => {
              setChatTarget(null);
              mutate();
            }}
            onStatusChange={handleChatStatusChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
