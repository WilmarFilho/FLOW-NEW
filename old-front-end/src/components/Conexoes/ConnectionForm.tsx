import { useRecoilValue } from 'recoil';
import Select, { OnChangeValue } from 'react-select';
import { Connection } from '../../types/connection';
import formStyles from '../Gerais/Form/form.module.css';
import styles from './ConnectionForm.module.css';
import { agentsState } from '../../state/atom';

import {
  useMediaQuery,
  getCustomSelectStyles,
  AnimatedMenu,
  SelectOption,
} from '../Gerais/Form/CustomSelect';
import { User } from '@/types/user';

interface ConnectionFormProps {
  formData: Partial<Connection> | null;
  onChange: (data: Partial<Connection> | null) => void;
  step: 1 | 2 | 3;
  qrCode: string | null;
  pairingCode?: string | null;
  showQR?: boolean;
  handleShowQR: (data: boolean) => void;
  editMode?: boolean;
  errors?: Partial<Record<keyof Connection, string>>;
  showErrors?: boolean;
  user: User | null;
}

export default function ConnectionForm({
  user,
  formData,
  onChange,
  step,
  qrCode,
  pairingCode,
  editMode,
  errors = {},
  showErrors = false,
  showQR,
  handleShowQR
}: ConnectionFormProps) {
  const agents = useRecoilValue(agentsState);

  const isMobile = useMediaQuery('(max-width: 600px)');
  const customStyles = getCustomSelectStyles(isMobile);

  const agentOptions: SelectOption[] =
    agents?.map((agent) => ({
      value: agent.id,
      label: agent.tipo_de_agente,
    })) || [];

  const selectedAgent =
    agentOptions.find((opt) => opt.value === formData?.agente_id) || null;

  const handleAgentChange = (
    selectedOption: OnChangeValue<SelectOption, false>
  ) => {
    onChange({
      ...formData,
      agente_id: selectedOption ? selectedOption.value : '',
    });
  };

  if (step === 1) {
    return (
      <div className={formStyles.formContainer}>

        <div className={formStyles.formRow}>

          <button
            onClick={() => handleShowQR(true)} 
            className={styles.submitButton}
          >
            Conectar escaneando QR
          </button>

        </div>

        <div className={formStyles.formRow}>

          <button
            onClick={() => handleShowQR(false)} 
            className={styles.submitButton}
          >
            Conectar via código
          </button>

        </div>

      </div>
    );
  }


  if (step === 2) {
    return (
      <div className={formStyles.formContainer}>
        <div className={formStyles.formRow}>
          <div className={formStyles.formGroup}>
            <label>Nome da Conexão</label>
            <input
              id="nome"
              type="text"
              value={formData?.nome || ''}
              onChange={(e) =>
                onChange({
                  ...formData,
                  nome: e.target.value,
                })
              }
            />
            {showErrors && errors.nome && (
              <span className={formStyles.errorText}>{errors.nome}</span>
            )}
          </div>

          {/* Select customizado para Agente */}
          {user && user.plano !== 'basico' && (
            <div className={formStyles.formGroup}>
              <label>Agente IA</label>
              <Select<SelectOption>
                inputId="agent"
                options={agentOptions}
                value={selectedAgent}
                onChange={handleAgentChange}
                placeholder="Selecione"
                isClearable
                components={{ Menu: AnimatedMenu }}
                styles={customStyles}
              />
              {showErrors && errors.agente_id && (
                <span className={formStyles.errorText}>{errors.agente_id}</span>
              )}
            </div>
          )}
        </div>

        {!editMode && !showQR && (
          <div className={formStyles.formRow}>
            {/* Campo opcional de número */}
            <div className={formStyles.formGroup}>
              <label>
                Número do WhatsApp
                <span style={{ fontWeight: 400, fontSize: 12, color: '#888', marginLeft: 4 }}>
                  (Formato: 6492434104)
                </span>
              </label>
              <input
                id="numero"
                type="text"
                placeholder="Ex: 6492434104"
                value={formData?.numero || ''}
                onChange={(e) =>
                  onChange({
                    ...formData,
                    numero: e.target.value,
                  })
                }
                pattern="^\d{10,11}$"
                inputMode="numeric"
              />
              {showErrors && errors.numero && (
                <span className={formStyles.errorText}>{errors.numero}</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className={styles.qrCodeStep}>
        <h2>Escaneie o qr code com seu WhatsApp</h2>
        {qrCode ? <img src={qrCode} alt="QR Code" /> : ''}
        {pairingCode ? (
          <div className={styles.pairingCode}>
            <p>Código de pareamento:</p>
            <span>{pairingCode}</span>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
