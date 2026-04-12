'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { supabase } from '@/lib/supabaseClient';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Plus, Trash2, User, X } from 'lucide-react';
import { toast } from 'sonner';
import ModalNovaLista from '@/components/contatos/ModalNovaLista';
import ModalAdicionarContato from '@/components/contatos/ModalAdicionarContato';
import ModalConfirmacao from '@/components/contatos/ModalConfirmacao';
import { apiRequest } from '@/lib/api/client';

const fetcher = async (url: string, uid: string) => {
  return apiRequest<any[]>(url, { userId: uid });
};

// Fix definitivo do salto: card arrastando renderiza direto no document.body via portal,
// escapando do stacking context criado pelo backdrop-filter do container pai.
// Sem isso, o position:fixed do dnd fica relativo ao ancestral com backdrop-blur.
interface KanbanCardProps {
  card: any;
  index: number;
  onRemove: (id: string) => void;
}

function KanbanCard({ card, index, onRemove }: KanbanCardProps) {
  return (
    <Draggable draggableId={card.id} index={index}>
      {(dragProv, dragSnap) => {
        const cardEl = (
          <div
            ref={dragProv.innerRef}
            {...dragProv.draggableProps}
            {...dragProv.dragHandleProps}
            style={{
              userSelect: 'none',
              ...dragProv.draggableProps.style,
            }}
            className={`bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2 hover:bg-white/10 transition-colors group ${dragSnap.isDragging ? 'shadow-xl ring-1 ring-primary/50 opacity-95' : ''
              }`}
          >
            <div className="flex items-start justify-between w-full gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {card.avatar_url ? (
                  <img src={card.avatar_url} className="w-6 h-6 rounded-full" alt="" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0">
                    <User size={12} />
                  </div>
                )}
                <h4 className="text-white text-sm font-medium truncate">{card.nome}</h4>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(card.id); }}
                  className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/40"
                >
                  <X size={14} />
                </button>
                <GripVertical size={14} className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0 cursor-grab" />
              </div>
            </div>
            <span className="text-[11px] text-white/40 ml-8 font-mono">{card.whatsapp}</span>
          </div>
        );

        // Quando arrastando: portal para document.body escapa do stacking context
        if (dragSnap.isDragging) {
          return createPortal(cardEl, document.body);
        }
        return cardEl;
      }}
    </Draggable>
  );
}

interface KanbanBoardProps {
  isNovaListaOpen: boolean;
  onCloseNovaLista: () => void;
  isAdmin: boolean;
}

