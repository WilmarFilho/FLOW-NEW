import { motion } from 'framer-motion';
import GlobalStyles from '../global.module.css';
import TableStyles from '../components/Gerais/Tables/TableStyles.module.css';
import GenericEntityRow from '../components/Gerais/Tables/GenericEntityRow';
import GenericTable from '../components/Gerais/Tables/GenericTable';
import Modal from '../components/Gerais/Modal/Modal';
import AttendantForm from '../components/Atendentes/AttendantForm';
import Button from '../components/Gerais/Buttons/Button';
import { useAtendentesPage } from '../hooks/pages/useAttendantsPage';
import type { Attendant } from '../types/attendant';
import { useRef, useState } from 'react';

import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button as ChakraButton,
} from '@chakra-ui/react';
import { User } from '@/types/user';


// Função utilitária para checar limite de atendentes por plano
function atingiuLimiteDeAtendentes(user: User, attendants: Attendant[]) {
  if (!user || !attendants) return false;
  const plano = (user.plano || '').toLowerCase();
  const total = attendants.length;

  if (plano === 'basico' && total >= 2) return true;
  if (plano === 'intermediario' && total >= 4) return true;
  if (plano === 'premium' && total >= 6) return true;
  return false;
}

export default function AtendentesPage() {

  const state = useAtendentesPage();

  if (!state.user) return null;

  // --- INÍCIO: estado para confirmação de exclusão via Chakra AlertDialog ---
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [attendantToDelete, setAttendantToDelete] = useState<Attendant | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  const openDeleteDialog = (att: Attendant) => {
    setAttendantToDelete(att);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!attendantToDelete) return;
    try {
      await state.handleDelete(attendantToDelete.id);
    } finally {
      setIsDeleteDialogOpen(false);
      setAttendantToDelete(null);
    }
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setAttendantToDelete(null);
  };

  const columnTemplate = '1fr 2fr 2fr 2fr 1fr';

  const columns = [
    {
      key: 'user',
      label: 'Status',
      render: (item: Attendant) => (
        <span
          className={`${TableStyles.statusChip} ${item.user.status ? TableStyles.active : TableStyles.inactive}`}
          onClick={() => state.handleStatusToggle(item)}
        >
          {state.submittingId === item.id ? <div className={TableStyles.spinner}></div> : item.user.status ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    { key: 'user', label: 'Nome', render: (item: Attendant) => item.user.nome, onClick: state.handleEdit },
    { key: 'user', label: 'Email', render: (item: Attendant) => item.user.email, onClick: state.handleEdit },
    { key: 'user', label: 'Conexão', render: (item: Attendant) => item.connection.nome, onClick: state.handleEdit },
  ];

  return (
    <div className={GlobalStyles.pageContainer}>
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={GlobalStyles.pageHeader}>
        <div className={GlobalStyles.pageHeaderTitles}>
          <h2>Seus atendentes humanos</h2>
          <h3>Cadastre e gerencie os atendentes que podem interagir com seus clientes e serão notificados quando precisarem assumir a conversa.</h3>
        </div>
        {/* Só exibe o botão se não atingiu o limite do plano */}
        {!atingiuLimiteDeAtendentes(state.user, state.attendants) ? (
          <Button label="Adicionar Atendente" onClick={state.openModal} />
        ) : (
          <p className={GlobalStyles.textMuted}>Limite de atendentes <br /> atingido para o seu plano.</p>
        )}
      </motion.header>

      <div className={GlobalStyles.pageContent}>
        <GenericTable
          columns={columns.map(c => c.label || '')}
          data={state.attendants}
          renderRow={(attendant) => (
            <GenericEntityRow
              key={attendant.id}
              item={attendant}
              columns={columns}
              columnTemplate={columnTemplate}
              onEdit={state.handleEdit}
              onDelete={() => openDeleteDialog(attendant)}
            />
          )}
          gridTemplateColumns={columnTemplate}
          sortField={state.sortField}
          sortOrder={state.sortOrder}
          onSortClick={(col) => {
            const fieldMap: Record<string, 'nome' | 'email' | 'numero' | 'status'> = {
              Nome: 'nome',
              Email: 'email',
              Número: 'numero',
              Status: 'status',
            };
            const selectedField = fieldMap[col];
            if (!selectedField) return;
            if (selectedField === state.sortField) state.setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
            else { state.setSortField(selectedField); state.setSortOrder('asc'); }
          }}
        />

        <div className={GlobalStyles.filterControls}>
          <button
            className={`${GlobalStyles.button} ${state.activeFilter === 'ativo' ? GlobalStyles.buttonActive : ''}`}
            onClick={() => state.setActiveFilter(prev => prev === 'ativo' ? 'todos' : 'ativo')}
          >
            <span>Ver atendentes ativos</span>
          </button>

          <button
            className={`${GlobalStyles.button} ${state.activeFilter === 'inativo' ? GlobalStyles.buttonActive : ''}`}
            onClick={() => state.setActiveFilter(prev => prev === 'inativo' ? 'todos' : 'inativo')}
          >
            <span>Ver atendentes inativos</span>
          </button>
        </div>
      </div>

      <AlertDialog
        isOpen={isDeleteDialogOpen}
        leastDestructiveRef={cancelDeleteRef}
        onClose={closeDeleteDialog}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Excluir Atendente
            </AlertDialogHeader>

            <AlertDialogBody>
              {attendantToDelete ? (
                <>
                  Tem certeza que deseja excluir <strong>{attendantToDelete.user.nome}</strong>? Esta ação não pode ser desfeita.
                </>
              ) : (
                'Tem certeza que deseja excluir este atendente?'
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
              {state.isSubmitting? (
                <div className={TableStyles.spinnerRed} style={{ marginRight: '10px' }}></div>
              ) : (
                <>
                  <ChakraButton ref={cancelDeleteRef} onClick={closeDeleteDialog}>
                    Cancelar
                  </ChakraButton>
                  <ChakraButton colorScheme="red" onClick={confirmDelete} ml={3}>
                    Excluir
                </ChakraButton>
                </>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <Modal
        isOpen={state.isModalOpen}
        onClose={state.closeModal}
        title={state.editData ? 'Editar Atendente' : 'Cadastrar Novo Atendente'}
        labelSubmit={state.editData ? 'Editar Atendente' : 'Cadastrar Atendente'}
        isSubmitting={state.isSubmitting}
        onSave={state.handleSave}
      >
        <AttendantForm
          connections={state.connections}
          initialData={state.editData || undefined}
          editMode={!!state.editData}
          onChange={state.handleFormChange}
          isSubmitting={state.isSubmitting}
          triggerValidation={state.showErrors}
        />
      </Modal>
    </div>
  );
}