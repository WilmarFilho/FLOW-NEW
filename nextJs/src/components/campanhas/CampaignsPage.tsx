'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ListChecks,
  Play,
  Radio,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import useSWR from 'swr';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { apiRequest } from '@/lib/api/client';
import { cardEntrance, listStagger, pageEntrance, sectionEntrance, modalPop, overlayFade } from '@/lib/motion/variants';

type CampaignView = 'list' | 'create' | 'detail';
type CampaignStatus = 'draft' | 'running' | 'completed' | 'failed';
type RecipientStatus = 'pending' | 'sent' | 'failed';
type CreateStep = 0 | 1 | 2;
type PickerModalType = 'whatsapp' | 'lista' | 'source-connection' | null;

interface WhatsappConnection {
  id: string;
  nome: string;
  numero: string | null;
  status: 'connected' | 'connecting' | 'disconnected';
  cor?: string | null;
}

interface ContactList {
  id: string;
  nome: string;
  cor: string | null;
  cards?: Array<{ id: string }>;
}

interface CampaignRecipient {
  id: string;
  nome: string;
  whatsapp: string;
  avatar_url: string | null;
  mensagem_personalizada: string | null;
  status: RecipientStatus;
  error_message: string | null;
}

interface Campaign {
  id: string;
  nome: string;
  mensagem: string | null;
  contexto: string | null;
  source_type: 'lista' | 'connection';
  source_whatsapp_connection_id: string | null;
  status: CampaignStatus;
  total_contatos: number;
  enviados_com_sucesso: number;
  falhas: number;
  pendentes: number;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  created_at: string;
  whatsapp_connections: WhatsappConnection | null;
  contatos_listas: ContactList | null;
  source_whatsapp_connection?: WhatsappConnection | null;
}

interface CampaignDetail extends Campaign {
  destinatarios: CampaignRecipient[];
}

interface RefinedSelectOption {
  id: string;
  title: string;
  subtitle: string;
  accent?: string | null;
}

