'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, BookOpenText, Users, MessageSquareShare, ArrowRight } from 'lucide-react';
import { DOCS_DATA, getDocBySlug } from '@/lib/docsData';
import styles from '@/components/docs/Docs.module.css';

export default function DocsMainPage() {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  // A simple markdown renderer just for demonstration.
  const renderMarkdownText = (text: string) => {
    const lines = text.trim().split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return <h1 key={idx}>{trimmed.substring(2)}</h1>;
      } else if (trimmed.startsWith('## ')) {
        return <h2 key={idx}>{trimmed.substring(3)}</h2>;
      } else if (trimmed.startsWith('### ')) {
        return <h3 key={idx}>{trimmed.substring(4)}</h3>;
      } else if (trimmed.startsWith('- ')) {
        const parseBold = trimmed.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <ul key={idx}><li dangerouslySetInnerHTML={{ __html: parseBold }} /></ul>;
      } else if (trimmed.startsWith('> ')) {
        return <blockquote key={idx}>{trimmed.substring(2)}</blockquote>;
      } else if (trimmed.length === 0) {
        return <br key={idx} />;
      } else {
        const parseBold = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <p key={idx} dangerouslySetInnerHTML={{ __html: parseBold }} />;
      }
    });
  };

  const handleNavClick = (slug: string) => {
    setActiveSlug(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeDoc = activeSlug ? getDocBySlug(activeSlug) : null;

  return (
    <div className={styles.docsLayout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoContainer} onClick={() => setActiveSlug(null)} style={{ cursor: 'pointer' }}>
            <img src="/assets/logo.svg" alt="FLOW Logo" className={styles.logoImage} />
          </div>

        </div>
        <div className={styles.headerRight}>

          <div className={styles.searchBar}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Pesquisar documentação..."
              className={styles.searchInput}
            />
          </div>

          <Link href="/" className={styles.appBtn}>
            Acessar o App
          </Link>
        </div>
      </header>

      <div className={styles.mainArea}>
        <aside className={styles.sidebar}>
          {DOCS_DATA.map((section, idx) => (
            <div key={idx} className={styles.sidebarSection}>
              <h4 className={styles.sidebarTitle}>{section.title}</h4>
              <ul className={styles.sidebarList}>
                {section.items.map((item) => {
                  const isActive = activeSlug === item.slug;
                  return (
                    <li key={item.slug}>
                      <button
                        onClick={() => handleNavClick(item.slug)}
                        className={`${styles.sidebarBtn} ${isActive ? styles.sidebarBtnActive : ''}`}
                      >
                        {item.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>

        <main className={styles.contentWrapper}>
          {!activeDoc ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className={styles.hero}>
                <h1 className="text-4xl font-extrabold text-white mb-4">Bem-vindo à Central de Ajuda do FLOW</h1>
                <p className={styles.heroSubtitle}>
                  Encontre guias completos, tutoriais e referências técnicas para automatizar seu atendimento e vendas com inteligência.
                </p>
              </div>

              <div className={styles.gridCards}>
                <div onClick={() => handleNavClick('introducao')} className={styles.card}>
                  <div className="h-12 w-12 rounded-lg bg-[rgba(18,105,244,0.15)] flex items-center justify-center mb-4 text-[var(--color-primary)]">
                    <BookOpenText size={24} />
                  </div>
                  <h3>Primeiros Passos</h3>
                  <p>Aprenda os conceitos fundamentais do FLOW e como iniciar a automação do seu canal.</p>
                </div>

                <div onClick={() => handleNavClick('gestao-contatos')} className={styles.card}>
                  <div className="h-12 w-12 rounded-lg bg-[rgba(18,105,244,0.15)] flex items-center justify-center mb-4 text-[var(--color-primary)]">
                    <Users size={24} />
                  </div>
                  <h3>Kanban e CRM</h3>
                  <p>Organize clientes em etapas de funil para facilitar a comunicação e fechar mais vendas.</p>
                </div>

                <div onClick={() => handleNavClick('conexoes-whatsapp')} className={styles.card}>
                  <div className="h-12 w-12 rounded-lg bg-[rgba(18,105,244,0.15)] flex items-center justify-center mb-4 text-[var(--color-primary)]">
                    <MessageSquareShare size={24} />
                  </div>
                  <h3>Conexões WhatsApp</h3>
                  <p>Conecte seus números oficiais via QR Code e habilite os robôs imediatamente em tempo real.</p>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white mt-12 mb-6">Explore também</h2>
              <ul className="space-y-4">
                <li>
                  <button onClick={() => handleNavClick('campanhas')} className="flex items-center gap-2 text-[var(--color-white)] font-medium hover:underline bg-transparent border-none p-0 cursor-pointer">
                    Como fazer disparos em massa e campanhas
                    <ArrowRight size={16} />
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavClick('bases-conhecimento')} className="flex items-center gap-2 text-[var(--color-white)] font-medium hover:underline bg-transparent border-none p-0 cursor-pointer">
                    Entenda como treinar e afinar sua Inteligência Artificial
                    <ArrowRight size={16} />
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <article className={`${styles.article} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              {renderMarkdownText(activeDoc.content)}
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
