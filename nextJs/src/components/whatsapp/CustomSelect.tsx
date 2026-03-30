'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './CustomSelect.module.css';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
}

const dropdownVariants = {
  hidden: {
    opacity: 0,
    y: -8,
    scale: 0.97,
    transition: { duration: 0.15, ease: 'easeIn' as const },
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 500, damping: 30 },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.97,
    transition: { duration: 0.12, ease: 'easeIn' as const },
  },
};

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  searchable = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const filteredOptions = search
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(search.toLowerCase()) ||
          (opt.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearch('');
  };

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (isOpen) setSearch('');
  };

  return (
    <div className={styles.selectContainer} ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        className={`${styles.selectTrigger} ${isOpen ? styles.selectTriggerOpen : ''}`}
        onClick={handleToggle}
      >
        <span className={selectedOption ? styles.selectValue : styles.selectPlaceholder}>
          {selectedOption ? (
            <span className={styles.selectedDisplay}>
              <span className={styles.selectedLabel}>{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className={styles.selectedSublabel}>{selectedOption.sublabel}</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <motion.span
          className={styles.selectChevron}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.selectDropdown}
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Search bar */}
            {searchable && (
              <div className={styles.selectSearch}>
                <Search size={14} className={styles.selectSearchIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  className={styles.selectSearchInput}
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}

            {/* Option list */}
            <div className={styles.selectOptions}>
              {filteredOptions.length === 0 ? (
                <div className={styles.selectEmpty}>Nenhum resultado encontrado</div>
              ) : (
                filteredOptions.map((opt) => (
                  <motion.button
                    key={opt.value}
                    type="button"
                    className={`${styles.selectOption} ${opt.value === value ? styles.selectOptionActive : ''}`}
                    onClick={() => handleSelect(opt.value)}
                    whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className={styles.selectOptionContent}>
                      <span className={styles.selectOptionLabel}>{opt.label}</span>
                      {opt.sublabel && (
                        <span className={styles.selectOptionSublabel}>{opt.sublabel}</span>
                      )}
                    </div>
                    {opt.value === value && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring' as const, stiffness: 500, damping: 25 }}
                      >
                        <Check size={16} className={styles.selectOptionCheck} />
                      </motion.span>
                    )}
                  </motion.button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
