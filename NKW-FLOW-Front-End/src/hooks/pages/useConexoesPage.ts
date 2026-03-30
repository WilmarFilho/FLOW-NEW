import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { activeChatState, addConnectionModalState, agentsState, chatFiltersState, ragStatusState, userState } from '../../state/atom';
import { validateConnectionForm } from '../utils/useValidator';
import { useConnectionsActions } from '../connections/useConnectionsActions'
import type { Connection } from '../../types/connection';
import type { FilterStatus, SortOrder, SortField } from '../../types/table';

export function useConexoesPage() {

  const ragStatus = useRecoilValue(ragStatusState);

  const setActiveChat = useSetRecoilState(activeChatState);
  const setFilters = useSetRecoilState(chatFiltersState);

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // resetar o chat ativo ao entrar na página
  useEffect(() => {
    setActiveChat(null);
    setFilters(prev => ({
      ...prev,
      isFetching: false,
    }));
  }, []);

  const [user] = useRecoilState(userState);

  const { connections, removeConnection, updateConnectionStatus, handleStartSession, handleEditConnection, setConnections } = useConnectionsActions();

  const [agents] = useRecoilState(agentsState);

  // Controle de Filtro e Ordenação
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('todos');
  const [sortField, setSortField] = useState<SortField<Connection>>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Controle de Erros e Modal
  const [modalState, setModalState] = useRecoilState(addConnectionModalState);
  const [formData, setFormData] = useState<Partial<Connection> | null>(null);
  const [showQR, setShowQr] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Connection, string>>>({});

  const handleShowQR = useCallback(async (isShow: boolean) => {
    setShowQr(isShow);
    setModalState((prev) => ({ ...prev, step: 2 }));
  }, [setShowQr, setModalState]); // <-- Dependências corretas

  const handleDelete = useCallback(async (id: string | number) => {
    setIsSubmitting(true);
    try {
      await removeConnection(id.toString());
    } finally {
      setIsSubmitting(false);
    }
  }, [removeConnection]);

  const handleStatusToggle = useCallback(async (connection: Connection) => {
    setSubmittingId(connection.id);
    try {
      await updateConnectionStatus(connection);
    } finally {
      setTimeout(() => {
        setSubmittingId(null);
      }, 400);
    }
  }, [updateConnectionStatus]);

  const openModal = useCallback((conn?: Connection) => {
    setErrors({});
    setShowErrors(false);

    if (conn) {
      setFormData(conn);
      setModalState((prev) => ({
        ...prev,
        isOpen: true,
        editMode: true,
        step: 2,
        qrCode: null,
        isLoading: false,
      }));
    } else {
      setFormData(null);
      setModalState((prev) => ({
        ...prev,
        isOpen: true,
        editMode: false,
        step: 1,
        qrCode: null,
        isLoading: false,
      }));
    }
  }, [setModalState]);

  const handleEdit = useCallback((conn: Connection) => {
    openModal(conn);
  }, [openModal]);

  const closeModal = useCallback(() => {
    try {
      if (modalState.step === 2 && formData) {
        setConnections((prev) => {
          if (!prev) return prev;
          const pending = prev.find(
            (c) =>
              c.status === null &&
              c.nome === formData.nome &&
              (formData.numero ? c.numero === formData.numero : true)
          );
          if (!pending) return prev;
          return prev.filter((c) => c.id !== pending.id);
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      // console.error('Erro ao fechar modal de conexão', err);
    } finally {
      setModalState({
        isOpen: false,
        editMode: false,
        step: 1,
        qrCode: null,
        isLoading: false,
      });
      setFormData(null);
    }
  }, [modalState.step, formData, setConnections, setModalState]);

  const handleModalSaveClick = useCallback(async () => {
   
    const foundErrors = validateConnectionForm(formData, user?.plano, modalState.editMode, showQR);

    if (Object.keys(foundErrors).length > 0) {
      setErrors(foundErrors);
      setShowErrors(true);
      return;
    }

    setErrors({});
    setShowErrors(false);

    if (formData) {
      if (modalState.editMode) {
        await handleEditConnection(formData);
        closeModal();
      } else {
        await handleStartSession(formData);
      }
    }
  }, [formData, modalState.editMode, handleEditConnection, closeModal, handleStartSession]);

  const filteredConnections = useMemo(() => {
    if (activeFilter === 'todos') return connections;
    const isActive = activeFilter === 'ativo';
    return connections?.filter((c) => c.status === isActive);
  }, [connections, activeFilter]);

  const sortedConnections = useMemo(() => {
    if (!sortField) return filteredConnections;

    return [...(filteredConnections ?? [])].sort((a, b) => {
      const aValue = a[sortField]?.toString().toLowerCase() ?? '';
      const bValue = b[sortField]?.toString().toLowerCase() ?? '';

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredConnections, sortField, sortOrder]);

  return {
    user,
    isLoading: modalState.isLoading,
    submittingId,
    qrCode: modalState.qrCode,
    pairingCode: modalState.pairingCode,
    step: modalState.step,
    connections: sortedConnections,
    agents,
    closeModal,
    activeFilter,
    sortField,
    sortOrder,
    modalState,
    formData,
    errors,
    showErrors,
    setFormData,
    setModalState,
    isSubmitting,
    setActiveFilter,
    setSortField,
    setSortOrder,
    handleDelete,
    handleStatusToggle,
    handleEdit,
    openModal,
    setErrors,
    handleModalSaveClick,
    handleShowQR,
    showQR,
    ragStatus
  };
}

