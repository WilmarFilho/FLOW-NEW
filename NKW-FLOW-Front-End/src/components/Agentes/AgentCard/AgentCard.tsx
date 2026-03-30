//Css
import styles from './AgentCard.module.css';
//Assets
import VendedorIcon from './assets/tag.svg';
import RecepcionistaIcon from './assets/bell.svg';
import TecnicoIcon from './assets/wrench.svg';
//Libs
import React from 'react';

interface AgentCardProps {
  tipo: string;
  description: string;
  onViewDetails?: () => void;
}

const iconMap = {
  Vendedor: VendedorIcon,
  Recepcionista: RecepcionistaIcon,
  Tecnico: TecnicoIcon,
  Contador: VendedorIcon,
};

export default function AgentCard({ description, tipo, onViewDetails }: AgentCardProps) {

  const IconComponent = iconMap[tipo as keyof typeof iconMap] as React.ElementType;

  return (
    <div className={styles.card} onClick={onViewDetails}>
      {IconComponent && <IconComponent className={styles.icon} aria-label={`Ícone de ${tipo}`} />}
      
      <h4 className={styles.title}>
        <span className={styles.label}>Agente:</span>
        <span className={styles.tipo}>{tipo}</span>
      </h4>

      <p className={styles.description}>{description}</p>
      <button className={styles.buttonCard} onClick={onViewDetails}>Ver Detalhes</button>
    </div>
  );
}