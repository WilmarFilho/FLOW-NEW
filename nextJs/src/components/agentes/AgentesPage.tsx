'use client';

import { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import useSWR from 'swr';
import { ShoppingCart, MessageSquare, LifeBuoy, ArrowRight, X } from 'lucide-react';
import styles from './AgentesPage.module.css';

interface Agente {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  system_prompt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const fetchAgentes = async (): Promise<Agente[]> => {
  const res = await fetch(`${API_URL}/agentes-ia`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

const SWR_OPTIONS = {
  revalidateOnFocus: false, // data rarely changes
  dedupingInterval: 60000,
};

// ─── Animation Variants ───
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', damping: 20, stiffness: 260 },
  },
};

const IconMap: Record<string, React.ElementType> = {
  ShoppingCart,
  MessageSquare,
  LifeBuoy,
};

export default function AgentesPage() {
  const [selectedAgente, setSelectedAgente] = useState<Agente | null>(null);

  const { data: agentes = [], isLoading } = useSWR('agentes-ia', fetchAgentes, SWR_OPTIONS);

  return (
    <div className={styles.pageContainer} style={{ position: 'relative' }}>
      {/* Loading */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className={styles.loadingOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.4, ease: 'easeInOut' } }}
          >
            <motion.div
              className={styles.loadingSpinnerRing}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 20 } }}
            />
            <motion.span
              className={styles.loadingMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              Carregando agentes IA...
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        className={`${styles.header} ${isLoading ? styles.contentBlurred : ''}`}
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className={styles.titleArea}>
          <h1>Agentes IA</h1>
          <p>Seus especialistas baseados em Inteligência Artificial</p>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        className={`${styles.contentWrapper} ${isLoading ? styles.contentBlurred : ''}`}
        animate={{ filter: isLoading ? 'blur(6px)' : 'blur(0px)', opacity: isLoading ? 0.5 : 1 }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence mode="wait">
          {!isLoading && agentes.length > 0 && (
            <motion.div
              key="grid"
              className={styles.grid}
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0 }}
            >
              {agentes.map((agente) => {
                const IconComponent = IconMap[agente.icone] || MessageSquare;

                return (
                  <motion.div
                    key={agente.id}
                    className={styles.card}
                    variants={itemVariants}
                    layout
                    onClick={() => setSelectedAgente(agente)}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.iconWrapper}>
                        <IconComponent size={24} />
                      </div>
                      <div>
                        <h3 className={styles.cardTitle}>{agente.nome}</h3>
                      </div>
                    </div>

                    <p className={styles.cardDesc}>{agente.descricao}</p>

                    <div className={styles.cardFooter}>
                      <button className={styles.detailsBtn}>
                        Detalhes do agente
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedAgente && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAgente(null)}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <div className={styles.modalIcon}>
                  {(() => {
                    const IconComp = IconMap[selectedAgente.icone] || MessageSquare;
                    return <IconComp size={28} />;
                  })()}
                </div>
                <div className={styles.modalTitleArea}>
                  <h2>{selectedAgente.nome}</h2>
                  <p>{selectedAgente.descricao}</p>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>System Prompt (Instruções Base)</label>
                <textarea
                  className={styles.promptTextarea}
                  value={selectedAgente.system_prompt}
                  readOnly
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.closeBtn}
                  onClick={() => setSelectedAgente(null)}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
