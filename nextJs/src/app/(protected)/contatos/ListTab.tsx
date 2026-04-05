'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { supabase } from '@/lib/supabaseClient';
import { Phone, Search, User, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import ModalConfirmacao from '@/components/contatos/ModalConfirmacao';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const fetcher = async (url: string, uid: string) => {
  const res = await fetch(API_URL + url, {
    headers: { 'x-user-id': uid },
  });
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export default function ListTab() {
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/contatos/${deleteId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId }
      });
      if (res.ok) {
        toast.success("Contato excluído definitivamente!");
        globalMutate(['/contatos', userId]);
        setDeleteId(null);
      } else {
        const error = await res.json();
        toast.error(error.message || "Erro ao excluir contato");
      }
    } catch (e) {
      toast.error("Erro de conexão");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4">
      {/* Top Bar Support */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
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
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteId(contato.id); }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-white/40 hover:bg-white/10 rounded-lg transition-all"
                    title="Excluir contato"
                  >
                    <Trash size={16} />
                  </button>
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
    </div>
  );
}
