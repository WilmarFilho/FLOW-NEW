import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import AiChatWindow from './AIChatWindow.module.css';
import { MessagesHelpChat } from '../../../types/helpChat';

interface AIChatWindowProps {
  messages: MessagesHelpChat[] | null;
  isSubmitting?: boolean;
}

export default function AIChatWindow({ messages, isSubmitting }: AIChatWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 🎯 Quando mensagens mudam, rola para o final
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSubmitting]);

  return (
    <div ref={containerRef} className={AiChatWindow.aiChatWindow}>
      {messages && messages.map((msg, idx) => (
        <div
          key={idx}
          className={`${AiChatWindow.aiChatMessage} ${
            msg.from === 'user' ? AiChatWindow.user : AiChatWindow.bot
          }`}
        >
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        </div>
      ))}

      {isSubmitting && (
        <div className={`${AiChatWindow.aiChatMessage} ${AiChatWindow.bot}`}>
          <em>Digitando...</em>
        </div>
      )}

      {/* 🧩 Referência para o final do chat */}
      <div ref={bottomRef} />
    </div>
  );
}