const stepPanelVariants = {
  hidden: { opacity: 0, x: 24, scale: 0.985 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: {
    opacity: 0,
    x: -24,
    scale: 0.985,
    transition: { duration: 0.18, ease: 'easeInOut' as const },
  },
};

const fetcher = async <T,>(path: string, userId: string): Promise<T> => {
  return apiRequest<T>(path, { userId });
};

const statusLabel: Record<CampaignStatus, string> = {
  draft: 'Rascunho',
  running: 'Em andamento',
  completed: 'Finalizada',
  failed: 'Falhou',
};

const recipientStatusLabel: Record<RecipientStatus, string> = {
  pending: 'Pendente',
  sent: 'Enviado',
  failed: 'Falhou',
};

function formatDate(value: string | null) {
  if (!value) return 'Ainda não iniciado';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getStatusClasses(status: CampaignStatus) {
  if (status === 'draft') return 'bg-[rgba(18,105,244,0.16)] text-[#dbe8ff]';
  if (status === 'running') return 'bg-[rgba(245,158,11,0.16)] text-[#fff0b3]';
  if (status === 'completed') return 'bg-[rgba(34,197,94,0.16)] text-[#d8ffe9]';
  return 'bg-[rgba(239,68,68,0.16)] text-[#ffd9d9]';
}

function getRecipientStatusClasses(status: RecipientStatus) {
  if (status === 'pending') return 'bg-[rgba(18,105,244,0.14)] text-[#dbe8ff]';
  if (status === 'sent') return 'bg-[rgba(34,197,94,0.16)] text-[#d8ffe9]';
  return 'bg-[rgba(239,68,68,0.16)] text-[#ffd9d9]';
}

function progressPercentage(campaign: Pick<Campaign, 'total_contatos' | 'pendentes'>) {
  if (!campaign.total_contatos) return 0;
  return Math.min(
    100,
    Math.round(((campaign.total_contatos - campaign.pendentes) / campaign.total_contatos) * 100),
  );
}

function RefinedSelect({
  label,
  placeholder,
  value,
  selectedOption,
  onOpen,
}: {
  label: string;
  placeholder: string;
  value: string;
  selectedOption: RefinedSelectOption | null;
  onOpen: () => void;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold text-white">{label}</label>
      <button
        type="button"
        className={`flex w-full items-center justify-between rounded-2xl border border-white/8 bg-[rgba(7,16,33,0.92)] px-4 py-[15px] text-left transition hover:border-white/12 hover:bg-[rgba(10,20,38,0.98)] ${value ? 'shadow-[0_0_0_1px_rgba(255,255,255,0.04)]' : ''
          }`}
        onClick={onOpen}
      >
        <div className="min-w-0">
          {selectedOption ? (
            <>
              <span className="block truncate text-sm font-semibold text-white">{selectedOption.title}</span>
              <span className="mt-1 block truncate text-[12px] text-white/45">{selectedOption.subtitle}</span>
            </>
          ) : (
            <span className="block text-sm text-white/45">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={18} className="shrink-0 text-white/45" />
      </button>
    </div>
  );
}

function SelectionModal({
  isOpen,
  title,
  subtitle,
  options,
  value,
  emptyMessage,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  title: string;
  subtitle: string;
  options: RefinedSelectOption[];
  value: string;
  emptyMessage: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter((option) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return (
      option.title.toLowerCase().includes(query) ||
      option.subtitle.toLowerCase().includes(query)
    );
  });

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,7,16,0.72)] p-4 backdrop-blur-md"
          variants={overlayFade}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[min(82vh,760px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,16,31,0.98)_0%,rgba(5,10,20,1)_100%)] shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
            variants={modalPop}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-white/6 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="m-0 text-[24px] text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/55">{subtitle}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/55 transition hover:bg-white/10 hover:text-white"
                  onClick={onClose}
                >
                  <ArrowLeft size={18} />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <Search size={16} className="text-white/35" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="scrollbar-none grid max-h-full gap-3 overflow-auto p-5">
              {filteredOptions.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-white/8 px-4 py-10 text-center text-sm text-white/35">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = option.id === value;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onSelect(option.id);
                        onClose();
                      }}
                      className={`flex items-start justify-between gap-3 rounded-[22px] border px-4 py-4 text-left transition ${isSelected
                        ? 'border-[rgba(242,228,22,0.18)] bg-[rgba(242,228,22,0.08)]'
                        : 'border-white/6 bg-white/4 hover:border-white/12 hover:bg-white/8'
                        }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: option.accent || '#1269f4' }}
                        />
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white">{option.title}</span>
                          <span className="mt-1 block text-[12px] leading-5 text-white/45">
                            {option.subtitle}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <CheckCircle2 size={18} className="shrink-0 text-[var(--color-secondary)]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(modalContent, document.body);
}

export default function CampaignsPage() {
  const [userId, setUserId] = useState('');
  const [view, setView] = useState<CampaignView>('list');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>(0);
  const [pickerModal, setPickerModal] = useState<PickerModalType>(null);
  const [formData, setFormData] = useState({
    nome: '',
    whatsapp_connection_id: '',
    source_type: 'lista' as 'lista' | 'connection',
    lista_id: '',
    source_whatsapp_connection_id: '',
    contexto: '',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const campaignsKey = userId ? ['campanhas', userId] : null;
  const detailKey = userId && selectedCampaignId ? ['campanhas', 'detail', selectedCampaignId, userId] : null;
  const connectionsKey = userId ? ['campanhas', 'connections', userId] : null;
  const listsKey = userId ? ['campanhas', 'lists', userId] : null;

  const { data: campaigns = [], isLoading: isLoadingCampaigns, mutate: mutateCampaigns } = useSWR<Campaign[]>(
    campaignsKey,
    ([, uid]) => fetcher<Campaign[]>('/campanhas', uid),
    { revalidateOnFocus: false },
  );

  const { data: campaignDetail, isLoading: isLoadingDetail, mutate: mutateDetail } = useSWR<CampaignDetail>(
    detailKey,
    ([, , campaignId, uid]) => fetcher<CampaignDetail>(`/campanhas/${campaignId}`, uid),
    { revalidateOnFocus: false },
  );

  const { data: connections = [] } = useSWR<WhatsappConnection[]>(
    connectionsKey,
    ([, , uid]) => fetcher<WhatsappConnection[]>('/whatsapp?includeDeleted=all', uid),
    { revalidateOnFocus: false },
  );

  const { data: lists = [] } = useSWR<ContactList[]>(
    listsKey,
    ([, , uid]) => fetcher<ContactList[]>('/contatos/listas', uid),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`campanhas-realtime-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campanhas' },
        (payload) => {
          const record = (payload.new || payload.old) as { profile_id?: string; id?: string } | null;
          if (record?.profile_id && record.profile_id !== userId) return;
          mutateCampaigns();
          if (selectedCampaignId && record?.id === selectedCampaignId) mutateDetail();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campanhas_destinatarios' },
        (payload) => {
          const record = (payload.new || payload.old) as { campanha_id?: string } | null;
          if (selectedCampaignId && record?.campanha_id === selectedCampaignId) mutateDetail();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutateCampaigns, mutateDetail, selectedCampaignId, userId]);

  const connectedConnections = useMemo(
    () => connections.filter((connection) => connection.status === 'connected'),
    [connections],
  );

  const totalRecipients = campaigns.reduce((acc, campaign) => acc + campaign.total_contatos, 0);
  const totalRunning = campaigns.filter((campaign) => campaign.status === 'running').length;
  const totalCompleted = campaigns.filter((campaign) => campaign.status === 'completed').length;

  const connectionOptions: RefinedSelectOption[] = connectedConnections.map((connection) => ({
    id: connection.id,
    title: connection.nome,
    subtitle: connection.numero ? `Número conectado: ${connection.numero}` : 'Conexão pronta para disparo',
    accent: connection.cor || '#22c55e',
  }));

  const audienceConnectionOptions: RefinedSelectOption[] = connections.map((connection) => ({
    id: connection.id,
    title: connection.nome,
    subtitle: connection.numero
      ? `Contatos com conversas nesse número: ${connection.numero}`
      : 'Usar todos os contatos que já conversaram nessa conexão',
    accent: connection.cor || '#22c55e',
  }));

  const listOptions: RefinedSelectOption[] = lists.map((list) => ({
    id: list.id,
    title: list.nome,
    subtitle: `${list.cards?.length || 0} contato(s) disponíveis`,
    accent: list.cor || '#1269f4',
  }));

  const selectedConnection = connectedConnections.find(
    (connection) => connection.id === formData.whatsapp_connection_id,
  );
  const selectedSourceConnection = connections.find(
    (connection) => connection.id === formData.source_whatsapp_connection_id,
  );
  const selectedList = lists.find((list) => list.id === formData.lista_id);
  const selectedConnectionOption =
    connectionOptions.find((option) => option.id === formData.whatsapp_connection_id) ?? null;
  const selectedListOption =
    listOptions.find((option) => option.id === formData.lista_id) ?? null;
  const selectedSourceConnectionOption =
    audienceConnectionOptions.find(
      (option) => option.id === formData.source_whatsapp_connection_id,
    ) ?? null;

  const openCreate = () => {
    startTransition(() => {
      setSelectedCampaignId(null);
      setCreateStep(0);
      setPickerModal(null);
      setView('create');
    });
  };

  const openList = () => {
    startTransition(() => {
      setSelectedCampaignId(null);
      setPickerModal(null);
      setView('list');
    });
  };

  const openDetail = (campaignId: string) => {
    startTransition(() => {
      setSelectedCampaignId(campaignId);
      setView('detail');
    });
  };

  const handleCreateCampaign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId) return;

    const hasAudience =
      formData.source_type === 'lista'
        ? Boolean(formData.lista_id)
        : Boolean(formData.source_whatsapp_connection_id);

    if (!formData.nome.trim() || !formData.whatsapp_connection_id || !hasAudience || !formData.contexto.trim()) {
      toast.error('Preencha nome, WhatsApp, origem do público e contexto para continuar.');
      return;
    }

    setIsCreating(true);

    try {
      const createdCampaign = await apiRequest<CampaignDetail>('/campanhas', {
        method: 'POST',
        userId,
        body: {
          nome: formData.nome.trim(),
          contexto: formData.contexto.trim(),
          source_type: formData.source_type,
          lista_id: formData.source_type === 'lista' ? formData.lista_id : undefined,
          source_whatsapp_connection_id:
            formData.source_type === 'connection'
              ? formData.source_whatsapp_connection_id
              : undefined,
          whatsapp_connection_id: formData.whatsapp_connection_id,
        },
      });

      setFormData({
        nome: '',
        whatsapp_connection_id: '',
        source_type: 'lista',
        lista_id: '',
        source_whatsapp_connection_id: '',
        contexto: '',
      });
      setCreateStep(0);

      toast.success('Campanha criada com sucesso. Agora você já pode iniciar o disparo.');
      await mutateCampaigns();
      openDetail(createdCampaign.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar campanha.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartCampaign = async () => {
    if (!userId || !campaignDetail) return;

    setIsStarting(true);

    try {
      await apiRequest(`/campanhas/${campaignDetail.id}/start`, {
        method: 'POST',
        userId,
      });

      toast.success('Campanha iniciada. O progresso será atualizado automaticamente.');
      await Promise.all([mutateCampaigns(), mutateDetail()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao iniciar campanha.');
    } finally {
      setIsStarting(false);
    }
  };

  const canAdvanceFromStepOne = formData.nome.trim().length >= 3;
  const canAdvanceFromStepTwo =
    Boolean(formData.whatsapp_connection_id) &&
    (formData.source_type === 'lista'
      ? Boolean(formData.lista_id)
      : Boolean(formData.source_whatsapp_connection_id));
  const canSubmitCampaign = Boolean(formData.contexto.trim()) && canAdvanceFromStepOne && canAdvanceFromStepTwo;

  return (
    <motion.div
      className="flex flex-1 min-h-0 flex-col gap-5"
      variants={pageEntrance}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-[clamp(30px,4vw,38px)] leading-[1.05] text-white">Campanhas</h1>
          <p className="mt-2.5 max-w-[760px] text-[15px] leading-7 text-white/55 text-wrap-balance">
            Monte campanhas com listas de contatos e dispare mensagens dinâmicas pelo WhatsApp conectado.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          {view !== 'list' && (
            <button
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              onClick={openList}
            >
              <ArrowLeft size={18} />
              Voltar para listagem
            </button>
          )}
          {view !== 'create' && (
            <button
              className="inline-flex cursor-pointer min-h-[50px] items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#ffe664_0%,var(--color-secondary)_100%)] px-5 font-bold text-[var(--color-aux-black)] shadow-[0_16px_32px_rgba(242,228,22,0.18)] transition hover:-translate-y-0.5"
              onClick={openCreate}
            >
              <Send size={18} />
              Nova campanha
            </button>
          )}
        </div>
      </div>

      <section className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(18, 105, 244, 0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(242,228,22,0.05),transparent_28%),linear-gradient(180deg,rgba(8, 16, 31, 1)_0%,rgba(5, 10, 20, 1)_100%)] shadow-[var(--shadow-elevated)]">
        <AnimatePresence initial={false}>
          {view !== 'create' && view !== 'detail' && (
            <motion.div
              key="campaign-metrics"
              className="grid grid-cols-1 gap-3 p-[18px] md:grid-cols-3"
              variants={sectionEntrance}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div
                className="rounded-[20px] border border-white/8 bg-white/5 p-[18px] backdrop-blur-xl"
                variants={cardEntrance}
              >
                <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">Campanhas</span>
                <strong className="mt-2 block text-[clamp(24px,3vw,32px)] font-extrabold text-white">{campaigns.length}</strong>
                <span className="mt-1.5 block text-[13px] text-white/55">Rascunhos e disparos no mesmo painel</span>
              </motion.div>
              <motion.div
                className="rounded-[20px] border border-white/8 bg-white/5 p-[18px] backdrop-blur-xl"
                variants={cardEntrance}
              >
                <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">Em andamento</span>
                <strong className="mt-2 block text-[clamp(24px,3vw,32px)] font-extrabold text-white">{totalRunning}</strong>
                <span className="mt-1.5 block text-[13px] text-white/55">Atualização dinâmica via realtime</span>
              </motion.div>
              <motion.div
                className="rounded-[20px] border border-white/8 bg-white/5 p-[18px] backdrop-blur-xl"
                variants={cardEntrance}
              >
                <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">Destinatários</span>
                <strong className="mt-2 block text-[clamp(24px,3vw,32px)] font-extrabold text-white">{totalRecipients}</strong>
                <span className="mt-1.5 block text-[13px] text-white/55">{totalCompleted} campanha(s) finalizada(s)</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-[18px]">
          <AnimatePresence mode="wait" initial={false}>
            {view === 'list' && (
              <motion.div
                key="campaigns-list"
                className="scrollbar-none flex flex-1 min-h-0 flex-col overflow-auto pr-1"
                variants={sectionEntrance}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {isLoadingCampaigns ? (
                  <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 text-white/55">
                    <div className="h-[34px] w-[34px] animate-spin rounded-full border-[3px] border-white/15 border-t-[var(--color-secondary)]" />
                    <span>Carregando campanhas...</span>
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 px-7 text-center">
                    <div className="grid h-[82px] w-[82px] place-items-center rounded-full border border-white/8 bg-[radial-gradient(circle_at_30%_30%,rgba(242,228,22,0.28),transparent_55%),rgba(255,255,255,0.05)] text-white">
                      <Radio size={34} />
                    </div>
                    <h2 className="m-0 text-[28px] text-white">Nenhuma campanha criada ainda</h2>

                    <button
                      className="inline-flex cursor-pointer min-h-[50px] items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#ffe664_0%,var(--color-secondary)_100%)] px-5 font-bold text-[var(--color-aux-black)] shadow-[0_16px_32px_rgba(242,228,22,0.18)] transition hover:-translate-y-0.5"
                      onClick={openCreate}
                    >
                      <Send size={18} />
                      Criar primeira campanha
                    </button>
                  </div>
                ) : (
                  <motion.div
                    className="scrollbar-none grid min-h-0 grid-cols-1 gap-4 overflow-visible pr-1 xl:grid-cols-2"
                    variants={listStagger}
                    initial="hidden"
                    animate="visible"
                  >
                    {campaigns.map((campaign) => (
                      <motion.article
                        key={campaign.id}
                        className="relative flex min-h-[300px] flex-col gap-[18px] overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.02)_100%)] p-[22px]"
                        variants={cardEntrance}
                        whileHover={{ y: -4, scale: 1.01 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h2 className="m-0 text-[21px] leading-7 text-white">{campaign.nome}</h2>
                            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-white/55">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1.5 text-[12px] font-bold text-white/70">
                                <Radio size={12} />
                                {campaign.whatsapp_connections?.nome || 'WhatsApp não encontrado'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1.5 text-[12px] font-bold text-white/70">
                                <ListChecks size={12} />
                                {campaign.contatos_listas?.nome || 'Lista não encontrada'}
                              </span>
                            </div>
                          </div>

                          <span className={`inline-flex items-center rounded-full px-3 py-2 text-[12px] font-bold uppercase ${getStatusClasses(campaign.status)}`}>
                            {statusLabel[campaign.status]}
                          </span>
                        </div>

                        <p className="m-0 line-clamp-4 text-[14px] leading-7 text-white/55">
                          {campaign.contexto || campaign.mensagem || 'Campanha sem contexto registrado.'}
                        </p>

                        <div className="flex flex-col gap-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-white/55">
                            <span>{progressPercentage(campaign)}% processado</span>
                            <span>
                              {campaign.enviados_com_sucesso} enviados · {campaign.falhas} falhas · {campaign.pendentes} pendentes
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary-light)_0%,var(--color-secondary)_100%)]"
                              style={{ width: `${progressPercentage(campaign)}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                          <span className="text-[13px] text-white/35">{formatDate(campaign.created_at)}</span>
                          <button
                            className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-white/8 px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/12"
                            onClick={() => openDetail(campaign.id)}
                          >
                            Ver detalhes
                          </button>
                        </div>
                      </motion.article>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {view === 'create' && (
              <motion.div
                key="campaigns-create"
                className="scrollbar-none grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto pr-1 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]"
                variants={sectionEntrance}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <motion.form
                  className="flex min-h-0 max-h-full flex-col gap-[18px] overflow-hidden rounded-[24px] border border-white/8 bg-white/5 p-[22px] backdrop-blur-xl"
                  onSubmit={handleCreateCampaign}
                  variants={cardEntrance}
                >
                  <div>
                    <h2 className="m-0 text-[22px] text-white">Criar campanha</h2>
                    <p className="mt-2 text-[14px] leading-6 text-white/55">
                      Preencha por etapas para manter o fluxo mais leve e organizado.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { step: 0, title: 'Identidade', hint: 'Nome interno' },
                      { step: 1, title: 'Origem', hint: 'WhatsApp e lista' },
                      { step: 2, title: 'Contexto', hint: 'Base para personalização' },
                    ].map((item) => {
                      const isActive = createStep === item.step;

                      return (
                        <button
                          key={item.step}
                          type="button"
                          onClick={() => setCreateStep(item.step as CreateStep)}
                          className={`rounded-[18px] border px-4 py-3 text-left transition ${isActive
                            ? 'border-[rgba(242,228,22,0.22)] bg-[rgba(242,228,22,0.08)]'
                            : 'border-white/8 bg-white/4 hover:border-white/12 hover:bg-white/8'
                            }`}
                        >

                          <strong className="block text-sm text-white">{item.title}</strong>
                          <span className="mt-1 block text-[12px] text-white/45">{item.hint}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="scrollbar-none min-h-0 flex-1 overflow-auto pr-1">
                    <AnimatePresence mode="wait" initial={false}>
                      {createStep === 0 && (
                        <motion.div
                          key="create-step-0"
                          className="grid gap-4"
                          variants={stepPanelVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                        >
                          <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                            <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">Etapa 1</span>
                            <h3 className="mt-3 text-[20px] text-white">Como essa campanha será identificada?</h3>
                            <p className="mt-2 text-sm leading-6 text-white/55">
                              Escolha um nome claro para facilitar localização, análise de resultado e futuras reativações.
                            </p>
                          </div>

                          <div className="grid gap-2">
                            <label htmlFor="campaign-name" className="text-sm font-bold text-white">
                              Nome da campanha
                            </label>
                            <input
                              id="campaign-name"
                              className="w-full rounded-2xl border border-white/8 bg-[rgba(7,16,33,0.92)] px-4 py-[15px] text-sm text-white outline-none transition focus:border-[rgba(242,228,22,0.35)] focus:shadow-[0_0_0_4px_rgba(242,228,22,0.08)]"
                              placeholder="Ex: Reativação de leads quentes"
                              value={formData.nome}
                              onChange={(event) => setFormData((current) => ({ ...current, nome: event.target.value }))}
                              maxLength={90}
                            />

                          </div>
                        </motion.div>
                      )}

                      {createStep === 1 && (
                        <motion.div
                          key="create-step-1"
                          className="grid gap-4"
                          variants={stepPanelVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                        >
                          <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                            <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">Etapa 2</span>
                            <h3 className="mt-3 text-[20px] text-white">Defina a origem do disparo</h3>
                            <p className="mt-2 text-sm leading-6 text-white/55">
                              Escolha por qual WhatsApp a campanha vai sair e de onde virá o público: por lista ou por uma conexão com histórico de conversas.
                            </p>
                          </div>

                          <RefinedSelect
                            label="WhatsApp conectado"
                            placeholder="Selecione uma conexão ativa"
                            value={formData.whatsapp_connection_id}
                            selectedOption={selectedConnectionOption}
                            onOpen={() => setPickerModal('whatsapp')}
                          />

                          <div className="grid gap-3">
                            <div className="grid gap-2">
                              <span className="text-sm font-bold text-white">Origem do público</span>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {[
                                  {
                                    id: 'lista' as const,
                                    title: 'Usar uma lista',
                                    description: 'Dispara para os contatos já organizados em uma lista.',
                                  },
                                  {
                                    id: 'connection' as const,
                                    title: 'Usar uma conexão',
                                    description: 'Dispara para todos os contatos que já conversaram nesse WhatsApp.',
                                  },
                                ].map((option) => {
                                  const isActive = formData.source_type === option.id;
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() =>
                                        setFormData((current) => ({
                                          ...current,
                                          source_type: option.id,
                                          lista_id: option.id === 'lista' ? current.lista_id : '',
                                          source_whatsapp_connection_id:
                                            option.id === 'connection'
                                              ? current.source_whatsapp_connection_id
                                              : '',
                                        }))
                                      }
                                      className={`rounded-[20px] border px-4 py-4 text-left transition ${isActive
                                        ? 'border-[rgba(242,228,22,0.22)] bg-[rgba(242,228,22,0.08)]'
                                        : 'border-white/8 bg-white/4 hover:border-white/12 hover:bg-white/6'
                                        }`}
                                    >
                                      <strong className="block text-[15px] text-white">{option.title}</strong>
                                      <p className="mt-2 text-[13px] leading-6 text-white/55">{option.description}</p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {formData.source_type === 'lista' ? (
                              <RefinedSelect
                                label="Lista de contatos"
                                placeholder="Escolha a lista que será usada"
                                value={formData.lista_id}
                                selectedOption={selectedListOption}
                                onOpen={() => setPickerModal('lista')}
                              />
                            ) : (
                              <RefinedSelect
                                label="Conexão de origem do público"
                                placeholder="Escolha a conexão cujos contatos serão usados"
                                value={formData.source_whatsapp_connection_id}
                                selectedOption={selectedSourceConnectionOption}
                                onOpen={() => setPickerModal('source-connection')}
                              />
                            )}
                          </div>
                        </motion.div>
                      )}

                      {createStep === 2 && (
                        <motion.div
                          key="create-step-2"
                          className="grid gap-4"
                          variants={stepPanelVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                        >
                          <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                            <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">Etapa 3</span>
                            <h3 className="mt-3 text-[20px] text-white">Descreva o contexto da campanha</h3>
                            <p className="mt-2 text-sm leading-6 text-white/55">
                              Em vez de uma mensagem fixa, vamos usar esse contexto junto com as últimas conversas de cada contato para gerar mensagens personalizadas.
                            </p>
                          </div>

                          <div className="grid gap-2">
                            <label htmlFor="campaign-context" className="text-sm font-bold text-white">
                              Contexto da campanha
                            </label>
                            <textarea
                              id="campaign-context"
                              className="scrollbar-none scrollbar-track-transparent min-h-[140px] w-full resize-y rounded-2xl border border-white/8 bg-[rgba(7,16,33,0.92)] px-4 py-[15px] text-sm leading-7 text-white outline-none transition focus:border-[rgba(242,228,22,0.35)] focus:shadow-[0_0_0_4px_rgba(242,228,22,0.08)]"
                              placeholder="Ex: Campanha de Páscoa com foco em aumentar vendas nesta época. Quero uma abordagem calorosa, consultiva e natural. Considere preferências, interesses ou produtos mencionados, sem soar invasivo."
                              value={formData.contexto}
                              onChange={(event) => setFormData((current) => ({ ...current, contexto: event.target.value }))}
                              maxLength={3000}
                            />
                            <span className="text-[12px] text-white/45">{formData.contexto.length}/3000 caracteres</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="mt-1 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                      <button
                        type="button"
                        className="inline-flex min-h-[46px] items-center justify-center rounded-[14px] border border-white/10 bg-transparent px-4 text-sm font-semibold text-white/65 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
                        onClick={createStep === 0 ? openList : () => setCreateStep((current) => Math.max(0, current - 1) as CreateStep)}
                      >
                        {createStep === 0 ? 'Cancelar' : 'Voltar'}
                      </button>
                    </div>

                    {createStep < 2 ? (
                      <button
                        type="button"
                        className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#ffe664_0%,var(--color-secondary)_100%)] px-5 font-bold text-[var(--color-aux-black)] shadow-[0_16px_32px_rgba(242,228,22,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:transform-none"
                        disabled={(createStep === 0 && !canAdvanceFromStepOne) || (createStep === 1 && !canAdvanceFromStepTwo)}
                        onClick={() => setCreateStep((current) => Math.min(2, current + 1) as CreateStep)}
                      >
                        Avançar
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#ffe664_0%,var(--color-secondary)_100%)] px-5 font-bold text-[var(--color-aux-black)] shadow-[0_16px_32px_rgba(242,228,22,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:transform-none"
                        disabled={isCreating || !canSubmitCampaign}
                      >
                        <Send size={18} />
                        {isCreating ? 'Criando campanha...' : 'Salvar campanha'}
                      </button>
                    )}
                  </div>
                </motion.form>

                <motion.aside
                  className="flex min-h-0 flex-col gap-[18px] rounded-[24px] border border-white/8 bg-white/5 p-[22px] backdrop-blur-xl"
                  variants={cardEntrance}
                >
                  <div>
                    <h2 className="m-0 text-[22px] text-white">Pré-visualização</h2>
                    <p className="mt-2 text-[14px] leading-6 text-white/55">
                      Confira a conexão de envio, a origem do público e a geração dinâmica antes de salvar o rascunho.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-[20px] border border-white/8 bg-white/5 p-4">
                      <strong className="block text-[15px] text-white">
                        {selectedConnection?.nome || 'WhatsApp ainda não selecionado'}
                      </strong>
                      <p className="mt-2 text-[13px] leading-6 text-white/55">
                        {selectedConnection
                          ? `Disparo sairá por ${selectedConnection.numero || 'essa conexão ativa'}.`
                          : 'Conexão para habilitar o disparo quando a campanha for iniciada.'}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/8 bg-white/5 p-4">
                      <strong className="block text-[15px] text-white">
                        {formData.source_type === 'lista'
                          ? selectedList?.nome || 'Lista ainda não selecionada'
                          : selectedSourceConnection?.nome || 'Conexão de público ainda não selecionada'}
                      </strong>
                      <p className="mt-2 text-[13px] leading-6 text-white/55">
                        {formData.source_type === 'lista'
                          ? selectedList
                            ? `A lista atual possui ${selectedList.cards?.length || 0} contato(s) vinculados.`
                            : 'Lista de contatos que será base da campanha no momento da criação.'
                          : selectedSourceConnection
                            ? 'Vamos usar todos os contatos que já tiveram conversas nessa conexão.'
                            : 'Conexão cuja base de conversas será usada como público da campanha.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-white/55">
                    <span>{formData.nome.trim() || 'Novo rascunho de campanha'}</span>
                    <span>{formData.contexto.length} caracteres</span>
                  </div>

                  <div className="rounded-[22px_22px_22px_10px] bg-[linear-gradient(135deg,rgba(18,105,244,0.24)_0%,rgba(12,67,157,0.45)_100%)] p-[18px] text-white">
                    <p className="m-0 whitespace-pre-wrap break-words text-sm leading-7 text-balance ">
                      {formData.contexto.trim() || 'O contexto da campanha aparecerá aqui. Cada destinatário recebe uma mensagem personalizada com base no briefing e no histórico recente da conversa.'}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/8 bg-white/5 p-4">
                    <strong className="block text-[15px] text-white">Fluxo da operação</strong>
                    <p className="mt-2 text-[13px] leading-6 text-white/55">
                      Primeiro você salva o rascunho. Depois, na tela de detalhes, inicia o envio. Para cada contato, vamos combinar o briefing com as últimas conversas dele para gerar a mensagem final.
                    </p>
                  </div>
                </motion.aside>
              </motion.div>
            )}

            {view === 'detail' && (
              <motion.div
                key="campaigns-detail"
                className="scrollbar-none flex flex-1 min-h-0 flex-col overflow-auto pr-1"
                variants={sectionEntrance}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {isLoadingDetail || !campaignDetail ? (
                  <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 text-white/55">
                    <div className="h-[34px] w-[34px] animate-spin rounded-full border-[3px] border-white/15 border-t-[var(--color-secondary)]" />
                    <span>Carregando detalhes da campanha...</span>
                  </div>
                ) : (
                  <motion.div
                    className="grid min-h-0 flex-1 grid-cols-1 gap-4"
                    variants={listStagger}
                    initial="hidden"
                    animate="visible"
                  >
                    <motion.div
                      className="flex fit-content flex-col gap-[18px] rounded-[24px] border border-white/8 bg-white/5 p-[22px] backdrop-blur-xl"
                      variants={cardEntrance}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="m-0 text-[22px] text-white">{campaignDetail.nome}</h2>
                          <p className="mt-2 text-[14px] leading-6 text-white/55">
                            Rascunho, execução e histórico concentrados em um só lugar.
                          </p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-3 py-2 text-[12px] font-bold uppercase ${getStatusClasses(campaignDetail.status)}`}>
                          {statusLabel[campaignDetail.status]}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        {[
                          ['Total', campaignDetail.total_contatos],
                          ['Enviados', campaignDetail.enviados_com_sucesso],
                          ['Falhas', campaignDetail.falhas],
                          ['Pendentes', campaignDetail.pendentes],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-[20px] border border-white/8 bg-white/5 p-4">
                            <span className="block text-[12px] uppercase tracking-[0.06em] text-white/35">{label}</span>
                            <strong className="mt-2 block text-[28px] text-white">{value}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-white/55">
                          <span>{progressPercentage(campaignDetail)}% do lote processado</span>
                          <span>
                            {campaignDetail.status === 'running'
                              ? 'Disparo em execução assíncrona'
                              : campaignDetail.status === 'draft'
                                ? 'Pronta para iniciar'
                                : 'Processamento encerrado'}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary-light)_0%,var(--color-secondary)_100%)]"
                            style={{ width: `${progressPercentage(campaignDetail)}%` }}
                          />
                        </div>
                      </div>

                      {campaignDetail.last_error && (
                        <div className="rounded-[20px] border border-white/8 bg-white/5 p-4">
                          <strong className="block text-[15px] text-white">Último retorno</strong>
                          <p className="mt-2 text-[13px] leading-6 text-white/55">{campaignDetail.last_error}</p>
                        </div>
                      )}
                    </motion.div>

                    <motion.div
                      className="w-full rounded-[20px] border border-white/8 bg-white/5 p-[18px]"
                      variants={cardEntrance}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="m-0 text-[18px] text-white">Ação principal</h3>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1.5 text-[12px] font-bold text-white/70">
                          <CheckCircle2 size={12} />
                          Processo assíncrono
                        </span>
                      </div>

                      <p className="mb-4 text-[14px] leading-6 text-white/55">
                        Após iniciar, o envio segue em segundo plano no backend. Esta tela continua recebendo os updates por realtime.
                      </p>

                      <button
                        className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#f7ef66_0%,var(--color-secondary)_100%)] px-5 font-bold text-[var(--color-aux-black)] shadow-[0_16px_28px_rgba(242,228,22,0.12)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:transform-none"
                        onClick={handleStartCampaign}
                        disabled={campaignDetail.status !== 'draft' || isStarting}
                      >
                        <Play size={18} />
                        {campaignDetail.status === 'draft'
                          ? isStarting
                            ? 'Iniciando campanha...'
                            : 'Começar campanha'
                          : campaignDetail.status === 'running'
                            ? 'Campanha em andamento'
                            : 'Campanha já processada'}
                      </button>
                    </motion.div>

                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                      <div className="flex min-h-[630px] flex-col gap-4">
                        <motion.div
                          className="rounded-[20px] border border-white/8 bg-white/5 p-[18px]"
                          variants={cardEntrance}
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="m-0 text-[18px] text-white">Contexto da campanha</h3>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1.5 text-[12px] font-bold text-white/70">
                              <Send size={12} />
                              Base para geração dinâmica
                            </span>
                          </div>
                          <p className="m-0 whitespace-pre-wrap break-words text-sm leading-8 text-white">
                            {campaignDetail.contexto || campaignDetail.mensagem || 'Sem contexto registrado.'}
                          </p>
                        </motion.div>

                        <motion.div
                          className="flex min-h-[500px] flex-col rounded-[20px] border border-white/8 bg-white/5 p-[18px]"
                          variants={cardEntrance}
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="m-0 text-[18px] text-white">Destinatários</h3>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1.5 text-[12px] font-bold text-white/70">
                              <Users size={12} />
                              {campaignDetail.destinatarios.length} contatos
                            </span>
                          </div>

                          <div className="scrollbar-none grid min-h-0 gap-3 overflow-auto pr-1">
                            {campaignDetail.destinatarios.map((recipient) => (
                              <div
                                key={recipient.id}
                                className="flex flex-col gap-3 rounded-[20px] border border-white/8 bg-white/5 p-4 md:flex-row md:items-start md:justify-between"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  {recipient.avatar_url ? (
                                    <Image
                                      className="h-[42px] w-[42px] shrink-0 rounded-full object-cover"
                                      src={recipient.avatar_url}
                                      alt={recipient.nome}
                                      width={42}
                                      height={42}
                                    />
                                  ) : (
                                    <div className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-[rgba(18,105,244,0.18)] font-extrabold text-white">
                                      {recipient.nome.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <strong className="block truncate text-sm text-white">{recipient.nome}</strong>
                                    <span className="mt-1 block text-[13px] text-white/55">{recipient.whatsapp}</span>
                                    {recipient.mensagem_personalizada && (
                                      <p className="mt-2 rounded-[16px] border border-white/8 bg-white/5 px-3 py-2 text-[12px] leading-6 text-white/72">
                                        {recipient.mensagem_personalizada}
                                      </p>
                                    )}
                                    {recipient.error_message && (
                                      <span className="mt-1 block text-[12px] leading-5 text-[#ffb2b2]">
                                        {recipient.error_message}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <span className={`inline-flex items-center rounded-full px-3 py-2 text-[11px] font-bold uppercase ${getRecipientStatusClasses(recipient.status)}`}>
                                  {recipientStatusLabel[recipient.status]}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      </div>

                      <aside className="flex min-h-0 flex-col gap-4">
                        <motion.div
                          className="rounded-[20px] border border-white/8 bg-white/5 p-[18px]"
                          variants={cardEntrance}
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="m-0 text-[18px] text-white">Execução</h3>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1.5 text-[12px] font-bold text-white/70">
                              <Clock3 size={12} />
                              Tempo real
                            </span>
                          </div>

                          <div className="grid gap-3">
                            {[
                              ['WhatsApp', campaignDetail.whatsapp_connections?.nome || 'Não encontrado'],
                              [
                                'Origem do público',
                                campaignDetail.source_type === 'connection'
                                  ? campaignDetail.source_whatsapp_connection?.nome || 'Conexão não encontrada'
                                  : campaignDetail.contatos_listas?.nome || 'Lista não encontrada',
                              ],
                              ['Criada em', formatDate(campaignDetail.created_at)],
                              ['Iniciada em', formatDate(campaignDetail.started_at)],
                              ['Finalizada em', campaignDetail.completed_at ? formatDate(campaignDetail.completed_at) : 'Ainda processando'],
                            ].map(([label, value]) => (
                              <div key={label} className="flex flex-col gap-1 border-b border-white/6 pb-3 last:border-b-0 last:pb-0">
                                <span className="text-[13px] text-white/35">{label}</span>
                                <strong className="text-sm leading-6 text-white">{value}</strong>
                              </div>
                            ))}
                          </div>
                        </motion.div>


                      </aside>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <SelectionModal
        isOpen={pickerModal === 'whatsapp'}
        title="Escolher WhatsApp"
        subtitle="Selecione a conexão conectada e ativa que será usada no disparo."
        options={connectionOptions}
        value={formData.whatsapp_connection_id}
        emptyMessage="Nenhuma conexão ativa encontrada."
        onClose={() => setPickerModal(null)}
        onSelect={(value) =>
          setFormData((current) => ({ ...current, whatsapp_connection_id: value }))
        }
      />

      <SelectionModal
        isOpen={pickerModal === 'lista'}
        title="Escolher lista"
        subtitle="Selecione a lista de contatos que será congelada como base desta campanha."
        options={listOptions}
        value={formData.lista_id}
        emptyMessage="Nenhuma lista disponível para selecionar."
        onClose={() => setPickerModal(null)}
        onSelect={(value) =>
          setFormData((current) => ({ ...current, lista_id: value }))
        }
      />

      <SelectionModal
        isOpen={pickerModal === 'source-connection'}
        title="Escolher conexão de público"
        subtitle="Selecione a conexão cujos contatos com conversas serão usados como público desta campanha."
        options={audienceConnectionOptions}
        value={formData.source_whatsapp_connection_id}
        emptyMessage="Nenhuma conexão disponível para usar como origem do público."
        onClose={() => setPickerModal(null)}
        onSelect={(value) =>
          setFormData((current) => ({ ...current, source_whatsapp_connection_id: value }))
        }
      />
    </motion.div>
  );
}
