'use client';

import { useState } from 'react';
import { Search, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './WhatsappPage.module.css';

export interface PickerOption {
  id: string;
  title: string;
  subtitle?: string;
}

interface SearchablePickerProps {
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchablePicker({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
}: SearchablePickerProps) {
  const [search, setSearch] = useState('');

  const filteredOptions = (
    search
      ? options.filter(
        (opt) =>
          opt.title.toLowerCase().includes(search.toLowerCase()) ||
          (opt.subtitle && opt.subtitle.toLowerCase().includes(search.toLowerCase()))
      )
      : options
  ).slice(0, 1);

  return (
    <div className={styles.pickerContainer}>
      <div className={styles.pickerSearch}>
        <Search size={16} color="rgba(255, 255, 255, 0.4)" />
        <input
          type="text"
          className={styles.pickerSearchInput}
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.pickerList}>
        <AnimatePresence initial={false}>
          {!search && (
            <motion.button
              type="button"
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`${styles.pickerBtn} ${value === '' ? styles.pickerBtnActive : ''}`}
              onClick={() => onChange('')}
            >
              <div className={styles.pickerBtnContent}>
                <span className={styles.pickerBtnTitle}>Nenhum selecionado</span>
              </div>
              {value === '' && <CheckCircle2 size={18} color="#1269f4" />}
            </motion.button>
          )}

          {filteredOptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              Nenhum resultado
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <motion.button
                key={opt.id}
                type="button"
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`${styles.pickerBtn} ${value === opt.id ? styles.pickerBtnActive : ''}`}
                onClick={() => onChange(opt.id)}
              >
                <div className={styles.pickerBtnContent}>
                  <span className={styles.pickerBtnTitle}>{opt.title}</span>
                  {opt.subtitle && <span className={styles.pickerBtnSubtitle}>{opt.subtitle}</span>}
                </div>
                {value === opt.id && <CheckCircle2 size={18} color="#1269f4" />}
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
