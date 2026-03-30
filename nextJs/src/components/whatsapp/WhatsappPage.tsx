'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger.api';
import ConnectionCard from './ConnectionCard';
import ConnectionModal from './ConnectionModal';
import TestModal from './TestModal';
import styles from './WhatsappPage.module.css';
import type { WhatsappConnection } from './ConnectionCard';

type FilterStatus = 'todos' | 'connected' | 'disconnected';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function WhatsappPage() {
  const [connections, setConnections] = useState<WhatsappConnection[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('todos');
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [agentes, setAgentes] = useState<{ id: string; nome: string; tipo_de_agente: string }[]>([]);
  const [conhecimentos, setConhecimentos] = useState<{ id: string; titulo: string }[]>([]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editConnection, setEditConnection] = useState<WhatsappConnection | null>(null);
  const [testConnection, setTestConnection] = useState<WhatsappConnection | null>(null);
  const [deleteConnection, setDeleteConnection] = useState<WhatsappConnection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch user + data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);

        // Fetch connections via NestJS
        const connResponse = await fetch(`${API_URL}/whatsapp`, {
          headers: { 'x-user-id': user.id },
        });
        if (connResponse.ok) {
          const data = await connResponse.json();
          setConnections(data || []);
        }

        // Fetch agentes from Supabase directly (they have RLS)
        const { data: agentesData } = await supabase
          .from('agentes')
          .select('id, nome, tipo_de_agente')
          .eq('user_id', user.id);
        setAgentes(agentesData || []);

        // Fetch conhecimentos
        const { data: conhecimentosData } = await supabase
          .from('conhecimentos')
          .select('id, titulo')
          .eq('user_id', user.id);
        setConhecimentos(conhecimentosData || []);
      } catch (err) {
        logger.error('whatsapp.fetchData', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Supabase Realtime subscription
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
          // Filtra apenas eventos do usuário atual (segurança extra)
          const record = (payload.new || payload.old) as any;
          if (record?.user_id && record.user_id !== userId) return;

          if (payload.eventType === 'INSERT') {
            setConnections((prev) => [payload.new as WhatsappConnection, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setConnections((prev) =>
              prev.map((conn) =>
                conn.id === (payload.new as WhatsappConnection).id
                  ? { ...conn, ...(payload.new as WhatsappConnection) }
                  : conn
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setConnections((prev) =>
              prev.filter((conn) => conn.id !== (payload.old as any).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Filtered connections
  const filteredConnections = connections.filter((conn) => {
    if (filter === 'todos') return true;
    return conn.status === filter;
  });

  // Create connection — returns connectionId for cancel tracking
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
      return {
        ...result,
        connectionId: result?.connection?.id || null,
      };
    },
    [userId]
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
      setConnections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
      );
    },
    [userId]
  );

  // Cancel pending connection (ghost cleanup — Evolution + Supabase)
  const handleCancelConnection = useCallback(
    async (connectionId: string) => {
      try {
        await fetch(`${API_URL}/whatsapp/${connectionId}`, {
          method: 'DELETE',
          headers: { 'x-user-id': userId },
        });
        setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      } catch (err) {
        logger.error('whatsapp.cancelConnection', err);
      }
    },
    [userId]
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
          setConnections((prev) => prev.filter((c) => c.id !== conn.id));
          setDeleteConnection(null);
        }
      } catch (err) {
        logger.error('whatsapp.delete', err);
      } finally {
        setIsDeleting(false);
      }
    },
    [userId]
  );

  const connectedCount = connections.filter((c) => c.status === 'connected').length;
  const totalCount = connections.length;

  return (
    <div className={styles.pageWrapper}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1>WhatsApps</h1>
          <p>
            Gerencie suas conexões do WhatsApp.{' '}
            {totalCount > 0 && (
              <span>
                {connectedCount}/{totalCount} conectados
              </span>
            )}
          </p>
        </div>
        <button className={styles.addButton} onClick={() => setShowCreateModal(true)}>
          <Plus size={18} />
          Adicionar Conexão
        </button>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        {(['todos', 'connected', 'disconnected'] as FilterStatus[]).map((f) => (
          <button
            key={f}
            className={`${styles.filterChip} ${filter === f ? styles.filterChipActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'todos' ? 'Todos' : f === 'connected' ? 'Conectados' : 'Desconectados'}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className={styles.loadingSpinner} />
      ) : filteredConnections.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <MessageCircle size={36} color="rgba(255,255,255,0.3)" />
          </div>
          <h3>
            {totalCount === 0
              ? 'Nenhuma conexão ainda'
              : 'Nenhuma conexão com este filtro'}
          </h3>
          <p>
            {totalCount === 0
              ? 'Adicione sua primeira conexão WhatsApp para começar a automatizar seu atendimento.'
              : 'Tente alterar o filtro para ver mais conexões.'}
          </p>
        </div>
      ) : (
        <div className={styles.connectionGrid}>
          {filteredConnections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              onEdit={(c) => setEditConnection(c)}
              onDelete={(c) => setDeleteConnection(c)}
              onTest={(c) => setTestConnection(c)}
            />
          ))}
        </div>
      )}

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
      {deleteConnection && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConnection(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Excluir Conexão</h2>
              <button className={styles.modalCloseBtn} onClick={() => setDeleteConnection(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.deleteConfirm}>
              <p>
                Tem certeza que deseja excluir <strong>{deleteConnection.nome}</strong>?
                <br />
                Esta ação não pode ser desfeita e a instância será removida permanentemente.
              </p>
              <div className={styles.deleteActions}>
                <button className={styles.cancelBtn} onClick={() => setDeleteConnection(null)}>
                  Cancelar
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(deleteConnection)}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
