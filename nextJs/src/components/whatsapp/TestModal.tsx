'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import styles from './WhatsappPage.module.css';
import type { WhatsappConnection } from './ConnectionCard';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: WhatsappConnection | null;
  apiUrl: string;
  userId: string;
}

export default function TestModal({ isOpen, onClose, connection, apiUrl, userId }: TestModalProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setMessage('');
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  if (!isOpen || !connection) return null;

  const handleSend = async () => {
    const text = message.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setMessage('');
    setIsLoading(true);

    // Simula resposta do bot (mock por enquanto)
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

    const botResponses = [
      `Olá! Obrigado por entrar em contato. Em que posso ajudá-lo hoje?`,
      `Entendi sua dúvida sobre "${text}". Vou verificar e te respondo em instantes!`,
      `Perfeito! Confirmado. Posso ajudar com mais alguma coisa?`,
      `Agradeço sua mensagem! Nosso horário de atendimento é de seg a sex, 9h às 18h.`,
      `Recebi sua solicitação. Um de nossos atendentes vai analisar em breve. 😊`,
    ];

    const botMsg: ChatMessage = {
      id: `bot-${Date.now()}`,
      role: 'bot',
      text: botResponses[messages.length % botResponses.length],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, botMsg]);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.chatModal} onClick={(e) => e.stopPropagation()}>
        {/* Chat Header */}
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderInfo}>
            <div className={styles.chatAvatar}>
              {connection.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className={styles.chatHeaderName}>{connection.nome}</h3>
              <span className={styles.chatHeaderStatus}>
                <span className={styles.chatOnlineDot} />
                Online — Modo teste
              </span>
            </div>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Chat Body */}
        <div className={styles.chatBody}>
          {messages.length === 0 && (
            <div className={styles.chatEmpty}>
              <p>Simule um cliente enviando uma mensagem.</p>
              <p>Veja como <strong>{connection.nome}</strong> vai responder.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.chatBubble} ${msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleBot}`}
            >
              <p className={styles.chatBubbleText}>{msg.text}</p>
              <span className={styles.chatBubbleTime}>{formatTime(msg.timestamp)}</span>
            </div>
          ))}

          {isLoading && (
            <div className={`${styles.chatBubble} ${styles.chatBubbleBot}`}>
              <div className={styles.chatTyping}>
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className={styles.chatInputBar}>
          <input
            ref={inputRef}
            className={styles.chatInput}
            type="text"
            placeholder="Simule a mensagem de um cliente..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className={styles.chatSendBtn}
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
