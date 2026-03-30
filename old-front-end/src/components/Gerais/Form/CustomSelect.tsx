import { useState, useEffect } from 'react';
import { components, MenuProps, StylesConfig } from 'react-select';
import FormStyles from './form.module.css';

// --- 1. Exportando a Interface de Opção ---
export interface SelectOption {
  value: string;
  label: string;
  isDisabled?: boolean; 
}

// --- 2. Exportando o Hook de Media Query ---
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, [matches, query]);

  return matches;
};

// --- 3. Exportando o Componente de Animação do Menu ---
export const AnimatedMenu = (props: MenuProps<SelectOption>) => {
  return (
    <components.Menu {...props} className={FormStyles.animatedMenu}>
      {props.children}
    </components.Menu>
  );
};

// --- 4. Exportando uma FUNÇÃO que gera os Estilos ---
// (Transformamos em função para poder passar o 'isMobile')
export const getCustomSelectStyles = (isMobile: boolean): StylesConfig<SelectOption> => ({
  control: (provided, state) => ({
    ...provided,
    minHeight: isMobile ? '48px' : '50px',
    height: isMobile ? '48px' : '50px',
    borderRadius: '8px',
    backgroundColor: 'var(--color-background-white)',
    border: state.isFocused ? '1px solid #ffffff23' : '1px solid transparent',
    boxShadow: 'none',
    transition: 'border-color 0.2s ease', // Adicionado para suavidade
    '&:hover': {
      borderColor: state.isFocused ? '#ffffff23' : '#ffffff23', // Simplificado para sempre mostrar borda no hover
    },
  }),
  valueContainer: (provided) => ({
    ...provided,
    padding: '0 10px',
  }),
  singleValue: (provided) => ({
    ...provided,
    color: 'var(--color-text)',
    fontSize: isMobile ? '16px' : '14px',
  }),
  placeholder: (provided) => ({
    ...provided,
    color: '#999999',
    fontSize: isMobile ? '16px' : '14px',
  }),
  menu: (provided) => ({
    ...provided,
    borderRadius: '8px',
    backgroundColor: '#1a1e24',
    boxShadow: '0 4px 12px rgba(1, 0, 0, 0.1)',
    marginTop: '12px',
    overflow: 'hidden',
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused ? '#ffffff1a' : 'transparent', // Efeito hover
    color: '#ffffff90',
    fontSize: isMobile ? '16px' : '14px',
    padding: isMobile ? '12px 15px' : '16px 15px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease', // Adicionado para suavidade
    '&:active': {
      backgroundColor: '#ffffff1a',
    },
  }),
  indicatorSeparator: () => ({ display: 'none' }),
});