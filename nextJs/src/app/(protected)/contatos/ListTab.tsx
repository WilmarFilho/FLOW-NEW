'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { supabase } from '@/lib/supabaseClient';
import { Pencil, Phone, Search, Sparkles, User, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import ModalConfirmacao from '@/components/contatos/ModalConfirmacao';
import ContactDetailsModal from '@/components/contatos/ContactDetailsModal';
import ContactRenameModal from '@/components/contatos/ContactRenameModal';
import ContactQualificationModal, {
  type ContactQualificationJob,
} from '@/components/contatos/ContactQualificationModal';
import { apiRequest } from '@/lib/api/client';

const fetcher = async (url: string, uid: string) => {
  return apiRequest<any[]>(url, { userId: uid });
};

export default function ListTab() {
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<any | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isQualificationModalOpen, setIsQualificationModalOpen] = useState(false);
  const [isStartingQualification, setIsStartingQualification] = useState(false);
  const [qualificationJob, setQualificationJob] = useState<ContactQualificationJob | null>(null);
  const [selectedContactDetails, setSelectedContactDetails] = useState<any | null>(null);
  const [isLoadingContactDetails, setIsLoadingContactDetails] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: contatos, isValidating } = useSWR(
    userId ? ['/contatos', userId] : null,
    ([url, uid]) => fetcher(url, uid)
  );
  const [search, setSearch] = useState('');

  const filtered = contatos?.filter((c: any) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) || c.whatsapp.includes(search)
  ) || [];

  useEffect(() => {
    if (!userId || !qualificationJob?.id || qualificationJob.status !== 'running') {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const nextJob = await apiRequest<ContactQualificationJob>(
          `/contatos/qualificacao/automatica/${qualificationJob.id}`,
          { userId },
        );

        setQualificationJob(nextJob);

        if (nextJob.status !== 'running') {
          globalMutate(['/contatos', userId]);
          globalMutate(['/contatos/listas', userId]);
          window.clearInterval(interval);
        }
      } catch (error) {
        window.clearInterval(interval);
        toast.error(error instanceof Error ? error.message : 'Erro ao acompanhar qualificação.');
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [qualificationJob?.id, qualificationJob?.status, userId]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/contatos/${deleteId}`, {
        method: 'DELETE',
        userId,
      });
      toast.success("Contato excluído definitivamente!");
      globalMutate(['/contatos', userId]);
      setDeleteId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro de conexão");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = async (nextName: string) => {
    if (!renameTarget || nextName.trim() === renameTarget.nome) {
      return;
    }

    setIsRenaming(true);
    try {
      await apiRequest(`/contatos/${renameTarget.id}`, {
        method: 'PATCH',
        userId,
        body: { nome: nextName.trim() },
      });
      toast.success('Nome do contato atualizado.');
      globalMutate(['/contatos', userId]);
      setRenameTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar contato');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleStartQualification = async () => {
    if (!userId) {
      toast.error('Não foi possível identificar o usuário atual.');
      return;
    }

    setIsStartingQualification(true);
    try {
      const job = await apiRequest<ContactQualificationJob>(
        '/contatos/qualificacao/automatica',
        {
          method: 'POST',
          userId,
        },
      );

      setQualificationJob(job);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao iniciar qualificação.');
    } finally {
      setIsStartingQualification(false);
    }
  };

  const handleOpenContactDetails = async (contato: any) => {
    if (!userId) {
      return;
    }

    setSelectedContactDetails({
      id: contato.id,
      nome: contato.nome,
      whatsapp: contato.whatsapp,
      avatar_url: contato.avatar_url || null,
      connections: [],
    });
    setIsLoadingContactDetails(true);

    try {
      const details = await apiRequest(`/contatos/${contato.id}/details`, { userId });
      setSelectedContactDetails(details);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar detalhes do contato.');
    } finally {
      setIsLoadingContactDetails(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4">
      {/* Top Bar Support */}
      <div className="mb-4 flex flex-shrink-0 flex-wrap items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contato..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsQualificationModalOpen(true)}
          disabled={isStartingQualification || qualificationJob?.status === 'running'}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles size={16} />
          {qualificationJob?.status === 'running'
            ? 'Qualificando...'
            : 'Qualificar contatos'}
        </button>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {contatos === undefined ? (
          <div className="flex flex-col items-center justify-center p-12 text-white/40 h-full">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent flex-shrink-0 animate-spin rounded-full mb-4" />
            <p>Carregando contatos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">Nenhum contato encontrado.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((contato: any) => (
              <div
                key={contato.id}
                onClick={() => void handleOpenContactDetails(contato)}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0">
                    {contato.avatar_url ? (
                      <img src={contato.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User size={18} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate text-sm">{contato.nome}</h3>
                    <div className="flex items-center text-white/50 text-xs mt-0.5 gap-1.5">
                      <Phone size={12} />
                      <span>{contato.whatsapp}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenameTarget(contato); }}
                      className="p-2 text-white/40 hover:bg-white/10 rounded-lg transition-all"
                      title="Editar nome"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteId(contato.id); }}
                      className="p-2 text-white/40 hover:bg-white/10 rounded-lg transition-all"
                      title="Excluir contato"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {mounted && deleteId && createPortal(
        <ModalConfirmacao
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          title="Excluir Contato"
          message="Tem certeza que deseja excluir as informações deste contato? Esta ação apagará o registro definitivamente em todas as listas de CRM e não poderá ser desfeita."
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          loading={isDeleting}
        />,
        document.body
      )}

      <ContactRenameModal
        isOpen={!!renameTarget}
        initialName={renameTarget?.nome || ''}
        subtitle={renameTarget?.whatsapp || null}
        avatarUrl={renameTarget?.avatar_url || null}
        loading={isRenaming}
        onClose={() => {
          if (!isRenaming) {
            setRenameTarget(null);
          }
        }}
        onConfirm={handleRename}
      />

      <ContactQualificationModal
        isOpen={isQualificationModalOpen}
        isStarting={isStartingQualification}
        job={qualificationJob}
        onClose={() => {
          if (qualificationJob?.status !== 'running' && !isStartingQualification) {
            setIsQualificationModalOpen(false);
          }
        }}
        onConfirm={handleStartQualification}
      />

      <ContactDetailsModal
        details={selectedContactDetails}
        isLoading={isLoadingContactDetails}
        isOpen={!!selectedContactDetails}
        onClose={() => {
          if (!isLoadingContactDetails) {
            setSelectedContactDetails(null);
          }
        }}
      />
    </div>
  );
}
