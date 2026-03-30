import Styles from './ConvitesCount.module.css';

interface ConvitesCountProps {
  confirmados: number;
}

export default function ConvitesCount({ confirmados }: ConvitesCountProps) {
  return (
    <div className={Styles.containerCountConvites}>
      <h2>Suas indicações:</h2>
      <p>{confirmados} confirmadas</p>
    </div>
  );
}