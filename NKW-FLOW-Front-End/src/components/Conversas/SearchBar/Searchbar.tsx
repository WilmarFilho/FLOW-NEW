import { useState, useEffect, useRef } from 'react';
// Icon
import Icon from '../../../components/Gerais/Icons/Icons';
// CSS Modules
import styles from './Searchbar.module.css';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({ onSearch, placeholder = 'Pesquisar por nome ou telefone...' }: SearchBarProps) {
  const [inputValue, setInputValue] = useState('');
  const isFirstRender = useRef(true);

  // Debounce: só dispara onSearch após 400ms sem digitação, ignora primeira montagem
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handler = setTimeout(() => {
      onSearch(inputValue);
    }, 400);

    return () => clearTimeout(handler);
  }, [inputValue, onSearch]);

  return (
    <div className={styles.searchContainer} role="search">
      <div className={styles.iconWrapper}>
        <Icon nome='search' />
      </div>
      <input
        type="text"
        className={styles.searchInput}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
    </div>
  );
}