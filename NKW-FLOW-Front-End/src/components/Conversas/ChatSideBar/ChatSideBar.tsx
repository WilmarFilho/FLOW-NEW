// Libs
import React, { useRef, useEffect, useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { motion } from 'framer-motion';
// Components
import SearchBar from '../SearchBar/Searchbar';
import Tag from '../Tags/Tag';
import ChatListItem from '../ChatListItem/ChatListItem';
// Types
import { Chat, ChatFilters } from '../../../types/chats';
import { Attendant } from '../../../types/attendant';
// CSS Modules
import styles from './ChatSideBar.module.css';
// Atom
import { chatFiltersState, userState } from '../../../state/atom';
// Icons
import Icon from '../../../components/Gerais/Icons/Icons';

interface ChatSidebarProps {
  chats: Chat[] | null;
  attendants: Attendant[] | null;
  connections: { id: string; nome?: string }[] | null;
  isMobileLayout: boolean;
  activeChat: Chat | null;
  setActiveChat: (chat: Chat) => void;
  setIsAddChatOpen: (value: boolean) => void;
  fetchImageProfile: (chatId: string) => Promise<Chat | null>;
  openConnectionsModal: () => void;
  openAttendantsModal: () => void;
  fetchChats: (filters?: ChatFilters) => Promise<Chat[] | undefined>;
  fetchMoreChats: (filters?: ChatFilters) => Promise<void>;
  hasMoreChats: boolean;
  isLoadingChats: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

function ChatSidebar({
  chats,
  activeChat,
  setActiveChat,
  setIsAddChatOpen,
  fetchImageProfile,
  isMobileLayout,
  connections,
  attendants,
  openConnectionsModal,
  openAttendantsModal,
  fetchChats,
  fetchMoreChats,
  hasMoreChats,
  isLoadingChats,
}: ChatSidebarProps) {
  // ✨ Substituir múltiplos useStates pelo atom global de filtros
  const [filters, setFilters] = useRecoilState(chatFiltersState);
  
  const user = useRecoilValue(userState);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Dispara fetchChats apenas se os filtros estiverem diferentes do default
  useEffect(() => {
    // Só dispara se algum filtro estiver diferente do padrão
    const defaultFilters: ChatFilters = {
      search: null,
      status: 'Open',
      owner: 'all',
      iaStatus: 'todos',
      connection_id: null,
      attendant_id: null,
      isFetching: false,
    };
    const isDefault =
      filters.search === defaultFilters.search &&
      filters.status === defaultFilters.status &&
      filters.owner === defaultFilters.owner &&
      filters.iaStatus === defaultFilters.iaStatus &&
      filters.connection_id === defaultFilters.connection_id &&
      filters.attendant_id === defaultFilters.attendant_id &&
      filters.isFetching === defaultFilters.isFetching;

    if (!isDefault) {
      fetchChats(filters);
    }
  }, [filters, fetchChats]);

  // scroll infinito
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (isLoadingChats || !hasMoreChats) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 350) {
        fetchMoreChats(filters);
      }
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [isLoadingChats, hasMoreChats, fetchMoreChats, filters]);

  // ✨ Funções de manipulação de filtros agora atualizam o estado global
  const toggleSearchFilter = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, search: query, isFetching: true }));
  }, [setFilters]);

  // ✨ Funções de manipulação de filtros agora atualizam o estado global
  const toggleStatusFilter = useCallback(() => {
    setFilters(prev => ({ ...prev, status: prev.status === 'Open' ? 'Close' : 'Open', isFetching: true }));
  }, [setFilters]);

  const toggleOwnerFilter = useCallback(() => {
    setFilters(prev => ({ ...prev, owner: prev.owner === 'all' ? 'mine' : 'all', isFetching: true }));
  }, [setFilters]);

  const setIaStatusFilter = useCallback((status: 'ativa' | 'desativada') => {
    setFilters(prev => ({ ...prev, iaStatus: prev.iaStatus === status ? 'todos' : status, isFetching: true }));
  }, [setFilters]);

  const handleConnectionSelect = useCallback((connectionId: string | null) => {
    setFilters(prev => ({ ...prev, connection_id: connectionId, attendant_id: null, isFetching: true }));
  }, [setFilters]);

  const handleAttendantSelect = useCallback((attendantId: string | null) => {
    setFilters(prev => ({ ...prev, attendant_id: attendantId, connection_id: null, isFetching: true }));
  }, [setFilters]);

  return (
    <motion.aside
      className={styles.chatSidebar}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className={styles.wrapperSearchBar}>
        <SearchBar onSearch={toggleSearchFilter} />
        <button onClick={() => setIsAddChatOpen(true)} className={styles.buttonAddChat}>
          <Icon nome="addchat" />
        </button>
      </div>

      {/* ✨ Filtros agora usam o objeto `filters` do Recoil */}
      <div className={styles.iaFilterContainer}>
        {filters.status === 'Open' && filters.owner === 'all' ? (
          ['ativa', 'desativada'].map((status) => (
            <button
              key={status}
              type="button"
              data-label={status === 'ativa' ? 'Agente Ativado' : 'Agente Desativado'}
              data-label-short={status === 'ativa' ? 'IA Ligada' : 'IA Desligada'}
              className={`${styles.ChatFilterButton} ${filters.iaStatus === status ? styles.active : ''}`}
              onClick={() => setIaStatusFilter(status as 'ativa' | 'desativada')}
            />
          ))
        ) : (
          <button
            type="button"
            data-label={'Agente Desativado'}
            data-label-short={'IA Desligada'}
            className={`${styles.ChatFilterButton} ${styles.active}`}
            onClick={() => setIaStatusFilter('desativada')}
          />
        )}
      </div>

      {/* Conexões */}
      {!isMobileLayout && !filters.attendant_id && (
        (() => {
          // ... (lógica de exibição da conexão)
          const connectionLabel = filters.connection_id
            ? connections?.find(c => c.id === filters.connection_id)?.nome || 'Conexão selecionada'
            : 'Escolha uma conexão';

          return (
            <button
              className={`${styles.ChatFilterButton} ${filters.connection_id ? styles.active : ''}`}
              data-label={connectionLabel}
              onClick={() => {
                if (filters.connection_id) handleConnectionSelect(null);
                else openConnectionsModal();
              }}
            >
              {filters.connection_id && <Icon nome="close" />}
            </button>
          );
        })()
      )}

      {/* Tags mobile */}
      {isMobileLayout && (
        <div className={styles.tagsContainer}>
          <Tag
            label="Todas"
            active={!filters.connection_id && !filters.attendant_id}
            onClick={() => {
              handleConnectionSelect(null);
              handleAttendantSelect(null);
            }}
          />
          {connections?.map((connection) => (
            <Tag
              key={connection.id}
              label={connection.nome}
              active={filters.connection_id === connection.id}
              onClick={() => handleConnectionSelect(connection.id)}
            />
          ))}
        </div>
      )}


      {/* Lista de chats */}
      <div ref={listRef} className={styles.chatList}>
        {chats?.map((chat) => (
          <ChatListItem
            key={chat.id}
            ultimaMensagem={chat.ultima_mensagem}
            mensagemData={chat.ultima_atualizacao}
            chatId={chat.id}
            isActive={activeChat?.id === chat.id}
            name={chat.contato_nome}
            status={chat.status}
            avatar={chat.foto_perfil}
            fetchImageProfile={fetchImageProfile}
            onClick={() => setActiveChat(chat)}
          />
        ))}

        {hasMoreChats && isLoadingChats && <div className={styles.loadMore}> <div className={styles.spinner}></div> <span>Carregando conversas...</span></div>}
      </div>

      <div className={styles.statusToggleContainer}>
        <button
          className={styles.ChatFilterButton}
          onClick={toggleStatusFilter}
          data-label={filters.status === 'Open' ? 'Exibindo: Chats Abertos' : 'Exibindo: Chats Fechados'}
          data-label-short={filters.status === 'Open' ? 'Abertos' : 'Fechados'}
        />
        {!filters.attendant_id && (
          <button
            className={styles.ChatFilterButton}
            onClick={toggleOwnerFilter}
            data-label={filters.owner === 'all' ? 'Exibindo: Todos Chats' : 'Exibindo: Meus Chats'}
            data-label-short={filters.owner === 'all' ? 'Todos' : 'Meus'}
          />
        )}
      </div>

      {/* Atendentes desktop/admin */}
      {!isMobileLayout &&
        !filters.connection_id &&
        user?.tipo_de_usuario === 'admin' &&
        attendants &&
        attendants.length > 0 &&
        filters.owner === 'all' && (
          (() => {
            const attendantLabel = filters.attendant_id
              ? attendants.find(a => a.user_id === filters.attendant_id)?.user.nome || 'Atendente selecionado'
              : 'Escolha um atendente';

            return (
              <button
                className={`${styles.ChatFilterButton} ${filters.attendant_id ? styles.active : ''}`}
                data-label={attendantLabel}
                onClick={() => {
                  if (filters.attendant_id) {
                    handleAttendantSelect(null);
                  } else {
                    openAttendantsModal();
                  }
                }}
              >
                {filters.attendant_id && <Icon nome="close" />}
              </button>
            );
          })()
        )}


      {/* Atendentes tags mobile/admin */}
      {isMobileLayout &&
        user?.tipo_de_usuario === 'admin' &&
        attendants &&
        attendants.length > 0 &&
        filters.owner === 'all' && (
          <div className={styles.tagsContainer}>
            <Tag
              label="Todos"
              active={!filters.attendant_id && !filters.connection_id}
              onClick={() => {
                handleAttendantSelect(null);
                handleConnectionSelect(null);
              }}
            />
            {attendants.map((att) => (
              <Tag
                key={att.id}
                label={att.user.nome}
                active={filters.attendant_id === att.user_id}
                onClick={() => handleAttendantSelect(att.user_id)}
              />
            ))}
          </div>
        )}

    </motion.aside>
  );
}

export default React.memo(ChatSidebar);