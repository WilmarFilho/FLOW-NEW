import Select, { OnChangeValue } from 'react-select';
import FormStyles from '../../Gerais/Form/form.module.css';

// Importando tudo do nosso módulo reutilizável
import {
  useMediaQuery,
  getCustomSelectStyles,
  AnimatedMenu,
  SelectOption,
} from '../../Gerais/Form/CustomSelect'; // Ajuste o caminho conforme necessário

interface NewChatFormProps {
  connections: { id: string; nome?: string }[] | null;
  selectedConnectionId: string | null;
  setSelectedConnectionId: (id: string) => void;
  newChatNumber: string;
  setNewChatNumber: (num: string) => void;
  newChatMessage: string;
  setNewChatMessage: (msg: string) => void;
  showErrors: boolean;
  errors: {
    selectedConnectionId?: string;
    newChatNumber?: string;
    newChatMessage?: string;
  };
}

export default function NewChatForm({
  connections ,
  selectedConnectionId,
  setSelectedConnectionId,
  newChatNumber,
  setNewChatNumber,
  newChatMessage,
  setNewChatMessage,
  showErrors,
  errors,
}: NewChatFormProps) {
  // Lógica do select customizado importada e utilizada
  const isMobile = useMediaQuery('(max-width: 600px)');
  const customStyles = getCustomSelectStyles(isMobile);

  const selectOptions: SelectOption[] = connections ? connections.map((conn) => ({
    value: conn.id,
    label: conn.nome || conn.id,
  })) : [];

  const selectedValue = selectOptions.find(
    (option) => option.value === selectedConnectionId
  ) || null;

  const handleSelectChange = (selectedOption: OnChangeValue<SelectOption, false>) => {
    setSelectedConnectionId(selectedOption ? selectedOption.value : '');
  };

  return (
    <div className={FormStyles.formContainer}>
      <div className={FormStyles.formGroupSelect}>
        <label>Conexão para disparar mensagem</label>
        <Select<SelectOption>
          options={selectOptions}
          value={selectedValue}
          onChange={handleSelectChange}
          placeholder="Selecione a conexão"
          isClearable
          components={{ Menu: AnimatedMenu }}
          styles={customStyles}
        />
        {showErrors && errors.selectedConnectionId && (
          <span className={FormStyles.errorText}>
            {errors.selectedConnectionId}
          </span>
        )}
      </div>

      {selectedConnectionId && (
        <div className={`${FormStyles.formRow} ${FormStyles.fieldsAppear}`}>
          <div className={FormStyles.formGroup}>
            <label>Número de Telefone</label>
            <input
              type="text"
              placeholder="Número com DDD (ex: 11999999999)"
              value={newChatNumber}
              onChange={(e) => setNewChatNumber(e.target.value)}
            />
            {showErrors && errors.newChatNumber && (
              <span className={FormStyles.errorText}>{errors.newChatNumber}</span>
            )}
          </div>
          <div className={FormStyles.formGroup}>
            <label>Primeira Mensagem</label>
            <input
              placeholder="Primeira mensagem"
              value={newChatMessage}
              onChange={(e) => setNewChatMessage(e.target.value)}
            />
            {showErrors && errors.newChatMessage && (
              <span className={FormStyles.errorText}>{errors.newChatMessage}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}