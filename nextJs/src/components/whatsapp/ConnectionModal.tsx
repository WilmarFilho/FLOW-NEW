'use client';

import { useState, useEffect } from 'react';
import { X, QrCode, Smartphone, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import CustomSelect from './CustomSelect';
import styles from './WhatsappPage.module.css';
import type { WhatsappConnection } from './ConnectionCard';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editMode?: boolean;
  connection?: WhatsappConnection | null;
  agentes: { id: string; nome: string; tipo_de_agente: string }[];
  conhecimentos: { id: string; titulo: string }[];
  onSubmit: (data: {
    nome: string;
    numero?: string;
    agente_id?: string;
    conhecimento_id?: string;
    useQR: boolean;
  }) => Promise<{ qrCode?: string | null; pairingCode?: string | null; connectionId?: string | null } | null>;
  onUpdate: (id: string, data: { nome?: string; agente_id?: string; conhecimento_id?: string }) => Promise<void>;
  onCancelConnection: (connectionId: string) => Promise<void>;
}

export default function ConnectionModal({
  isOpen,
  onClose,
  editMode,
  connection,
  agentes,
  conhecimentos,
  onSubmit,
  onUpdate,
  onCancelConnection,
}: ConnectionModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(editMode ? 2 : 1);
  const [useQR, setUseQR] = useState(true);
  const [nome, setNome] = useState(connection?.nome || '');
  const [numero, setNumero] = useState(connection?.numero || '');
  const [agenteId, setAgenteId] = useState(connection?.agente_id || '');
  const [conhecimentoId, setConhecimentoId] = useState(connection?.conhecimento_id || '');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset all state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(editMode ? 2 : 1);
      setUseQR(true);
      setNome(connection?.nome || '');
      setNumero(connection?.numero || '');
      setAgenteId(connection?.agente_id || '');
      setConhecimentoId(connection?.conhecimento_id || '');
      setQrCode(null);
      setPairingCode(null);
      setPendingConnectionId(null);
      setIsConnected(false);
      setIsLoading(false);
      setError('');
    }
  }, [isOpen, editMode, connection]);

  // Realtime: escuta mudança de status da conexão pendente
  useEffect(() => {
    if (!pendingConnectionId || step !== 3) return;

    const channel = supabase
      .channel(`modal-connection-${pendingConnectionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_connections',
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.id === pendingConnectionId && updated.status === 'connected') {
            setIsConnected(true);
            setStep(4); // Step de sucesso
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingConnectionId, step]);

  if (!isOpen) return null;

  const handleChooseMethod = (method: 'qr' | 'code') => {
    setUseQR(method === 'qr');
    setStep(2);
  };

  const handleClose = async () => {
    // Se está no step 3 (aguardando conexão) e NÃO conectou, deletar a conexão fantasma
    if (step === 3 && pendingConnectionId && !isConnected) {
      try {
        await onCancelConnection(pendingConnectionId);
      } catch {
        // Silently fail — modal closes anyway
      }
    }

    // Reset completo
    setStep(1);
    setUseQR(true);
    setNome('');
    setNumero('');
    setAgenteId('');
    setConhecimentoId('');
    setQrCode(null);
    setPairingCode(null);
    setPendingConnectionId(null);
    setIsConnected(false);
    setIsLoading(false);
    setError('');
    onClose();
  };

  const handleFormSubmit = async () => {
    if (!nome.trim()) {
      setError('Informe o nome da conexão');
      return;
    }

    if (!useQR && !numero.trim()) {
      setError('Informe o número do WhatsApp para pareamento');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      if (editMode && connection) {
        await onUpdate(connection.id, {
          nome,
          agente_id: agenteId || undefined,
          conhecimento_id: conhecimentoId || undefined,
        });
        handleClose();
      } else {
        const result = await onSubmit({
          nome,
          numero: !useQR ? numero : undefined,
          agente_id: agenteId || undefined,
          conhecimento_id: conhecimentoId || undefined,
          useQR,
        });

        if (result) {
          setQrCode(result.qrCode || null);
          setPairingCode(result.pairingCode || null);
          setPendingConnectionId(result.connectionId || null);
          setStep(3);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar conexão');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {step === 4
              ? 'Conectado!'
              : editMode
                ? 'Editar Conexão'
                : step === 3
                  ? 'Conecte seu WhatsApp'
                  : 'Nova Conexão'}
          </h2>
          <button className={styles.modalCloseBtn} onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Step 1 — Escolha do método */}
        {step === 1 && (
          <div className={styles.stepChoices}>
            <div className={styles.choiceCard} onClick={() => handleChooseMethod('qr')}>
              <div className={styles.choiceIcon}>
                <QrCode size={24} color="#fff" />
              </div>
              <div className={styles.choiceContent}>
                <h3>Conectar via QR Code</h3>
                <p>Escaneie o código QR com seu WhatsApp</p>
              </div>
            </div>

            <div className={styles.choiceCard} onClick={() => handleChooseMethod('code')}>
              <div className={styles.choiceIcon}>
                <Smartphone size={24} color="#fff" />
              </div>
              <div className={styles.choiceContent}>
                <h3>Conectar via Código</h3>
                <p>Insira o número e receba um código de pareamento</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Formulário */}
        {step === 2 && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome da Conexão</label>
              <input
                className={styles.formInput}
                type="text"
                placeholder="Ex: WhatsApp Vendas"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            {!editMode && !useQR && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Número do WhatsApp</label>
                <input
                  className={styles.formInput}
                  type="text"
                  placeholder="Ex: 5511999999999"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  inputMode="numeric"
                />
                <span className={styles.formHint}>
                  Código do país + DDD + número (sem espaços ou traços)
                </span>
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Agente IA (opcional)</label>
              <CustomSelect
                value={agenteId}
                onChange={setAgenteId}
                placeholder="Nenhum agente"
                searchable={agentes.length > 5}
                options={[
                  { value: '', label: 'Nenhum agente' },
                  ...agentes.map((a) => ({
                    value: a.id,
                    label: a.nome,
                    sublabel: a.tipo_de_agente,
                  })),
                ]}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Base de Conhecimento (opcional)</label>
              <CustomSelect
                value={conhecimentoId}
                onChange={setConhecimentoId}
                placeholder="Nenhum conhecimento"
                searchable={conhecimentos.length > 5}
                options={[
                  { value: '', label: 'Nenhum conhecimento' },
                  ...conhecimentos.map((c) => ({
                    value: c.id,
                    label: c.titulo,
                  })),
                ]}
              />
            </div>

            {error && <p className={styles.formError}>{error}</p>}

            <button
              className={styles.submitBtn}
              onClick={handleFormSubmit}
              disabled={isLoading}
            >
              {isLoading ? 'Processando...' : editMode ? 'Salvar Alterações' : 'Gerar Conexão'}
            </button>
          </>
        )}

        {/* Step 3 — QR Code ou Pairing Code */}
        {step === 3 && (
          <div className={styles.qrContainer}>
            {qrCode && (
              <>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' }}>
                  Abra o WhatsApp → Configurações → Dispositivos vinculados → Vincular dispositivo
                </p>
                <img src={qrCode} alt="QR Code" className={styles.qrImage} />
              </>
            )}

            {pairingCode && (
              <div className={styles.pairingCodeBox}>
                <p>Insira este código de pareamento no seu WhatsApp:</p>
                <span className={styles.pairingCodeValue}>{pairingCode}</span>
              </div>
            )}

            <p className={styles.waitingText}>
              <span className={styles.spinner} />
              Aguardando conexão... A tela será atualizada automaticamente.
            </p>
          </div>
        )}

        {/* Step 4 — Sucesso */}
        {step === 4 && (
          <div className={styles.qrContainer}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CheckCircle size={40} color="#4ade80" />
            </div>
            <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 600, margin: '8px 0 4px' }}>
              WhatsApp conectado com sucesso!
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' }}>
              Sua conexão <strong style={{ color: '#fff' }}>{nome}</strong> está pronta para uso.
            </p>
            <button
              className={styles.submitBtn}
              onClick={handleClose}
              style={{ marginTop: 16 }}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
