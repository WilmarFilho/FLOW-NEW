'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, User, Bot, HelpCircle, Phone, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import styles from './HelpPage.module.css';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
}

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }
  },
} as const;

const messageVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 500, damping: 30 }
  },
} as const;

export default function HelpPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // WhatsApp Support Number (Example)
  const SUPPORT_WHATSAPP = '5564994077163';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/help/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id
        },
        body: JSON.stringify({ question: userMessage.content })
      });

      if (!response.ok) throw new Error('Falha na comunicação');

      const data = await response.json();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: data.answer,
        timestamp: new Date(data.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('Erro no chat:', err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: 'Desculpe, tive um problema técnico. Tente novamente ou fale com o suporte humano.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className={styles.pageWrapper}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <header className={styles.pageHeader}>
        <div>
          <h1>Central de Ajuda</h1>
          <p>Tire suas dúvidas com nosso suporte inteligente.</p>
        </div>
        <a
          href={`https://wa.me/${SUPPORT_WHATSAPP}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.whatsappBtn}
        >
          <Phone size={16} />
          <span>Fale Conosco</span>
          <ArrowUpRight size={14} style={{ opacity: 0.6 }} />
        </a>
      </header>

      <div className={styles.chatContainer}>
        <div className={styles.messageList} ref={scrollRef}>
          {messages.length === 0 && !loading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <HelpCircle size={32} />
              </div>
              <h2>Como posso ajudar?</h2>
              <p>Pergunte sobre conexões, atendentes, planos ou qualquer outra dúvida sobre o FLOW.</p>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                className={`${styles.messageRow} ${msg.role === 'user' ? styles.messageRowUser : ''}`}
                variants={messageVariants}
                initial="hidden"
                animate="visible"
              >
                <div className={`${styles.messageBubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, opacity: 0.8 }}>
                    {msg.role === 'bot' ? <Bot size={12} /> : <User size={12} />}
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{msg.role === 'bot' ? 'SUPORTE' : 'VOCÊ'}</span>
                  </div>
                  {msg.content}
                  <span className={styles.messageMeta}>{msg.timestamp}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              className={styles.messageRow}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className={styles.typingIndicator}>
                <span>Suporte está processando</span>
                <div style={{ display: 'flex', gap: 3, marginLeft: 8 }}>
                  <div className={styles.typingDot} />
                  <div className={styles.typingDot} />
                  <div className={styles.typingDot} />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <form className={styles.inputWrapper} onSubmit={handleSend}>
          <input
            type="text"
            className={styles.chatInput}
            placeholder="Digite sua dúvida aqui..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!input.trim() || loading}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
