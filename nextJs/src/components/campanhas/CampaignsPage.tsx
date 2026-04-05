'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, CheckCircle2, Clock3, ListChecks, Play, Radio, Send, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type CampaignView = 'list' | 'create' | 'detail';
type CampaignStatus = 'draft' | 'running' | 'completed' | 'failed';
type RecipientStatus = 'pending' | 'sent' | 'failed';

interface WhatsappConnection {
  id: string;
  nome: string;
  numero: string | null;
  status: 'connected' | 'connecting' | 'disconnected';
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
  status: RecipientStatus;
  error_message: string | null;
}

interface Campaign {
  id: string;
  nome: string;
  mensagem: string;
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
}

interface CampaignDetail extends Campaign {
  destinatarios: CampaignRecipient[];
}

const pageVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const fetcher = async <T,>(path: string, userId: string): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'x-user-id': userId },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Falha na comunicação com o servidor.');
  }

  return response.json();
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

export default function CampaignsPage() {
  const [userId, setUserId] = useState('');
  const [view, setView] = useState<CampaignView>('list');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    whatsapp_connection_id: '',
    lista_id: '',
    mensagem: '',
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
    ([, , uid]) => fetcher<WhatsappConnection[]>('/whatsapp', uid),
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

  const selectedConnection = connectedConnections.find(
    (connection) => connection.id === formData.whatsapp_connection_id,
  );
  const selectedList = lists.find((list) => list.id === formData.lista_id);

  const openCreate = () => {
    startTransition(() => {
      setSelectedCampaignId(null);
      setView('create');
    });
  };

  const openList = () => {
    startTransition(() => {
      setSelectedCampaignId(null);
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

    if (!formData.nome.trim() || !formData.whatsapp_connection_id || !formData.lista_id || !formData.mensagem.trim()) {
      toast.error('Preencha nome, WhatsApp, lista e mensagem para continuar.');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(`${API_URL}/campanhas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          mensagem: formData.mensagem.trim(),
          lista_id: formData.lista_id,
          whatsapp_connection_id: formData.whatsapp_connection_id,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Não foi possível criar a campanha.');
      }

      const createdCampaign = payload as CampaignDetail;

      setFormData({
        nome: '',
        whatsapp_connection_id: '',
        lista_id: '',
        mensagem: '',
      });

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
      const response = await fetch(`${API_URL}/campanhas/${campaignDetail.id}/start`, {
        method: 'POST',
        headers: { 'x-user-id': userId },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Não foi possível iniciar a campanha.');
      }

      toast.success('Campanha iniciada. O progresso será atualizado automaticamente.');
      await Promise.all([mutateCampaigns(), mutateDetail()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao iniciar campanha.');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <motion.div
      className="flex flex-1 min-h-0 flex-col gap-5"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-[clamp(30px,4vw,38px)] leading-[1.05] text-white">Campanhas</h1>
          <p className="mt-2.5 max-w-[760px] text-[15px] leading-7 text-white/55">
            Monte campanhas com listas de contatos e dispare pelo WhatsApp conectado. O processamento roda no Nest
            e o progresso volta em tempo real para a tela.
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
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#ffe664_0%,var(--color-secondary)_100%)] px-5 font-bold text-[var(--color-aux-black)] shadow-[0_16px_32px_rgba(242,228,22,0.18)] transition hover:-translate-y-0.5"
              onClick={openCreate}
            >
              <Send size={18} />
              Nova campanha
            </button>
          )}
        </div>
      </div>

      <section className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(18,105,244,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(242,228,22,0.1),transparent_28%),linear-gradient(180deg,rgba(8,16,31,0.96)_0%,rgba(5,10,20,0.98)_100%)] shadow-[var(--shadow-elevated)]">
        <div className="grid grid-cols-1 gap-3 p-[18px] md:grid-cols-3">
          <div className="rounded-[20px] border border-white/8 bg-white/5 p-[18px] backdrop-blur-xl">
            <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">Campanhas</span>
            <strong className="mt-2 block text-[clamp(24px,3vw,32px)] font-extrabold text-white">{campaigns.length}</strong>
            <span className="mt-1.5 block text-[13px] text-white/55">Rascunhos e disparos no mesmo painel</span>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-white/5 p-[18px] backdrop-blur-xl">
            <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">Em andamento</span>
            <strong className="mt-2 block text-[clamp(24px,3vw,32px)] font-extrabold text-white">{totalRunning}</strong>
            <span className="mt-1.5 block text-[13px] text-white/55">Atualização dinâmica via realtime</span>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-white/5 p-[18px] backdrop-blur-xl">
            <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">Destinatários</span>
            <strong className="mt-2 block text-[clamp(24px,3vw,32px)] font-extrabold text-white">{totalRecipients}</strong>
            <span className="mt-1.5 block text-[13px] text-white/55">{totalCompleted} campanha(s) finalizada(s)</span>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 flex-col p-[18px]">
          {view === 'list' && (
            <>
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
                  <p className="m-0 max-w-[560px] leading-7 text-white/55">
                    Crie sua primeira campanha selecionando um WhatsApp conectado, uma lista de contatos e a mensagem
                    que será enviada. Depois disso, você inicia o disparo quando estiver pronto.
                  </p>
                  <button
                    className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#ffe664_0%,var(--color-secondary)_100%)] px-5 font-bold text-[var(--color-aux-black)] shadow-[0_16px_32px_rgba(242,228,22,0.18)] transition hover:-translate-y-0.5"
                    onClick={openCreate}
                  >
                    <Send size={18} />
                    Criar primeira campanha
                  </button>
                </div>
              ) : (
                <div className="scrollbar-none grid min-h-0 grid-cols-1 gap-4 overflow-auto pr-1 xl:grid-cols-2">
                  {campaigns.map((campaign) => (
                    <article
                      key={campaign.id}
                      className="relative flex min-h-[260px] flex-col gap-[18px] overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.02)_100%)] p-[22px]"
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

                      <p className="m-0 line-clamp-4 text-[14px] leading-7 text-white/55">{campaign.mensagem}</p>

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
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {view === 'create' && (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
              <form
                className="flex min-h-0 flex-col gap-[18px] rounded-[24px] border border-white/8 bg-white/5 p-[22px] backdrop-blur-xl"
                onSubmit={handleCreateCampaign}
              >
                <div>
                  <h2 className="m-0 text-[22px] text-white">Criar campanha</h2>
                  <p className="mt-2 text-[14px] leading-6 text-white/55">
                    Defina o nome interno, escolha um WhatsApp ativo, selecione a lista e escreva a mensagem base do disparo.
                  </p>
                </div>

                <div className="grid gap-4">
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

                  <div className="grid gap-2">
                    <label htmlFor="campaign-whatsapp" className="text-sm font-bold text-white">
                      WhatsApp conectado
                    </label>
                    <select
                      id="campaign-whatsapp"
                      className="w-full rounded-2xl border border-white/8 bg-[rgba(7,16,33,0.92)] px-4 py-[15px] text-sm text-white outline-none transition focus:border-[rgba(242,228,22,0.35)] focus:shadow-[0_0_0_4px_rgba(242,228,22,0.08)]"
                      value={formData.whatsapp_connection_id}
                      onChange={(event) => setFormData((current) => ({ ...current, whatsapp_connection_id: event.target.value }))}
                    >
                      <option value="">Selecione uma conexão ativa</option>
                      {connectedConnections.map((connection) => (
                        <option key={connection.id} value={connection.id}>
                          {connection.nome}{connection.numero ? ` · ${connection.numero}` : ''}
                        </option>
                      ))}
                    </select>
                    <span className="text-[12px] text-white/45">Somente conexões com status conectado aparecem aqui.</span>
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="campaign-list" className="text-sm font-bold text-white">
                      Lista de contatos
                    </label>
                    <select
                      id="campaign-list"
                      className="w-full rounded-2xl border border-white/8 bg-[rgba(7,16,33,0.92)] px-4 py-[15px] text-sm text-white outline-none transition focus:border-[rgba(242,228,22,0.35)] focus:shadow-[0_0_0_4px_rgba(242,228,22,0.08)]"
                      value={formData.lista_id}
                      onChange={(event) => setFormData((current) => ({ ...current, lista_id: event.target.value }))}
                    >
                      <option value="">Escolha a lista que será usada</option>
                      {lists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.nome}{typeof list.cards?.length === 'number' ? ` · ${list.cards.length} contatos` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="campaign-message" className="text-sm font-bold text-white">
                      Mensagem
                    </label>
                    <textarea
                      id="campaign-message"
                      className="min-h-[200px] w-full resize-y rounded-2xl border border-white/8 bg-[rgba(7,16,33,0.92)] px-4 py-[15px] text-sm leading-7 text-white outline-none transition focus:border-[rgba(242,228,22,0.35)] focus:shadow-[0_0_0_4px_rgba(242,228,22,0.08)]"
                      placeholder="Olá! Passando para compartilhar uma condição especial..."
                      value={formData.mensagem}
                      onChange={(event) => setFormData((current) => ({ ...current, mensagem: event.target.value }))}
                      maxLength={3000}
                    />
                    <span className="text-[12px] text-white/45">{formData.mensagem.length}/3000 caracteres</span>
                  </div>
                </div>

                <div className="mt-1 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    className="inline-flex min-h-[46px] items-center justify-center rounded-[14px] border border-white/10 bg-transparent px-4 text-sm font-semibold text-white/65 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
                    onClick={openList}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#ffe664_0%,var(--color-secondary)_100%)] px-5 font-bold text-[var(--color-aux-black)] shadow-[0_16px_32px_rgba(242,228,22,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:transform-none"
                    disabled={isCreating}
                  >
                    <Send size={18} />
                    {isCreating ? 'Criando campanha...' : 'Salvar campanha'}
                  </button>
                </div>
              </form>

              <aside className="flex min-h-0 flex-col gap-[18px] rounded-[24px] border border-white/8 bg-white/5 p-[22px] backdrop-blur-xl">
                <div>
                  <h2 className="m-0 text-[22px] text-white">Pré-visualização</h2>
                  <p className="mt-2 text-[14px] leading-6 text-white/55">
                    Confira contexto, lista e mensagem antes de salvar o rascunho.
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
                        : 'Selecione uma conexão ativa para habilitar o disparo quando a campanha for iniciada.'}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/5 p-4">
                    <strong className="block text-[15px] text-white">
                      {selectedList?.nome || 'Lista ainda não selecionada'}
                    </strong>
                    <p className="mt-2 text-[13px] leading-6 text-white/55">
                      {selectedList
                        ? `A lista atual possui ${selectedList.cards?.length || 0} contato(s) vinculados.`
                        : 'Escolha a lista de contatos que será congelada como base da campanha no momento da criação.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-white/55">
                  <span>{formData.nome.trim() || 'Novo rascunho de campanha'}</span>
                  <span>{formData.mensagem.length} caracteres</span>
                </div>

                <div className="rounded-[22px_22px_22px_10px] bg-[linear-gradient(135deg,rgba(18,105,244,0.24)_0%,rgba(12,67,157,0.45)_100%)] p-[18px] text-white">
                  <p className="m-0 whitespace-pre-wrap break-words text-sm leading-7">
                    {formData.mensagem.trim() || 'Sua mensagem aparecerá aqui para revisão rápida antes de salvar o rascunho.'}
                  </p>
                </div>

                <div className="rounded-[20px] border border-white/8 bg-white/5 p-4">
                  <strong className="block text-[15px] text-white">Fluxo da operação</strong>
                  <p className="mt-2 text-[13px] leading-6 text-white/55">
                    Primeiro você salva a campanha. Depois, na tela de detalhes, inicia o envio. A execução acontece de forma assíncrona no Nest e os contadores são atualizados via realtime.
                  </p>
                </div>
              </aside>
            </div>
          )}

          {view === 'detail' && (
            <>
              {isLoadingDetail || !campaignDetail ? (
                <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 text-white/55">
                  <div className="h-[34px] w-[34px] animate-spin rounded-full border-[3px] border-white/15 border-t-[var(--color-secondary)]" />
                  <span>Carregando detalhes da campanha...</span>
                </div>
              ) : (
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-4">
                  <div className="flex min-h-0 flex-col gap-[18px] rounded-[24px] border border-white/8 bg-white/5 p-[22px] backdrop-blur-xl">
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
                  </div>

                  <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                    <div className="flex min-h-0 flex-col gap-4">
                      <div className="rounded-[20px] border border-white/8 bg-white/5 p-[18px]">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h3 className="m-0 text-[18px] text-white">Mensagem da campanha</h3>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1.5 text-[12px] font-bold text-white/70">
                            <Send size={12} />
                            Conteúdo congelado no rascunho
                          </span>
                        </div>
                        <p className="m-0 whitespace-pre-wrap break-words text-sm leading-8 text-white">
                          {campaignDetail.mensagem}
                        </p>
                      </div>

                      <div className="flex min-h-0 flex-col rounded-[20px] border border-white/8 bg-white/5 p-[18px]">
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
                      </div>
                    </div>

                    <aside className="flex min-h-0 flex-col gap-4">
                      <div className="rounded-[20px] border border-white/8 bg-white/5 p-[18px]">
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
                            ['Lista', campaignDetail.contatos_listas?.nome || 'Não encontrada'],
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
                      </div>

                      <div className="rounded-[20px] border border-white/8 bg-white/5 p-[18px]">
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
                      </div>
                    </aside>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </motion.div>
  );
}
