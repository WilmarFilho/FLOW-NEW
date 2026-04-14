'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import styles from './Docs.module.css';

export default function DocsHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <Link href="/docs" className={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#1269F4"/>
            <path d="M15 12L10 8V16L15 12Z" fill="white"/>
          </svg>
          FLOW Docs
        </Link>
        <div className={styles.searchBar}>
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Pesquisar documentação..." 
            className={styles.searchInput}
          />
        </div>
      </div>
      <div className={styles.headerRight}>
        <Link href="/login" className={styles.loginBtn}>
          Entrar
        </Link>
        <Link href="/" className={styles.appBtn}>
          Acessar o App
        </Link>
      </div>
    </header>
  );
}
