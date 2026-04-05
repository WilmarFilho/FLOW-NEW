'use client';

import { useState, useEffect } from 'react';
import { Users, KanbanSquare, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { mutate } from 'swr';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api/client';
import { pageEntrance, sectionEntrance } from '@/lib/motion/variants';

import KanbanBoard from './KanbanBoard';
import ListTab from './ListTab';
import ModalNovoContato from '@/components/contatos/ModalNovoContato';

export default function ContatosClient() {
  const [activeTab, setActiveTab] = useState<'lista' | 'kanban'>('kanban');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isNovaListaOpen, setIsNovaListaOpen] = useState(false);
  const [isNovoContatoOpen, setIsNovoContatoOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase
        .from('profile')
        .select('tipo_de_usuario')
        .eq('auth_id', user.id)
        .single();
      setIsAdmin(!profile || profile.tipo_de_usuario !== 'atendente');
    });
  }, []);

  const handleCreateContato = async (data: { nome: string; whatsapp: string }) => {
    try {
      await apiRequest('/contatos', {
        method: 'POST',
        userId,
        body: data,
      });
      toast.success("Contato criado com sucesso!");
      mutate(userId ? ['/contatos', userId] : null);
      setIsNovoContatoOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao conectar ao servidor');
    }
  };

  return (
    <motion.div
      className="flex-1 flex flex-col min-h-0 relative"
      variants={pageEntrance}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header (estilo igual ao WhatsAppPage) */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-white m-0">Contatos</h1>
          <p className="text-[15px] text-white/55 mt-1 m-0">
            Gerencie, acompanhe e qualifique seus leads.
          </p>
        </div>

        {isAdmin && activeTab === 'kanban' && (
          <button
            onClick={() => setIsNovaListaOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--color-secondary)] text-[var(--color-aux-black)] border-none rounded-[14px] text-[15px] font-bold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(242,228,22,0.3)] whitespace-nowrap"
          >
            <Plus size={18} />
            Nova Lista
          </button>
        )}

        {activeTab === 'lista' && (
          <button
            onClick={() => setIsNovoContatoOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--color-secondary)] text-[var(--color-aux-black)] border-none rounded-[14px] text-[15px] font-bold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(242,228,22,0.3)] whitespace-nowrap"
          >
            <Plus size={18} />
            Novo Contato
          </button>
        )}
      </div>

      {/* Tabs / Segmented Control */}
      <div className="flex items-center gap-2 mb-4 bg-white/5 border border-white/10 p-1.5 rounded-xl w-fit flex-shrink-0">
        <button
          onClick={() => setActiveTab('kanban')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'kanban' 
              ? 'bg-white/10 text-white shadow-sm' 
              : 'text-white/50 hover:text-white/80 hover:bg-white/5'
          }`}
        >
          <KanbanSquare size={16} />
          <span>Kanban CRM</span>
        </button>
        <button
          onClick={() => setActiveTab('lista')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'lista' 
              ? 'bg-white/10 text-white shadow-sm' 
              : 'text-white/50 hover:text-white/80 hover:bg-white/5'
          }`}
        >
          <Users size={16} />
          <span>Lista de Contatos</span>
        </button>
      </div>

      {/* Render the Active View */}
      <div className="relative flex-1 bg-surface-elevated/40 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={sectionEntrance}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full h-full flex flex-col"
          >
            {activeTab === 'kanban' ? (
              <KanbanBoard 
                isAdmin={isAdmin}
                isNovaListaOpen={isNovaListaOpen}
                onCloseNovaLista={() => setIsNovaListaOpen(false)}
              />
            ) : (
              <ListTab />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {mounted && isNovoContatoOpen && createPortal(
        <ModalNovoContato 
          onClose={() => setIsNovoContatoOpen(false)}
          onSubmit={handleCreateContato}
        />,
        document.body
      )}
    </motion.div>
  );
}
