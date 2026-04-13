'use client';

import { Bot, BookOpen, Pencil, RefreshCcw, Trash2, MessageSquareText } from 'lucide-react';
import styles from './WhatsappPage.module.css';

export interface WhatsappConnection {
  id: string;
  nome: string;
  cor?: string | null;
  numero: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'deleted';
  instance_name: string;
  agente_id: string | null;
  conhecimento_id: string | null;
  business_hours?: {
    timezone?: string;
    days?: Record<string, Array<{ start: string; end: string }>>;
  };
  appointment_slot_minutes?: number;
  agentes_ia?: { id: string; nome: string } | null;
  conhecimentos?: { id: string; titulo: string } | null;
  deleted_at?: string | null;
}

interface ConnectionCardProps {
  connection: WhatsappConnection;
  onEdit: (conn: WhatsappConnection) => void;
  onDelete: (conn: WhatsappConnection) => void;
  onTest: (conn: WhatsappConnection) => void;
  onReconnect: (conn: WhatsappConnection) => void;
}

export default function ConnectionCard({
  connection,
  onEdit,
  onDelete,
  onTest,
  onReconnect,
}: ConnectionCardProps) {

  const statusLabel = {
    connected: 'Conectado',
    connecting: 'Conectando',
    disconnected: 'Desconectado',
    deleted: 'Excluída',
  }[connection.deleted_at ? 'deleted' : connection.status];

  const statusClass = {
    connected: styles.statusConnected,
    connecting: styles.statusConnecting,
    disconnected: styles.statusDisconnected,
    deleted: styles.statusDisconnected,
  }[connection.deleted_at ? 'deleted' : connection.status];

  const cardClass = {
    connected: styles.cardConnected,
    connecting: styles.cardConnecting,
    disconnected: styles.cardDisconnected,
    deleted: styles.cardDisconnected,
  }[connection.deleted_at ? 'deleted' : connection.status];
  const businessDays = Object.entries(connection.business_hours?.days || {}).filter(
    ([, windows]) => Array.isArray(windows) && windows.length > 0,
  ).length;
  const isDeleted = Boolean(connection.deleted_at);

  return (
    <div className={`${styles.card} ${cardClass}`}>
      <div className={styles.cardHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '999px',
                backgroundColor: connection.cor || '#22c55e',
                boxShadow: '0 0 0 3px rgba(255,255,255,0.06)',
                flexShrink: 0,
              }}
            />
            <h3 className={styles.cardName}>{connection.nome}</h3>
          </div>
          <p className={styles.cardNumber}>
            {connection.numero || 'Número não definido'}
          </p>
        </div>
        <div className={`${styles.statusBadge} ${statusClass}`}>
          <span className={`${styles.statusDot} ${connection.status === 'connecting' ? styles.statusDotPulse : ''}`} />
          {statusLabel}
        </div>
      </div>

      <div className={styles.cardMeta}>
        <div className={styles.metaItem}>
          <Bot size={14} />
          <span>Agente:</span>
          <span className={styles.metaValue}>
            {connection.agentes_ia?.nome || 'Nenhum'}
          </span>
        </div>
        <div className={styles.metaItem}>
          <BookOpen size={14} />
          <span>Conhecimento:</span>
          <span className={styles.metaValue}>
            {connection.conhecimentos?.titulo || 'Nenhum'}
          </span>
        </div>
        <div className={styles.metaItem}>
          <BookOpen size={14} />
          <span>Agenda:</span>
          <span className={styles.metaValue}>
            {businessDays > 0
              ? `${businessDays} dia(s) configurados • ${connection.appointment_slot_minutes || 60} min`
              : 'Sem horario definido'}
          </span>
        </div>
      </div>

      {!isDeleted ? (
        <div className={styles.cardActions}>

          <button
            className={`${styles.actionBtn} ${styles.actionBtnTest}`}
            onClick={() => onTest(connection)}
            title="Testar"
            disabled={connection.status !== 'connected'}
          >
            <MessageSquareText size={14} /> Testar
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => onReconnect(connection)}
            title="Reconectar"
            style={{ display: connection.status === 'connected' ? 'none' : undefined }}
          >
            <RefreshCcw size={14} /> Reconectar
          </button>

          <button className={styles.actionBtn} onClick={() => onEdit(connection)} title="Editar">
            <Pencil size={14} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => onDelete(connection)}
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
