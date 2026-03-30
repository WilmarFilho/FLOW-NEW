import { useState, useMemo, useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { validateAttendantForm } from '../utils/useValidator';
import { useAttendantsActions } from '../attendants/useAttendantsActions';
import type { Attendant, AttendantFormData } from '../../types/attendant';
import type { FilterStatus, SortOrder, SortField } from '../../types/table';
import { activeChatState, attendantsState, chatFiltersState, connectionsState, userState } from '../../state/atom';

export function useAtendentesPage() {

  const setActiveChat = useSetRecoilState(activeChatState);
  const setFilters = useSetRecoilState(chatFiltersState);

  // resetar o chat ativo ao entrar na página
  useEffect(() => {
    setActiveChat(null);
    setFilters(prev => ({
      ...prev,
      isFetching: false,
    }));
  }, []);

  const user = useRecoilValue(userState);

  const attendants = useRecoilValue(attendantsState);
  const connections = useRecoilValue(connectionsState);
  const { addAttendant, removeAttendant, editAttendant, updateAttendantStatus } = useAttendantsActions();

  const [activeFilter, setActiveFilter] = useState<FilterStatus>('todos');
  const [sortField, setSortField] = useState<SortField<AttendantFormData>>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showErrors, setShowErrors] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<AttendantFormData | null>(null);
  const [editAttendantId, setEditAttendantId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AttendantFormData | null>(null);

  const handleDelete = async (id: string | number) => {
    setIsSubmitting(true);
    try {
      await removeAttendant(id.toString());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusToggle = async (attendant: Attendant) => {
    setSubmittingId(attendant.id);
    try {
      await updateAttendantStatus(attendant);
    } finally {
      setTimeout(() => {
        setSubmittingId(null);
      }, 400);
    }
  };

  const handleEdit = (attendant: Attendant) => {
    setEditAttendantId(attendant.id);

    const data: AttendantFormData = {
      id: attendant.id,
      user_id: attendant.user_id,
      nome: attendant.user.nome,
      email: attendant.user.email,
      status: attendant.user.status,
      numero: attendant.user.numero,
      connection_id: attendant.connection_id || '',
    };

    setEditData(data);
    setFormData(data);
    setIsModalOpen(true);
  };

  const handleFormChange = (data: AttendantFormData) => setFormData(data);

  const handleModalSaveClick = async () => {
    setShowErrors(true);
    if (!formData) return;

    const foundErrors = validateAttendantForm(formData, !!editData);
    if (Object.keys(foundErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      if (editAttendantId) {
        await editAttendant(editAttendantId, formData);
      } else {
        await addAttendant(formData);
      }
      closeModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  const openModal = () => {
    setShowErrors(false);
    setEditAttendantId(null);
    setEditData(null);
    setFormData(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditAttendantId(null);
    setIsModalOpen(false);
  };

  const filteredAttendants = useMemo(() => {
    if (activeFilter === 'todos') return attendants;
    const isActive = activeFilter === 'ativo';
    return attendants?.filter(a => a.user.status === isActive);
  }, [attendants, activeFilter]);

  const sortedAttendants = useMemo(() => {
    const data = filteredAttendants ? [...filteredAttendants] : [];
    if (!sortField) return data;
    return data.sort((a, b) => {
      const valA = getValue(a);
      const valB = getValue(b);
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredAttendants, sortField, sortOrder]);

  function getValue(attendant: Attendant) {
    switch (sortField) {
      case 'nome': return attendant.user.nome.toLowerCase();
      case 'email': return attendant.user.email.toLowerCase();
      case 'numero': return attendant.user.numero;
      case 'status': return attendant.user.status ? 1 : 0;
      default: return '';
    }
  }

  return {
    user,
    attendants: sortedAttendants,
    connections,
    sortField,
    sortOrder,
    activeFilter,
    editData,
    isModalOpen,
    isSubmitting,
    formData,
    showErrors,
    handleDelete,
    handleEdit,
    handleSave: handleModalSaveClick,
    handleStatusToggle,
    handleFormChange,
    setActiveFilter,
    setSortField,
    setIsSubmitting,
    setSortOrder,
    openModal,
    closeModal,
    submittingId
  };
}