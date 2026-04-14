'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, AlertTriangle, Calendar as CalendarIcon, Clock, Plus, ExternalLink, X, Save, User as UserIcon, Calendar, Sparkles, Trash2 } from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { apiFetch, apiRequest } from '@/lib/api/client';

import styles from './AgendamentosPage.module.css';

interface Contato {
  id: string;
  nome: string;
  avatar_url?: string;
  whatsapp: string;
}

interface Agendamento {
  id: string;
  contato_id: string;
  titulo: string;
  descricao: string;
  data_hora: string;
  data_hora_fim?: string;
  status: 'pendente' | 'confirmado' | 'cancelado';
}

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }
  },
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

export default function AgendamentosPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Modal form states
  const [formTitulo, setFormTitulo] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formTime, setFormTime] = useState('');
  const [formDuration, setFormDuration] = useState(60); // Default 60 minutes
  const [formContato, setFormContato] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showContactResults, setShowContactResults] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [agendamentoToDelete, setAgendamentoToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; email: string | null }>({ connected: false, email: null });


  // Fetch data on month change
  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    if (initialLoading) setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const profileId = session.user.id;

      // 1. Fetch contatos do profile (só no início)
      if (contatos.length === 0) {
        const { data: contatosData } = await supabase
          .from('contatos')
          .select('*')
          .eq('profile_id', profileId);
        if (contatosData) setContatos(contatosData);
      }

      // 2. Fetch agendamentos (Agora via backend)
      const response = await apiFetch('/agendamentos', { userId: profileId });

      if (response.ok) {
        const agendamentosAPI = await response.json();

        // Filtra pro mês no frontend ou o backend pode filtrar depois
        // Por ora, vamos filtrar o range localmente p/ manter o comp num estado enxuto
        const inicioMes = startOfMonth(currentDate);
        const fimMes = endOfMonth(currentDate);

        const filtered = agendamentosAPI.filter((a: any) => {
          const d = new Date(a.data_hora);
          return d >= inicioMes && d <= fimMes;
        });

        setAgendamentos(filtered);
      } else {
        console.error('Erro na API:', await response.text());
      }

      // 3. Fetch Google Status para saber se as integrações estão ativas para este perfil
      if (initialLoading) {
        const googleRes = await apiFetch('/google/status', { userId: profileId });
        if (googleRes.ok) {
          const gStatus = await googleRes.json();
          setGoogleStatus(gStatus);
        }
      }

    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      if (initialLoading) {
        setLoading(false);
        setInitialLoading(false);
      }
    }
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const daysInMonth = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setFormTime('');
  };

  const closeNovoAgendamentoModal = () => {
    setIsModalOpen(false);
    setFormStep(1);
    setFormTitulo('');
    setFormContato('');
    setSearchTerm('');
  };

  const handleDeleteAgendamento = async () => {
    if (!agendamentoToDelete) return;
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await apiRequest(`/agendamentos/${agendamentoToDelete}`, {
        method: 'DELETE',
        userId: session.user.id,
      });

      setAgendamentos(prev => prev.filter(a => a.id !== agendamentoToDelete));
      toast.success('Agendamento excluído com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir agendamento.');
    } finally {
      setIsDeleting(false);
      setAgendamentoToDelete(null);
    }
  };

  const openNewEventModal = () => {
    setFormTitulo('');
    setFormContato('');
    setSearchTerm('');
    setFormDate(format(selectedDate, 'yyyy-MM-dd'));
    setFormTime('');
    setFormDuration(60);
    setIsModalOpen(true);
  };

  const checkCollision = (start: Date, end: Date) => {
    return agendamentos.some(a => {
      if (a.status === 'cancelado') return false;
      const existingStart = new Date(a.data_hora).getTime();
      const existingEnd = a.data_hora_fim
        ? new Date(a.data_hora_fim).getTime()
        : existingStart + (60 * 60 * 1000);

      const newStart = start.getTime();
      const newEnd = end.getTime();

      return (newStart < existingEnd && newEnd > existingStart);
    });
  };

  const handleSaveNovoAgendamento = async () => {
    if (formStep === 1) return;
    if (!formTitulo || !formContato) {
      toast.error('Preencha os dados do contato e título.');
      return;
    }
    if (!formDate || !formTime) {
      toast.error('Selecione uma data e horário válidos.');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const profileId = session.user.id;

      const [hours, minutes] = formTime.split(':').map(Number);
      const [year, month, day] = formDate.split('-').map(Number);

      const newDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      const endDateTime = new Date(newDateTime.getTime() + formDuration * 60 * 1000);

      // Verificação de Frontend (Optimistic)
      if (checkCollision(newDateTime, endDateTime)) {
        toast.error('Ops! Já existe um agendamento neste horário. Por favor, escolha outro momento.');
        return;
      }

      const novo = {
        contato_id: formContato,
        titulo: formTitulo,
        data_hora: newDateTime.toISOString(),
        data_hora_fim: endDateTime.toISOString(),
        status: 'pendente'
      };

      const response = await apiFetch('/agendamentos', {
        method: 'POST',
        userId: profileId,
        body: novo,
      });

      if (!response.ok) {
        let errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        if (response.status === 409 || (errorData.message && errorData.message.includes('Conflito'))) {
          toast.error('O banco de dados recusou: Este horário já está ocupado por outro evento!');
          return;
        }
        if (response.status === 502 || (errorData.message && errorData.message.includes('Google Calendar'))) {
          toast.error('Não foi possível criar o evento no Google Calendar. Verifique sua integração e tente novamente.');
          return;
        }
        throw new Error(errorData.message || 'Falha na requisição');
      }

      const savedAgendamento = await response.json();

      if (savedAgendamento) {
        setAgendamentos((prev) => [...prev, savedAgendamento]);
        toast.success('Agendamento criado com sucesso!');
        closeNovoAgendamentoModal();
      }
    } catch (err: any) {
      console.error('Erro ao salvar agendamento:', err);
      toast.error('Falha ao salvar agendamento. Verifique sua conexão.');
    }
  };

  const filteredContatos = useMemo(() => {
    if (!searchTerm) return [];
    return contatos
      .filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 2);
  }, [contatos, searchTerm]);

  const dayEvents = agendamentos
    .filter(a => isSameDay(new Date(a.data_hora), selectedDate))
    .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

  return (
    <motion.div
      className={styles.pageWrapper}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.header className={styles.pageHeader}>
        <div>
          <h1>Agendamentos</h1>
          <p>Organize suas chamadas e integrações com seus contatos de forma automatizada.</p>
        </div>
        <motion.button
          className={styles.addButton}
          onClick={openNewEventModal}
        >
          <Plus size={18} />
          <span>Novo Agendamento</span>
        </motion.button>
      </motion.header>

      <div className={styles.contentGrid}>
        <div className={`${styles.glassPanel} ${styles.calendarPanel}`}>
          <div className={styles.panelHeader}>
            <h2><CalendarIcon size={20} /> Calendário</h2>
            <div className={styles.calendarNav}>
              <button onClick={handlePrevMonth}><ChevronLeft size={18} /></button>
              <h3>{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</h3>
              <button onClick={handleNextMonth}><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className={styles.calendarScroll}>
            <div className={styles.calendarHeader}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                <div key={dia}>{dia}</div>
              ))}
            </div>

            <div className={styles.calendarGrid}>
              {daysInMonth.map((day, idx) => {
                const events = agendamentos.filter(a => isSameDay(new Date(a.data_hora), day));
                const isOtherMonth = !isSameMonth(day, currentDate);
                const isDiaAtual = isToday(day);
                const isSelected = isSameDay(day, selectedDate);

                return (
                  <div
                    key={idx}
                    className={`${styles.dayCell} ${isOtherMonth ? styles.otherMonth : ''} ${isDiaAtual ? styles.today : ''}`}
                    style={isSelected ? { background: 'var(--gradient-surface)' } : {}}
                    onClick={() => handleDayClick(day)}
                  >
                    <span className={styles.dayNumber}>{format(day, 'd')}</span>
                    {events.length > 0 && (
                      <div className={styles.eventIndicators}>
                        {events.slice(0, 3).map(e => (
                          <div key={e.id} className={styles.eventDot} />
                        ))}
                        {events.length > 3 && <span className={styles.moreEvents}>+</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.rightColumn}>
          <div className={`${styles.glassPanel} ${styles.rightPanelHalf}`}>
            <div className={styles.panelHeader}>
              <h2>Compromissos do Dia</h2>
            </div>

            <div className={styles.nextEventsList} style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div className={styles.emptyEvents}>Carregando...</div>
              ) : dayEvents.length === 0 ? (
                <div className={styles.emptyEvents}>Nenhum agendamento neste dia.</div>
              ) : dayEvents.map(evt => {
                const contato = contatos.find(c => c.id === evt.contato_id);
                const d = new Date(evt.data_hora);

                return (
                  <div key={evt.id} className={styles.eventCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className={styles.eventTime}>
                        <Clock size={12} />
                        {format(d, "dd 'de' MMM, HH:mm", { locale: ptBR })}
                        {evt.data_hora_fim && ` - ${format(new Date(evt.data_hora_fim), "HH:mm")}`}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setAgendamentoToDelete(evt.id); }}
                        style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.7)', cursor: 'pointer', padding: '4px' }}
                        title="Excluir Agendamento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className={styles.eventTitle}>{evt.titulo}</div>

                    {contato && (
                      <div className={styles.eventContato}>
                        <div className={styles.eventContatoAvatar}>
                          {contato.avatar_url ? (
                            <img src={contato.avatar_url} alt="Avatar" />
                          ) : (
                            <UserIcon size={12} />
                          )}
                        </div>
                        <span className={styles.eventContatoName}>{contato.nome}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className={`${styles.googleAlert} ${!initialLoading && googleStatus.connected ? styles.googleAlertConnected : ''}`}>
            {initialLoading ? (
              <div className={styles.alertContent} style={{ flex: 1, justifyContent: 'center' }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  style={{ opacity: 0.7 }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" color="#FFF" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                  </svg>
                </motion.div>
                <span style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.7, color: '#FFF' }}>Verificando conexão...</span>
              </div>
            ) : googleStatus.connected ? (
              <div className={styles.alertContent} style={{ gap: '0.75rem' }}>
                <div className={styles.alertText}>
                  <h2 style={{ color: '#fff', fontSize: '1.1rem' }}>Google Calendar Ativo</h2>
                  <span style={{ fontSize: '0.82rem', opacity: 0.85 }}>
                    Conectado como<br />
                    <strong style={{ color: '#fff' }}>{googleStatus.email}</strong>
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.alertContent}>
                  <div className={styles.alertText}>
                    <h2>Integração Google Calendar</h2>
                    <span>Para melhorar sua experiência, conecte sua conta do Google.</span>
                  </div>
                </div>
                <Link href="/configuracoes?tab=integracoes" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <button className={styles.configBtn}>
                    Configurar Google Calendar <ExternalLink size={14} />
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)',
              padding: '1rem'
            }}
            onClick={closeNovoAgendamentoModal}
          >
            <motion.div
              style={{
                width: '100%', maxWidth: '520px',
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* PROGRESS BAR HEADER */}
              <div style={{ height: '4px', width: '100%', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <motion.div
                  animate={{ width: formStep === 1 ? '50%' : '100%' }}
                  style={{ height: '100%', background: theme.accent, boxShadow: `0 0 10px ${theme.accent}` }}
                />
              </div>

              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: theme.textMain, letterSpacing: '-0.025em', margin: 0 }}>
                      Novo Agendamento
                    </h2>
                    <p style={{ color: theme.textMuted, fontSize: '0.875rem', marginTop: '4px' }}>
                      {formStep === 1 ? 'Defina o objetivo e o contato' : 'Escolha a data e duração'}
                    </p>
                  </div>
                  <button
                    onClick={closeNovoAgendamentoModal}
                    style={{
                      padding: '8px', borderRadius: '12px', border: 'none',
                      backgroundColor: 'rgba(255,255,255,0.05)', color: theme.textMuted,
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={e => e.preventDefault()}>
                  <div style={{ minHeight: '320px' }}>
                    <AnimatePresence mode="wait">
                      {formStep === 1 ? (
                        <motion.div
                          key="step1"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              O que será agendado?
                            </label>
                            <input
                              type="text"
                              style={inputStyle}
                              placeholder="Ex: Reunião de Alinhamento"
                              value={formTitulo}
                              onChange={e => setFormTitulo(e.target.value)}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.accent, textTransform: 'uppercase' }}>
                              Com quem será?
                            </label>
                            <div style={{ position: 'relative' }}>
                              <UserIcon size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
                              <input
                                type="text"
                                style={{ ...inputStyle, paddingLeft: '40px' }}
                                placeholder="Buscar contato..."
                                value={searchTerm}
                                onChange={e => {
                                  setSearchTerm(e.target.value);
                                  setShowContactResults(true);
                                }}
                                onFocus={() => setShowContactResults(true)}
                              />

                              {showContactResults && searchTerm && (
                                <div style={dropdownStyle}>
                                  {filteredContatos.length > 0 ? (
                                    filteredContatos.map((c, i) => (
                                      <div
                                        key={c.id}
                                        onClick={() => {
                                          setFormContato(c.id);
                                          setSearchTerm(c.nome);
                                          setShowContactResults(false);
                                        }}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                                          cursor: 'pointer', borderRadius: '12px', transition: '0.2s',
                                          backgroundColor: formContato === c.id ? theme.accentMuted : 'transparent'
                                        }}
                                      >
                                        <div style={avatarStyle}>
                                          {c.avatar_url ? <img src={c.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : c.nome.charAt(0)}
                                        </div>
                                        <div>
                                          <div style={{ color: theme.textMain, fontWeight: 600, fontSize: '0.9rem' }}>{c.nome}</div>
                                          <div style={{ color: theme.textMuted, fontSize: '0.75rem' }}>{c.whatsapp}</div>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: theme.textMuted }}>Nenhum contato encontrado</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="step2"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={labelStyle}><Calendar size={14} /> Data</label>
                              <input type="date" style={inputStyle} value={formDate} onChange={e => setFormDate(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={labelStyle}><Clock size={14} /> Horário</label>
                              <input type="time" style={inputStyle} value={formTime} onChange={e => setFormTime(e.target.value)} />
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label style={labelStyle}>Duração do Compromisso</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {[15, 30, 45, 60, 90, 120].map((mins) => (
                                <button
                                  key={mins}
                                  type="button"
                                  onClick={() => setFormDuration(mins)}
                                  style={{
                                    padding: '10px 16px', borderRadius: '14px', border: '1px solid',
                                    borderColor: formDuration === mins ? theme.accent : theme.border,
                                    backgroundColor: formDuration === mins ? theme.accentMuted : 'rgba(255,255,255,0.02)',
                                    color: formDuration === mins ? theme.accent : theme.textMuted,
                                    cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s'
                                  }}
                                >
                                  {mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 || ''}` : `${mins}m`}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* FOOTER */}
                  <div style={{
                    marginTop: '32px', display: 'flex', gap: '12px',
                    paddingTop: '24px', borderTop: `1px solid ${theme.border}`
                  }}>
                    {formStep === 1 ? (
                      <>
                        <button type="button" onClick={closeNovoAgendamentoModal} style={btnSecondary}>Cancelar</button>
                        <button
                          type="button"
                          onClick={() => setFormStep(2)}
                          disabled={!formTitulo || !formContato}
                          style={{ ...btnPrimary, opacity: (!formTitulo || !formContato) ? 0.5 : 1 }}
                        >
                          Próximo passo <ChevronRight size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setFormStep(1)} style={btnSecondary}>
                          <ChevronLeft size={18} /> Voltar
                        </button>
                        <button type="button" onClick={handleSaveNovoAgendamento} style={btnPrimary}>
                          <Save size={18} /> Finalizar Agendamento
                        </button>
                      </>
                    )}
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {agendamentoToDelete && (
          <div 
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)',
              padding: '1rem'
            }}
          >
            <motion.div
              style={{
                width: '100%', maxWidth: '400px',
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', margin: '0 auto 16px auto' }}>
                  <Trash2 size={24} />
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Excluir agendamento?</h3>
                <p style={{ color: theme.textMuted, fontSize: '0.95rem', marginBottom: '24px', lineHeight: 1.5 }}>
                  Tem certeza que deseja desmarcar esse compromise? Se aplicável, ele também será removido do seu Google Calendar.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button disabled={isDeleting} onClick={() => setAgendamentoToDelete(null)} style={{ ...btnSecondary, flex: 1 }}>Cancelar</button>
                  <button disabled={isDeleting} onClick={handleDeleteAgendamento} style={{ ...btnPrimary, background: '#ef4444', flex: 1 }}>
                    {isDeleting ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

// --- SHARED INLINE STYLES ---
const theme = {
  bg: 'var(--color-surface)',
  card: 'var(--gradient-surface)',
  border: 'var(--color-border)',
  accent: 'var(--color-primary-light)',
  accentMuted: 'rgba(18, 105, 244, 0.15)',
  textMain: 'var(--color-text)',
  textMuted: 'var(--color-text-secondary)',
};

const inputStyle = {
  width: '100%', padding: '14px 16px', borderRadius: '16px',
  background: 'rgba(0, 0, 0, 0.2)', border: `1px solid ${theme.border}`,
  color: theme.textMain, fontSize: '1rem', outline: 'none', transition: 'all 0.2s',
  boxSizing: 'border-box' as const
};

const labelStyle = {
  fontSize: '0.75rem', fontWeight: 700, color: theme.accent,
  display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' as const
};

const dropdownStyle = {
  position: 'absolute' as const, top: '100%', left: 0, right: 0, zIndex: 10,
  marginTop: '8px', padding: '8px', background: 'var(--color-surface-elevated)',
  border: `1px solid ${theme.border}`, borderRadius: '16px',
  maxHeight: '200px', overflowY: 'auto' as const, boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
  boxSizing: 'border-box' as const
};

const avatarStyle = {
  width: '36px', height: '36px', borderRadius: '12px', overflow: 'hidden',
  background: theme.accentMuted, color: theme.accent,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 'bold', fontSize: '0.9rem'
};

const btnPrimary = {
  flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  padding: '14px', borderRadius: '16px', border: 'none',
  background: theme.accent, color: '#ffffff', fontWeight: 800,
  cursor: 'pointer', transition: 'all 0.2s'
};

const btnSecondary = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  padding: '14px', borderRadius: '16px', border: `1px solid ${theme.border}`,
  background: 'transparent', color: theme.textMuted, fontWeight: 600,
  cursor: 'pointer'
};
