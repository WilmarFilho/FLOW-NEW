import { useState } from 'react';
import { useSetRecoilState } from 'recoil';
import Modal from '../components/Gerais/Modal/Modal';
import ChatSidebar from '../components/Conversas/ChatSideBar/ChatSideBar';
import ChatWindow from '../components/Conversas/ChatWindow/ChatWindow';
import NewChatForm from '../components/Conversas/NewChatForm/NewChatForm';
import { useConversasPage } from '../hooks/pages/useConversasPage';
import { DropdownMenuProvider } from '../components/Gerais/Dropdown/DropdownMenuContext';
import GlobalStyles from '../global.module.css';
import { chatFiltersState } from '../state/atom';
import { useIsMobileLayout } from '../hooks/utils/useIsMobileLayout';
import { FilterModal } from '../components/Conversas/FilterModal/FilterModal';

export default function ConversasPage() {
  // Hook da Página
  const state = useConversasPage();

  // Se o usuário estiver desativado, mostrar fallback
  if (state.user?.status === false) {
    return (
      <div className={GlobalStyles.fallbackContainer}>
        <p>Usuário desativado. Você não tem acesso às conversas.</p>
      </div>
    );
  }

  // Estado para tamanho de tela
  const isMobileLayout = useIsMobileLayout()

  // Modais de seleção para filtro (UI local)
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);
  const [isAttendantsModalOpen, setIsAttendantsModalOpen] = useState(false);

  // Recoil setter para filtros centralizados
  const setFilters = useSetRecoilState(chatFiltersState);

  // Volta para ChatBar
  const handleBackToSidebar = () => state.setActiveChat(null);

  return (
    <div className={GlobalStyles.conversasContainer}>
      {isMobileLayout ? (
        state.activeChat ? (
          <DropdownMenuProvider>
            <ChatWindow
              {...state}
              isMobileLayout={isMobileLayout}
              onBack={handleBackToSidebar}
            />
          </DropdownMenuProvider>
        ) : (
          <ChatSidebar
            {...state}
            openConnectionsModal={() => setIsConnectionsModalOpen(true)}
            openAttendantsModal={() => setIsAttendantsModalOpen(true)}
            isMobileLayout={isMobileLayout}
          />
        )
      ) : (
        <>
          <ChatSidebar
            {...state}
            openConnectionsModal={() => setIsConnectionsModalOpen(true)}
            openAttendantsModal={() => setIsAttendantsModalOpen(true)}
            isMobileLayout={isMobileLayout}
          />

          <DropdownMenuProvider>
            <ChatWindow
              {...state}
              isMobileLayout={isMobileLayout}
              onBack={handleBackToSidebar}
            />
          </DropdownMenuProvider>
        </>
      )}

      {/* Modal Nova Conversa */}
      {state.isAddChatOpen && (
        <Modal
          isSubmitting={state.isSubmitting}
          isOpen={state.isAddChatOpen}
          labelSubmit="Enviar"
          onSave={state.handleCreateChat}
          onClose={() => state.setIsAddChatOpen(false)}
          title="Começar nova conversa."
        >
          <NewChatForm
            connections={state.connections}
            selectedConnectionId={state.formConnectionId}
            setSelectedConnectionId={state.setFormConnectionId}
            newChatNumber={state.newChatNumber}
            setNewChatNumber={state.setNewChatNumber}
            newChatMessage={state.newChatMessage}
            setNewChatMessage={state.setNewChatMessage}
            showErrors={state.showErrors}
            errors={state.errors}
          />
        </Modal>
      )}

      {/* Modais de Filtro */}
      <FilterModal
        isOpen={isConnectionsModalOpen}
        title="Escolha uma conexão"
        items={state.connections}
        labelSelector={(conn) => conn.nome || ''}
        onSelect={(conn) => {
          setFilters(prev => ({ ...prev, connection_id: conn?.id, attendant_id: null }));
          setIsConnectionsModalOpen(false);
        }}
        onClose={() => setIsConnectionsModalOpen(false)}
      />

      <FilterModal
        isOpen={isAttendantsModalOpen}
        title="Escolha um atendente"
        items={state.attendants}
        labelSelector={(att) => att.user.nome}
        onSelect={(att) => {
          setFilters(prev => ({ ...prev, attendant_id: att?.user_id, connection_id: null }));
          setIsAttendantsModalOpen(false);
        }}
        onClose={() => setIsAttendantsModalOpen(false)}
      />

    </div>
  );
}