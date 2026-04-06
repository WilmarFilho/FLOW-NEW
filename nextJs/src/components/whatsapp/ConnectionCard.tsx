'use client';

import { Bot, BookOpen, Pencil, RefreshCcw, Trash2, MessageSquareText } from 'lucide-react';
import styles from './WhatsappPage.module.css';

export interface WhatsappConnection {
  id: string;
  nome: string;
  numero: string;
  status: 'connected' | 'disconnected' | 'connecting';
  instance_name: string;
  agente_id: string | null;
  conhecimento_id: string | null;
  business_hours?: {
    timezone?: string;
    days?: Record<string, Array<{ start: string; end: string }>>;
  };
  appointment_slot_minutes?: number;
  agentes?: { id: string; nome: string; tipo_de_agente: string } | null;
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
  }[connection.status];

  const statusClass = {
    connected: styles.statusConnected,
    connecting: styles.statusConnecting,
    disconnected: styles.statusDisconnected,
  }[connection.status];

  const cardClass = {
    connected: styles.cardConnected,
    connecting: styles.cardConnecting,
    disconnected: styles.cardDisconnected,
  }[connection.status];
  const businessDays = Object.entries(connection.business_hours?.days || {}).filter(
    ([, windows]) => Array.isArray(windows) && windows.length > 0,
  ).length;

  return (
    <div className={`${styles.card} ${cardClass}`}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardName}>{connection.nome}</h3>
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
            {connection.agentes?.tipo_de_agente || connection.agentes?.nome || 'Nenhum'}
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

      <div className={styles.cardActions}>
        <button className={styles.actionBtn} onClick={() => onEdit(connection)} title="Editar">
          <Pencil size={14} /> Editar
        </button>
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
          disabled={connection.status === 'connecting'}
        >
          <RefreshCcw size={14} /> Reconectar
        </button>
        <button
          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
          onClick={() => onDelete(connection)}
          title="Excluir"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
