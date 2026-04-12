'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, QrCode, Smartphone, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import SearchablePicker from './SearchablePicker';
import styles from './WhatsappPage.module.css';
import type { WhatsappConnection } from './ConnectionCard';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editMode?: boolean;
  reconnectMode?: boolean;
  connection?: WhatsappConnection | null;
  agentes: { id: string; nome: string; descricao?: string }[];
  conhecimentos: { id: string; titulo: string }[];
  onSubmit: (data: {
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
  }) => Promise<{ qrCode?: string | null; pairingCode?: string | null; connectionId?: string | null } | null>;
  onUpdate: (
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
  ) => Promise<void>;
  onCancelConnection: (connectionId: string) => Promise<void>;
  onReconnect?: (
    connectionId: string,
  ) => Promise<{ qrCode?: string | null; pairingCode?: string | null; connectionId?: string | null } | null>;
}

type BusinessHours = {
  timezone?: string;
  days?: Record<string, Array<{ start: string; end: string }>>;
};

type ModalStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const CONNECTION_COLOR_OPTIONS = [
  '#22c55e',
  '#3b82f6',
  '#f97316',
  '#eab308',
  '#ef4444',
  '#a855f7',
  '#14b8a6',
  '#ec4899',
];

const WEEKDAY_OPTIONS = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terca' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sabado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

const SLOT_OPTIONS = [30, 45, 60, 90];

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: 'America/Sao_Paulo',
  days: {
    monday: [{ start: '09:00', end: '18:00' }],
    tuesday: [{ start: '09:00', end: '18:00' }],
    wednesday: [{ start: '09:00', end: '18:00' }],
    thursday: [{ start: '09:00', end: '18:00' }],
    friday: [{ start: '09:00', end: '18:00' }],
  },
};

function cloneBusinessHours(source?: BusinessHours | null): BusinessHours {
  const origin = source?.days ? source : DEFAULT_BUSINESS_HOURS;

  return {
    timezone: origin.timezone || 'America/Sao_Paulo',
    days: Object.fromEntries(
      Object.entries(origin.days || {}).map(([day, windows]) => [
        day,
        Array.isArray(windows)
          ? windows.map((window) => ({
            start: window.start || '09:00',
            end: window.end || '18:00',
          }))
          : [],
      ]),
    ),
  };
}

function getInitialStep(editMode?: boolean): ModalStep {
  return editMode ? 2 : 1;
}

