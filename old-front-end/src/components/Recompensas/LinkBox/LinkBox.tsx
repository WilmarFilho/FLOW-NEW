import Styles from './LinkBox.module.css';

interface LinkBoxProps {
  link: string;
  onCopy: () => void;
}

/*
<button>Copiar</button>
<Icon nome="copy" />
*/

export default function LinkBox({ onCopy }: LinkBoxProps) {
  return (
    <div className={Styles.containerLink}>
      <h4>Seu link de indicação</h4>
      <p>
        Envie este link para seus amigos. A cada indicação válida você avança na barra e desbloqueia recompensas.
      </p>
      <div onClick={onCopy} className={Styles.boxLink}>
        
        <span>EM BREVE. POR ENQUANTO FALE COM NOSSO SUPORTE PARA VERIFICAR CONDIÇÔES PARA INDICAR UM AMIGO</span>
        
      </div>
    </div>
  );
}