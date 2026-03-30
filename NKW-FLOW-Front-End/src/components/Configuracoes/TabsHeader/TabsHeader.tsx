// Libs
import { motion } from 'framer-motion';
// CSS Modules
import styles from './TabsHeader.module.css';

type Props = {
  tabs: string[];
  activeTab: number;
  setActiveTab: (index: number) => void;
};

export default function TabsHeader({ tabs, activeTab, setActiveTab }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
      className={styles.tabsContainer}
    >
      {tabs.map((tab, index) => (
        <button
          key={index}
          // Lógica para aplicar a classe 'active' de forma mais limpa
          className={`${styles.tabButton} ${index === activeTab ? styles.active : ''}`}
          onClick={() => setActiveTab(index)}
        >
          {tab}
        </button>
      ))}
    </motion.div>
  );
}