export default function ConnectionModal({
  isOpen,
  onClose,
  editMode,
  reconnectMode,
  connection,
  agentes,
  conhecimentos,
  onSubmit,
  onUpdate,
  onCancelConnection,
  onReconnect,
}: ConnectionModalProps) {
  const [step, setStep] = useState<ModalStep>(getInitialStep(editMode));
  const [useQR, setUseQR] = useState(true);
  const [nome, setNome] = useState(connection?.nome || '');
  const [cor, setCor] = useState(connection?.cor || CONNECTION_COLOR_OPTIONS[0]);
  const [numero, setNumero] = useState(connection?.numero || '');
  const [agenteId, setAgenteId] = useState(connection?.agente_id || '');
  const [conhecimentoId, setConhecimentoId] = useState(connection?.conhecimento_id || '');
  const [appointmentSlotMinutes, setAppointmentSlotMinutes] = useState(
    connection?.appointment_slot_minutes || 60,
  );
  const [businessHours, setBusinessHours] = useState<BusinessHours>(
    cloneBusinessHours(connection?.business_hours),
  );
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setStep(reconnectMode ? 6 : getInitialStep(editMode));
    setUseQR(true);
    setNome(connection?.nome || '');
    setCor(connection?.cor || CONNECTION_COLOR_OPTIONS[0]);
    setNumero(connection?.numero || '');
    setAgenteId(connection?.agente_id || '');
    setConhecimentoId(connection?.conhecimento_id || '');
    setAppointmentSlotMinutes(connection?.appointment_slot_minutes || 60);
    setBusinessHours(cloneBusinessHours(connection?.business_hours));
    setQrCode(null);
    setPairingCode(null);
    setPendingConnectionId(reconnectMode ? connection?.id || null : null);
    setIsConnected(false);
    setIsLoading(Boolean(reconnectMode));
    setError('');
  }, [connection, editMode, isOpen, reconnectMode]);

  useEffect(() => {
    if (!isOpen || !reconnectMode || !connection?.id || !onReconnect) {
      return;
    }

    let cancelled = false;

    const runReconnect = async () => {
      setIsLoading(true);
      setError('');
      setStep(6);
      setPendingConnectionId(connection.id);

      try {
        const result = await onReconnect(connection.id);

        if (cancelled) {
          return;
        }

        setQrCode(result?.qrCode || null);
        setPairingCode(result?.pairingCode || null);
        setPendingConnectionId(result?.connectionId || connection.id);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao reconectar conexao.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void runReconnect();

    return () => {
      cancelled = true;
    };
  }, [connection?.id, isOpen, onReconnect, reconnectMode]);

  useEffect(() => {
    if (!pendingConnectionId || step !== 6) {
      return;
    }

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
          const updated = payload.new as { id?: string; status?: string } | null;
          if (updated?.id === pendingConnectionId && updated.status === 'connected') {
            setIsConnected(true);
            setStep(7);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingConnectionId, step]);

  const stepMeta = useMemo(() => {
    if (step === 7) {
      return {
        description: 'A conexao ja esta pronta para receber mensagens e automacoes.',
        title: 'Conectado!',
      };
    }

    if (step === 6) {
      return {
        description: reconnectMode
          ? 'Escaneie o novo QR Code para reconectar esta instancia.'
          : 'Finalize o pareamento no WhatsApp para ativar esta conexao.',
        title: reconnectMode ? 'Reconectar WhatsApp' : 'Conecte seu WhatsApp',
      };
    }

    if (step === 5) {
      return {
        description: 'Defina em quais horarios a IA pode oferecer agendamentos e qual duracao usar em cada opcao sugerida.',
        title: 'Agenda automatica',
      };
    }

    if (editMode) {
      return {
        description: 'Revise os dados desta conexao e ajuste o comportamento da automacao.',
        title: 'Editar Conexao',
      };
    }

    if (step === 1) {
      return {
        description: 'Escolha como deseja vincular esta nova conexao do WhatsApp.',
        title: 'Nova Conexao',
      };
    }

    return {
      description: 'Complete os proximos passos para conectar e preparar o atendimento.',
      title: 'Configurar Conexao',
    };
  }, [editMode, reconnectMode, step]);

  const visibleSteps = editMode ? [2, 3, 4, 5] : [1, 2, 3, 4, 5];
  const businessDaysConfigured = WEEKDAY_OPTIONS.filter(
    (day) => (businessHours.days?.[day.key] || []).length > 0,
  ).length;

  if (!isOpen) {
    return null;
  }

  const handleChooseMethod = (method: 'qr' | 'code') => {
    setUseQR(method === 'qr');
    setError('');
    setStep(2);
  };

  const resetLocalState = () => {
    setStep(getInitialStep(editMode));
    setUseQR(true);
    setNome('');
    setCor(CONNECTION_COLOR_OPTIONS[0]);
    setNumero('');
    setAgenteId('');
    setConhecimentoId('');
    setAppointmentSlotMinutes(60);
    setBusinessHours(cloneBusinessHours());
    setQrCode(null);
    setPairingCode(null);
    setPendingConnectionId(null);
    setIsConnected(false);
    setIsLoading(false);
    setError('');
  };

  const handleClose = async () => {
    if (step === 6 && pendingConnectionId && !isConnected && !reconnectMode) {
      try {
        await onCancelConnection(pendingConnectionId);
      } catch {
        // Mantemos o fechamento mesmo se a limpeza falhar.
      }
    }

    resetLocalState();
    onClose();
  };

  const handleBack = () => {
    setError('');

    if (editMode) {
      if (step <= 2) {
        void handleClose();
        return;
      }

      setStep((current) => (current > 2 ? ((current - 1) as ModalStep) : current));
      return;
    }

    if (step <= 1) {
      void handleClose();
      return;
    }

    setStep((current) => ((current - 1) as ModalStep));
  };

  const validateIdentificationStep = () => {
    if (!nome.trim()) {
      setError('Informe o nome da conexao.');
      return false;
    }

    if (!editMode && !useQR && !numero.trim()) {
      setError('Informe o numero do WhatsApp para pareamento.');
      return false;
    }

    setError('');
    return true;
  };

  const updateDayWindow = (dayKey: string, field: 'start' | 'end', value: string) => {
    setBusinessHours((current) => {
      const currentDay = current.days?.[dayKey]?.[0] || { start: '09:00', end: '18:00' };
      return {
        ...current,
        days: {
          ...(current.days || {}),
          [dayKey]: [{ ...currentDay, [field]: value }],
        },
      };
    });
  };

  const toggleBusinessDay = (dayKey: string) => {
    setBusinessHours((current) => {
      const enabled = (current.days?.[dayKey] || []).length > 0;
      const currentDay = current.days?.[dayKey]?.[0] || { start: '09:00', end: '18:00' };

      return {
        ...current,
        days: {
          ...(current.days || {}),
          [dayKey]: enabled ? [] : [currentDay],
        },
      };
    });
  };

  const handleAdvanceFromIdentification = () => {
    if (!validateIdentificationStep()) {
      return;
    }

    setStep(3);
  };

  const handleFormSubmit = async () => {
    if (!validateIdentificationStep()) {
      setStep(2);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (editMode && connection) {
        await onUpdate(connection.id, {
          nome: nome.trim(),
          cor,
          agente_id: agenteId || undefined,
          conhecimento_id: conhecimentoId || undefined,
          business_hours: businessHours,
          appointment_slot_minutes: appointmentSlotMinutes,
        });
        await handleClose();
        return;
      }

      const result = await onSubmit({
        nome: nome.trim(),
        cor,
        numero: !useQR ? numero.trim() : undefined,
        agente_id: agenteId || undefined,
        conhecimento_id: conhecimentoId || undefined,
        business_hours: businessHours,
        appointment_slot_minutes: appointmentSlotMinutes,
        useQR,
      });

      if (result) {
        setQrCode(result.qrCode || null);
        setPairingCode(result.pairingCode || null);
        setPendingConnectionId(result.connectionId || null);
        setStep(6);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar conexao.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={() => void handleClose()}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleBlock}>
            <h2 className={styles.modalTitle}>{stepMeta.title}</h2>
            <p className={styles.modalSubtitle}>{stepMeta.description}</p>
          </div>
          <button className={styles.modalCloseBtn} onClick={() => void handleClose()}>
            <X size={20} />
          </button>
        </div>

        {step <= 5 && (
          <div className={styles.modalProgress}>
            {visibleSteps.map((progressStep) => {
              const active = progressStep === step;
              const completed = progressStep < step;

              return (
                <div
                  key={progressStep}
                  className={`${styles.progressDot} ${active ? styles.progressDotActive : ''} ${completed ? styles.progressDotCompleted : ''}`}
                />
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className={styles.stepChoices}>
            <button
              type="button"
              className={styles.choiceCard}
              onClick={() => handleChooseMethod('qr')}
            >
              <div className={styles.choiceIcon}>
                <QrCode size={24} color="#fff" />
              </div>
              <div className={styles.choiceContent}>
                <h3>Conectar via QR Code</h3>
                <p>Escaneie o QR diretamente no WhatsApp do estabelecimento.</p>
              </div>
            </button>

            <button
              type="button"
              className={styles.choiceCard}
              onClick={() => handleChooseMethod('code')}
            >
              <div className={styles.choiceIcon}>
                <Smartphone size={24} color="#fff" />
              </div>
              <div className={styles.choiceContent}>
                <h3>Conectar via codigo</h3>
                <p>Informe o numero e use um codigo de pareamento mais rapido.</p>
              </div>
            </button>
          </div>
        )}

        {step === 2 && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome da conexao</label>
              <input
                className={styles.formInput}
                type="text"
                placeholder="Ex: WhatsApp Vendas"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cor da conexao</label>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {CONNECTION_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCor(option)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      border:
                        cor === option
                          ? '2px solid rgba(255,255,255,0.92)'
                          : '1px solid rgba(255,255,255,0.14)',
                      backgroundColor: option,
                      boxShadow:
                        cor === option
                          ? '0 0 0 3px rgba(255,255,255,0.08)'
                          : 'none',
                    }}
                    aria-label={`Selecionar cor ${option}`}
                  />
                ))}
              </div>
            </div>

            {!editMode && !useQR && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Numero do WhatsApp</label>
                <input
                  className={styles.formInput}
                  type="text"
                  placeholder="Ex: 5511999999999"
                  value={numero}
                  onChange={(event) => setNumero(event.target.value)}
                  inputMode="numeric"
                />
                <span className={styles.formHint}>
                  Use codigo do pais + DDD + numero, sem espacos ou tracos.
                </span>
              </div>
            )}

            {error && <p className={styles.formError}>{error}</p>}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={handleBack}>
                {editMode ? 'Cancelar' : 'Voltar'}
              </button>
              <button className={styles.submitBtn} onClick={handleAdvanceFromIdentification}>
                Avancar
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Agente IA</label>
              <p className={styles.stepHelper}>
                Vincule um agente para dar direcionamento ao atendimento desta conexao.
              </p>
              <SearchablePicker
                value={agenteId}
                onChange={setAgenteId}
                placeholder="Buscar agente..."
                options={agentes.map((agente) => ({
                  id: agente.id,
                  title: agente.nome,
                  subtitle: agente.descricao || 'Agente de IA',
                }))}
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={handleBack}>
                Voltar
              </button>
              <button className={styles.submitBtn} onClick={() => setStep(4)}>
                Avancar
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Base de conhecimento</label>
              <p className={styles.stepHelper}>
                Adicione a base usada pela IA para responder e detectar gatilhos do negocio.
              </p>
              <SearchablePicker
                value={conhecimentoId}
                onChange={setConhecimentoId}
                placeholder="Buscar base de conhecimento..."
                options={conhecimentos.map((conhecimento) => ({
                  id: conhecimento.id,
                  title: conhecimento.titulo,
                }))}
              />
            </div>

            {error && <p className={styles.formError}>{error}</p>}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={handleBack} disabled={isLoading}>
                Voltar
              </button>
              <button className={styles.submitBtn} onClick={() => setStep(5)} disabled={isLoading}>
                Avancar
              </button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <div className={styles.scheduleSummary}>
              <div className={styles.scheduleSummaryItem}>
                <span className={styles.scheduleSummaryLabel}>Dias ativos</span>
                <strong>{businessDaysConfigured}</strong>
              </div>
              <div className={styles.scheduleSummaryItem}>
                <span className={styles.scheduleSummaryLabel}>Slots</span>
                <strong>{appointmentSlotMinutes} min</strong>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Horario aberto do estabelecimento</label>
              <p className={styles.stepHelper}>
                Estes horarios servem para a IA saber quando ela pode oferecer opcoes de agendamento ao cliente. Isso nao limita as respostas da IA: ela continua respondendo mensagens 24 horas por dia.
              </p>

              <div className={styles.businessHoursGrid}>
                {WEEKDAY_OPTIONS.map((day) => {
                  const enabled = (businessHours.days?.[day.key] || []).length > 0;
                  const currentDay = businessHours.days?.[day.key]?.[0] || {
                    start: '09:00',
                    end: '18:00',
                  };

                  return (
                    <div key={day.key} className={styles.businessDayRow}>
                      <button
                        type="button"
                        className={`${styles.businessDayToggle} ${enabled ? styles.businessDayToggleActive : ''}`}
                        onClick={() => toggleBusinessDay(day.key)}
                      >
                        {day.label}
                      </button>

                      <div className={styles.businessTimeFields}>
                        <input
                          className={styles.formInput}
                          type="time"
                          disabled={!enabled}
                          value={currentDay.start}
                          onChange={(event) => updateDayWindow(day.key, 'start', event.target.value)}
                        />
                        <span className={styles.businessTimeSeparator}>as</span>
                        <input
                          className={styles.formInput}
                          type="time"
                          disabled={!enabled}
                          value={currentDay.end}
                          onChange={(event) => updateDayWindow(day.key, 'end', event.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Duracao padrao dos slots</label>
              <p className={styles.stepHelper}>
                Esse tempo define o tamanho de cada horario que a IA pode sugerir ao marcar um atendimento, reuniao ou visita.
              </p>
              <div className={styles.slotOptions}>
                {SLOT_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={`${styles.slotChip} ${appointmentSlotMinutes === minutes ? styles.slotChipActive : ''}`}
                    onClick={() => setAppointmentSlotMinutes(minutes)}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </div>

            {error && <p className={styles.formError}>{error}</p>}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={handleBack} disabled={isLoading}>
                Voltar
              </button>
              <button className={styles.submitBtn} onClick={handleFormSubmit} disabled={isLoading}>
                {isLoading ? 'Processando...' : editMode ? 'Salvar alteracoes' : 'Gerar conexao'}
              </button>
            </div>
          </>
        )}

        {step === 6 && (
          <div className={styles.qrContainer}>
            <p className={styles.qrInstructions}>
              Abra o WhatsApp, entre em dispositivos vinculados e confirme este pareamento.
            </p>

            {error && <p className={styles.formError}>{error}</p>}

            {isLoading && (
              <p className={styles.waitingText}>
                <span className={styles.spinner} />
                Gerando novo pareamento...
              </p>
            )}

            {qrCode && <img src={qrCode} alt="QR Code" className={styles.qrImage} />}

            {pairingCode && (
              <div className={styles.pairingCodeBox}>
                <p>Insira este codigo de pareamento no seu WhatsApp:</p>
                <span className={styles.pairingCodeValue}>{pairingCode}</span>
              </div>
            )}

            {!isLoading && !error && (
              <p className={styles.waitingText}>
                <span className={styles.spinner} />
                Aguardando conexao. Esta tela sera atualizada automaticamente.
              </p>
            )}
          </div>
        )}

        {step === 7 && (
          <div className={styles.qrContainer}>
            <div className={styles.successBadge}>
              <CheckCircle size={40} color="#4ade80" />
            </div>
            <h3 className={styles.successTitle}>WhatsApp conectado com sucesso</h3>
            <p className={styles.successText}>
              Sua conexao <strong>{nome}</strong> esta pronta para uso.
            </p>
            <button className={styles.submitBtn} onClick={() => void handleClose()}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
