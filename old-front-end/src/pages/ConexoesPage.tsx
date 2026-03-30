// Libs
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
// Components
import Button from '../components/Gerais/Buttons/Button';
import ConnectionForm from '../components/Conexoes/ConnectionForm';
import GenericTable from '../components/Gerais/Tables/GenericTable';
import GenericEntityRow from '../components/Gerais/Tables/GenericEntityRow';
import Modal from '../components/Gerais/Modal/Modal';
// Hooks
import { useConexoesPage } from '../hooks/pages/useConexoesPage';
// Css
import GlobalStyles from '../global.module.css';
import TableStyles from '../components/Gerais/Tables/TableStyles.module.css';
// Type
import { Connection } from '../types/connection';
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

// Função utilitária para checar limite de conexões por plano
function atingiuLimiteDeConexoes(user: User | null, connections: Connection[] | null | undefined) {
  if (!user || !connections) return false;
  const plano = (user.plano);
  const total = connections.length;

  if (plano === 'basico' && total >= 2) return true;
  if (plano === 'intermediario' && total >= 4) return true;
  if (plano === 'premium' && total >= 6) return true;
  return false;
}

export default function ConexoesPage() {

  const {
    connections,
    agents,
    activeFilter,
    sortField,
    sortOrder,
    modalState,
    formData,
    errors,
    showErrors,
    setFormData,
    setActiveFilter,
    setSortField,
    setSortOrder,
    handleDelete,
    handleEdit,
    openModal,
    closeModal,
    handleModalSaveClick,
    isLoading,
    step,
    qrCode,
    submittingId,
    user,
    isSubmitting,
    pairingCode,
    showQR,
    ragStatus,
    handleShowQR
  } = useConexoesPage();

  // --- INÍCIO: estado e handlers para confirmação de exclusão via Chakra ---
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  const openDeleteDialog = (conn: Connection) => {
    setConnectionToDelete(conn);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!connectionToDelete) return;
    try {
      await handleDelete(connectionToDelete.id);
    } finally {
      setIsDeleteDialogOpen(false);
      setConnectionToDelete(null);
    }
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setConnectionToDelete(null);
  };

  const columnTemplate = '1fr 2fr 2fr 2fr 1fr';

  const columns = [
    {
      key: 'status',
      label: 'Status',
      render: (conn: Connection) => {
        const statusLabel =
          conn.status === true ? 'Ativo' :
            conn.status === false ? 'Inativo' :
              'Conectando';

        const statusClass =
          conn.status === true ? TableStyles.active :
            conn.status === false ? TableStyles.inactive :
              TableStyles.inactive;

        return (
          <span
            className={`${TableStyles.statusChip} ${statusClass}`}
          >
            {submittingId === conn.id
              ? <div className={TableStyles.spinner}></div>
              : statusLabel}
          </span>
        );
      },
    },
    {
      key: 'nome',
      label: 'Nome',
      render: (conn: Connection) => conn.nome.split('_')[0],
      onClick: handleEdit, // qualquer clique na coluna chama edit
    },
    {
      key: 'numero',
      label: 'Número',
      render: (conn: Connection) => conn.numero || 'N/A',
      onClick: handleEdit,
    },
    {
      key: 'agente',
      label: 'Agente',
      render: (conn: Connection) => {
        // tenta usar o objeto que já veio populado
        let tipoAgente = conn.agente?.tipo_de_agente;

        // se não tiver, tenta buscar pelo agente_id
        if (!tipoAgente && conn.agente_id && agents && agents.length > 0) {
          const agente = agents.find(a => a.id === conn.agente_id);
          if (agente) {
            tipoAgente = agente.tipo_de_agente;
          }
        }

        return (
          <NavLink to="/agentes">
            {tipoAgente || 'Nenhum'}
          </NavLink>
        );
      },
    }

  ];

  return (
    <div className={GlobalStyles.pageContainer}>
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={GlobalStyles.pageHeader}>
        <div className={GlobalStyles.pageHeaderTitles}>
          <h2>Suas conexões do WhatsApp</h2>
          <h3>Verifique, adicione ou desative suas conexões do WhatsApp.</h3>
        </div>
        {/* Só exibe o botão se não atingiu o limite do plano */}
        {!atingiuLimiteDeConexoes(user, connections) ? (
          ragStatus?.status_conhecimento === 'Vazio' ? (
            <p className={GlobalStyles.textMuted}>
              A base de conhecimento ainda está vazia.
            </p>
          ) : (
            <Button label="Adicionar Conexão" onClick={() => openModal()} />
          )
        ) : (
          <p className={GlobalStyles.textMuted}>
            Limite de conexões <br /> atingido para o seu plano.
          </p>
        )}

      </motion.header>

      <div className={GlobalStyles.pageContent}>
        <GenericTable
          columns={columns.map(c => c.label || '')}
          data={connections}
          renderRow={(conn) => (
            <GenericEntityRow
              key={conn.id}
              item={conn}
              columns={columns}
              columnTemplate={columnTemplate}
              onEdit={handleEdit}
              onDelete={() => openDeleteDialog(conn)}
            />
          )}
          gridTemplateColumns={columnTemplate}
          onSortClick={(col) => {
            const fieldMap: Record<string, 'nome'> = { Nome: 'nome' };
            const selectedField = fieldMap[col];
            if (!selectedField) return;

            if (selectedField === sortField) {
              setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
            } else {
              setSortField(selectedField);
              setSortOrder('asc');
            }
          }}
          sortField={sortField}
          sortOrder={sortOrder}
        />

        <div className={GlobalStyles.filterControls}>
          <button
            className={`${GlobalStyles.button} ${activeFilter === 'ativo' ? GlobalStyles.buttonActive : ''}`}
            onClick={() => setActiveFilter(prev => prev === 'ativo' ? 'todos' : 'ativo')}
          >
            <span>Ver conexões ativas</span>
          </button>

          <button
            className={`${GlobalStyles.button} ${activeFilter === 'inativo' ? GlobalStyles.buttonActive : ''}`}
            onClick={() => setActiveFilter(prev => prev === 'inativo' ? 'todos' : 'inativo')}
          >
            <span>Ver conexões inativas</span>
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
              Excluir Conexão
            </AlertDialogHeader>

            <AlertDialogBody>
              {connectionToDelete ? (
                <>
                  Tem certeza que deseja excluir <strong>{connectionToDelete.nome}</strong>? Esta ação não pode ser desfeita.
                </>
              ) : (
                'Tem certeza que deseja excluir esta conexão?'
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
              {isSubmitting ? (
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
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.editMode ? 'Editar Conexão' : 'Cadastrar Conexão'}
        labelSubmit={modalState.editMode ? 'Salvar Alterações' : 'Gerar Conexão'}
        isSubmitting={isLoading}
        onSave={handleModalSaveClick}
        step={step}
      >
        <ConnectionForm
          user={user}
          onChange={setFormData}
          formData={formData}
          editMode={modalState.editMode}
          step={step}
          qrCode={qrCode}
          showQR={showQR}
          handleShowQR={handleShowQR}
          pairingCode={pairingCode}
          errors={errors}
          showErrors={showErrors}
        />
      </Modal>
    </div>
  );
}

