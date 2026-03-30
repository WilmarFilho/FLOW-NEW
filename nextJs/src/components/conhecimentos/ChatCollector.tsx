'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Paperclip, Bot, FileText, Image, FileSpreadsheet } from 'lucide-react';
import styles from './ConhecimentosPage.module.css';

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface ChatCollectorProps {
  conhecimentoId: string;
  titulo: string;
  userId: string;
  status: string;
  percentualConclusao?: number;
  onClose: () => void;
  onStatusChange?: (status: string) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ChatCollector({
  conhecimentoId,
  titulo,
  userId,
  status,
  percentualConclusao = 0,
  onClose,
  onStatusChange,
}: ChatCollectorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [progress, setProgress] = useState(status === 'ready' ? 100 : percentualConclusao);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Initialize conversation
  useEffect(() => {
    const startConversation = async () => {
      try {
        const res = await fetch(`${API_URL}/conhecimentos/${conhecimentoId}/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
        });
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error('Failed to start conversation:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    startConversation();
  }, [conhecimentoId, userId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    // Optimistic user message
    const userMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch(`${API_URL}/conhecimentos/${conhecimentoId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();

      // Add AI response
      const aiMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.message,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (data.isComplete) {
        onStatusChange?.('ready');
      }
      if (data.percentual_conclusao !== undefined) {
        setProgress(data.percentual_conclusao);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      const errMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro. Tente novamente.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setIsTyping(true);

    // Show file upload indicator
    const fileMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: `[Arquivo enviado: ${file.name}]`,
      metadata: { file_type: file.type, file_name: file.name },
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, fileMsg]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/conhecimentos/${conhecimentoId}/upload`, {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: formData,
      });
      const data = await res.json();

      const ackMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.message || `Arquivo "${file.name}" processado com sucesso.`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, ackMsg]);
    } catch (err) {
      console.error('File upload failed:', err);
      const errMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Falha no upload do arquivo. Verifique o formato e tente novamente.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getFileIcon = (metadata?: Record<string, any>) => {
    const type = metadata?.file_type || '';
    if (type.includes('pdf')) return <FileText size={16} />;
    if (type.includes('image')) return <Image size={16} />;
    if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet size={16} />;
    return <FileText size={16} />;
  };

  const isFileMessage = (msg: Message) =>
    msg.content.startsWith('[Arquivo enviado:');

  return (
    <motion.div
      className={styles.chatOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.chatContainer}
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderLeft}>
            <div className={styles.chatAvatar}>
              <Bot size={20} />
            </div>
            <div className={styles.chatHeaderInfo}>
              <h3>{titulo}</h3>
              <p>Assistente de coleta de conhecimento</p>
            </div>
          </div>
          <button className={styles.chatCloseBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className={styles.progressBarContainer}>
          <div 
            className={styles.progressBarFill} 
            style={{ width: `${progress}%`, background: progress === 100 ? 'var(--color-success, #22c55e)' : 'var(--color-secondary)' }} 
          />
        </div>
        <div className={styles.progressText}>
          {progress === 100 ? 
            '🎉 Informações base mapeadas (100%). Continue enviando para refinar!' : 
            `Progresso do mapeamento: ${progress}%`}
        </div>

        {/* Messages */}
        <div className={styles.chatMessages}>
          {isInitializing ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <div className={styles.spinner} />
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className={msg.role === 'user' ? styles.messageWrapperUser : styles.messageWrapperAssistant}
                >
                  {isFileMessage(msg) ? (
                    <div className={styles.messageFile}>
                      {getFileIcon(msg.metadata)}
                      <span>{msg.metadata?.file_name || msg.content}</span>
                    </div>
                  ) : (
                    <div
                      className={`${styles.messageBubble} ${
                        msg.role === 'user' ? styles.messageUser : styles.messageAssistant
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}
                  <div
                    className={`${styles.messageTime} ${
                      msg.role === 'user' ? styles.messageTimeUser : ''
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* Typing indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                className={styles.typingIndicator}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={styles.chatInputArea}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            className={styles.uploadBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Enviar arquivo (PDF, XLS, Imagem, TXT)"
          >
            <Paperclip size={18} />
          </button>
          <textarea
            ref={inputRef}
            className={styles.chatInput}
            placeholder="Digite sua resposta..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            <Send size={18} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
