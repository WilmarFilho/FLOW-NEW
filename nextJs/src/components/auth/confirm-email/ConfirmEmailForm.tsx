import styles from '../AuthForm.module.css';

interface ConfirmEmailFormProps {
  onSwitchView?: () => void;
}

export default function ConfirmEmailForm({ onSwitchView }: ConfirmEmailFormProps) {
  return (
    <div className={styles.loginBox}>

      <h2 className={styles.title}>Confirme seu e-mail</h2>
      <p className={styles.description}>
        Acabamos de enviar um e-mail de confirmação para você. Verifique sua caixa de entrada e clique no link para ativar sua conta.
      </p>

      <button
        onClick={() => {
          if (onSwitchView) onSwitchView();
          else window.location.href = '/login';
        }}
        className={styles.socialBtn}
        style={{ marginTop: '20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none' }}
      >
        Voltar para o Login
      </button>

      <div className={styles.links}>
        {/* Removido o link solto para usar um botão mais visível, mantendo o layout limpo */}
      </div>
    </div>
  );
}
