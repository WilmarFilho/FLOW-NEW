// Libs
import { useRecoilState, useSetRecoilState } from 'recoil';
// Recoil
import { helpChatState, userState } from '../../state/atom';
// Hooks
import { useApi } from '../utils/useApi';
// Types
import type { MessagesHelpChat } from '../../types/helpChat';
import { useState } from 'react';

export function useHelpActions() {

  // Carrega o estado do chat de ajuda
  const setMessages = useSetRecoilState(helpChatState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carrega o usuário
  const [user] = useRecoilState(userState);

  // Carrega Metodos do hook da api
  const { post } = useApi();

  const sendMessage = async (text: string) => {
    if (!user) return;

    const userMessage: MessagesHelpChat = {
      from: 'user',
      content: text,
    };

    setMessages(prev => [ ...(prev ?? []), userMessage ]);

    setIsSubmitting(true);

    // Agora espera um array de respostas
    const data = await post<{ respostas: string[] }>('/messages/help', { mensagem: text });

    if (data && Array.isArray(data.respostas)) {
      const novasMensagens: MessagesHelpChat[] = data.respostas.map(resposta => ({
        from: 'system',
        content: resposta,
      }));
      setMessages(prev => [ ...(prev ?? []), ...novasMensagens ]);
      setIsSubmitting(false);
    }
  };

  return { sendMessage, isSubmitting };
}