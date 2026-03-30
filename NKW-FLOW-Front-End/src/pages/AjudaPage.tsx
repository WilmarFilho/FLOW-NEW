import { useState } from 'react';
import { useAjudaPage } from '../hooks/pages/useAjudaPage';
import HelpHeader from '../components/Ajuda/HelpHeader/HelpHeader';
import AIChatWindow from '../components/Ajuda/AIChatWindow/AIChatWindow';
import GlobalStyles from '../global.module.css';
import Icon from '../components/Gerais/Icons/Icons';

export default function AjudaPage() {
  const { messages, sendMessage, isSubmitting } = useAjudaPage();
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (inputValue.trim() === '') return;
    sendMessage(inputValue);
    setInputValue('');
  };

  return (
    <div className={GlobalStyles.pageContainer}>
      <HelpHeader />
      <AIChatWindow messages={messages} isSubmitting={isSubmitting} />
      
      <div className={GlobalStyles.InputContainer}>
        <input
          disabled={isSubmitting}
          placeholder={isSubmitting ? 'Aguarde sua resposta' : 'Pergunte qualquer coisa'}
          className={GlobalStyles.InputForm}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <button
          onClick={handleSend}
          disabled={isSubmitting}
        >
          <Icon nome='send' />
        </button>
      </div>
    </div>
  );
}