export default function KanbanBoard({ isNovaListaOpen, onCloseNovaLista, isAdmin }: KanbanBoardProps) {
  const [userId, setUserId] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  const [addContatoListId, setAddContatoListId] = useState<{ id: string, nome: string, existingIds: string[] } | null>(null);
  const [deleteListaTarget, setDeleteListaTarget] = useState<{ id: string; nome: string } | null>(null);
  const [isDeletingLista, setIsDeletingLista] = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
    });
  }, []);

  const { data: initialData, mutate, isLoading } = useSWR(
    userId ? ['/contatos/listas', userId] : null,
    ([url, uid]) => fetcher(url, uid),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  );
  const [boardData, setBoardData] = useState<any[]>([]);

  // Atualiza boardData quando initialData chega, mas não sobrescreve 
  // imediatamente durante um drag
  useEffect(() => {
    if (initialData) {
      setBoardData(initialData);
    }
  }, [initialData]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // Deep copy to mutate statelessly
    const newBoard = JSON.parse(JSON.stringify(boardData));

    const sourceListIndex = newBoard.findIndex((l: any) => l.id === source.droppableId);
    const destListIndex = newBoard.findIndex((l: any) => l.id === destination.droppableId);

    // Get card
    const sourceList = newBoard[sourceListIndex];
    const destList = newBoard[destListIndex];
    const [movedCard] = sourceList.cards.splice(source.index, 1);

    // Insert to new array
    destList.cards.splice(destination.index, 0, movedCard);

    // Reorder inner arrays order_kanban for target list
    destList.cards.forEach((card: any, idx: number) => {
      card.ordem_kanban = idx;
    });

    // Optimistic update
    setBoardData(newBoard);

    try {
      await apiRequest(`/contatos/${movedCard.id}/mover`, {
        method: 'PUT',
        userId,
        body: {
          sourceListId: source.droppableId,
          targetListId: destination.droppableId,
          newOrder: destination.index
        }
      });
      // Silencioso. Não disparamos toast para não poluir, 
      // mas se der erro no catch a gente reverte.
    } catch (err: any) {
      toast.error('Erro ao mover contato. ' + err.message);
      mutate(); // reverte estado
    }
  };

  const handleCreateLista = async (nome: string, cor: string, descricao: string) => {
    try {
      await apiRequest('/contatos/listas', {
        method: 'POST',
        userId,
        body: { nome, cor, descricao },
      });
      mutate();
      toast.success("Lista criada com sucesso!");
      onCloseNovaLista();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : 'Erro na requisição.');
    }
  };

  const handleVincularContato = async (contatoIds: string[]) => {
    if (!addContatoListId || contatoIds.length === 0) return;

    try {
      const promises = contatoIds.map(contatoId =>
        apiRequest('/contatos/vincular', {
          method: 'POST',
          userId,
          body: { contatoId, listaId: addContatoListId.id },
        }).then(() => true).catch(() => false)
      );

      const results = await Promise.all(promises);
      const allOk = results.every(Boolean);

      if (allOk) {
        mutate();
        toast.success(`${contatoIds.length} contato(s) vinculado(s) com sucesso!`);
        setAddContatoListId(null);
      } else {
        toast.error('Ocorreu um erro ao vincular alguns contatos');
        mutate();
      }
    } catch (err) {
      toast.error('Erro na requisição.');
    }
  };

  const handleDesvincularContato = async (contatoId: string, listaId: string) => {
    try {
      await apiRequest('/contatos/vincular', {
        method: 'DELETE',
        userId,
        body: { contatoId, listaId },
      });
      mutate();
      toast.success("Contato desvinculado com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na requisição.');
    }
  };

  const handleDeleteLista = async () => {
    if (!deleteListaTarget) return;

    setIsDeletingLista(true);
    try {
      await apiRequest(`/contatos/listas/${deleteListaTarget.id}`, {
        method: 'DELETE',
        userId,
      });
      await mutate();
      toast.success('Lista excluída com sucesso!');
      setDeleteListaTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir lista.');
    } finally {
      setIsDeletingLista(false);
    }
  };

  if (isLoading || (!boardData || boardData.length === 0)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-white/40 h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent flex-shrink-0 animate-spin rounded-full mb-4" />
        <p>Carregando kanban...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col w-full min-h-0 overflow-hidden">
      {/* Scroll único — dnd não suporta nested scroll containers */}
      <div className="flex-1 overflow-auto scrollbar-none">
        <DragDropContext onDragEnd={onDragEnd}>
          {/* w-max faz o flex crescer horizontalmente sem quebrar linha */}
          <div className="flex gap-4 p-4 w-max h-full">
            {boardData.map((list) => (
              <div
                key={list.id}
                className="w-[300px] flex-shrink-0 flex flex-col bg-white/[0.03] rounded-2xl border border-white/5"
                style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}
              >
                {/* Column Header */}
                <div className="p-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: list.cor || '#888' }}
                    />
                    <h3 className="font-medium text-white/90 text-sm">{list.nome}</h3>
                    <span className="bg-white/10 text-white/60 text-[10px] px-2 py-0.5 rounded-full ml-1 font-mono">
                      {list.cards?.length || 0}
                    </span>
                  </div>
                  {!list.is_fixed ? (
                    <button
                      type="button"
                      onClick={() => setDeleteListaTarget({ id: list.id, nome: list.nome })}
                      className="p-2 text-white/35 hover:text-white/80 hover:bg-white/8 rounded-lg transition-colors"
                      title="Excluir lista"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>

                {/* Droppable Area — flex-1 ocupa o espaço restante, scroll vertical sem barra */}
                <Droppable droppableId={list.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto scrollbar-none p-3 space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-white/[0.02]' : ''
                        }`}
                    >
                      {list.cards?.map((card: any, index: number) => (
                        <KanbanCard key={card.id} card={card} index={index} onRemove={(cId) => handleDesvincularContato(cId, list.id)} />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Column Footer */}
                <div className="p-2 border-t border-white/5 flex-shrink-0">
                  <button
                    onClick={() => setAddContatoListId({ id: list.id, nome: list.nome, existingIds: list.cards?.map((c: any) => c.id) || [] })}
                    className="w-full py-2 flex items-center justify-center gap-2 text-white/40 hover:text-white/80 hover:bg-white/5 rounded-lg transition-colors text-sm"
                  >
                    <Plus size={16} />
                    Adicionar Contato
                  </button>
                </div>
              </div>
            ))}

            {/* Ghost column for right spacing */}
            <div className="w-4 flex-shrink-0" />
          </div>
        </DragDropContext>
      </div>

      {/* Modais renderizados no body para ficarem centralizados na tela toda */}
      {mounted && isNovaListaOpen && createPortal(
        <ModalNovaLista
          onClose={onCloseNovaLista}
          onSubmit={handleCreateLista}
        />,
        document.body
      )}

      {mounted && addContatoListId && createPortal(
        <ModalAdicionarContato
          listaNome={addContatoListId.nome}
          onClose={() => setAddContatoListId(null)}
          onSubmit={handleVincularContato}
          userId={userId}
          existingIds={addContatoListId.existingIds}
        />,
        document.body
      )}

      {mounted && deleteListaTarget && createPortal(
        <ModalConfirmacao
          isOpen={!!deleteListaTarget}
          onClose={() => setDeleteListaTarget(null)}
          onConfirm={handleDeleteLista}
          title="Excluir Lista"
          message={`Tem certeza que deseja excluir a lista "${deleteListaTarget.nome}"? Os contatos não serão apagados, apenas removidos desta etapa do CRM.`}
          confirmText="Sim, excluir lista"
          cancelText="Cancelar"
          loading={isDeletingLista}
        />,
        document.body
      )}
    </div>
  );
}
