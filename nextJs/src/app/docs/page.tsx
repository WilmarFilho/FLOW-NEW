'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, BookOpenText, Users, MessageSquareShare, ArrowRight, List } from 'lucide-react';
import { DOCS_DATA, getDocBySlug } from '@/lib/docsData';
import styles from '@/components/docs/Docs.module.css';

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // divide into base letters and diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // remove diacritical marks
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export default function DocsMainPage() {
  const [activeSlug, setActiveSlug] = useState<string | null>('introducao');

  const activeDoc = activeSlug ? getDocBySlug(activeSlug) : null;

  // Extract headings for Table of Contents
  const toc = useMemo(() => {
    if (!activeDoc) return [];
    const lines = activeDoc.content.trim().split('\n');
    const headings: { id: string; text: string; level: number }[] = [];
    
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) {
        const text = trimmed.substring(3).replace(/\*\*/g, '').replace(/\`/g, '');
        headings.push({ id: slugify(text), text, level: 2 });
      } else if (trimmed.startsWith('### ')) {
        const text = trimmed.substring(4).replace(/\*\*/g, '').replace(/\`/g, '');
        headings.push({ id: slugify(text), text, level: 3 });
      }
    });

    return headings;
  }, [activeDoc]);

  // A simple markdown renderer just for demonstration.
  const renderMarkdownText = (text: string) => {
    const lines = text.trim().split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      
      const parseInline = (str: string) => {
        let parsed = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        parsed = parsed.replace(/\`(.*?)\`/g, '<code class="docs-inline-code">$1</code>');
        return parsed;
      };

      if (trimmed.startsWith('# ')) {
        return <h1 key={idx}>{parseInline(trimmed.substring(2))}</h1>;
      } else if (trimmed.startsWith('## ')) {
        const title = trimmed.substring(3);
        const slg = slugify(title.replace(/\*\*/g, '').replace(/\`/g, ''));
        return <h2 key={idx} id={slg}>{parseInline(title)}</h2>;
      } else if (trimmed.startsWith('### ')) {
        const title = trimmed.substring(4);
        const slg = slugify(title.replace(/\*\*/g, '').replace(/\`/g, ''));
        return <h3 key={idx} id={slg}>{parseInline(title)}</h3>;
      } else if (trimmed.startsWith('- ')) {
        return <ul key={idx}><li dangerouslySetInnerHTML={{ __html: parseInline(trimmed.substring(2)) }} /></ul>;
      } else if (trimmed.startsWith('> ')) {
        return <blockquote key={idx} dangerouslySetInnerHTML={{ __html: parseInline(trimmed.substring(2)) }} />;
      } else if (trimmed.length === 0) {
        return <br key={idx} />;
      } else {
        return <p key={idx} dangerouslySetInnerHTML={{ __html: parseInline(trimmed) }} />;
      }
    });
  };

  const handleNavClick = (slug: string) => {
    setActiveSlug(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTocClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      // Ajusta o offset considerando o header fixo
      const y = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className={styles.docsLayout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoContainer} onClick={() => handleNavClick('introducao')} style={{ cursor: 'pointer' }}>
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
          {activeDoc && (
            <div className={styles.docInnerLayout}>
              <article className={`${styles.article} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                {renderMarkdownText(activeDoc.content)}
              </article>

              {toc.length > 0 && (
                <aside className={styles.tocSidebar}>
                  <div className={styles.tocFixed}>
                    <h4 className={styles.tocTitle}>
                      <List size={14} className="mr-2" />
                      Links Rápidos
                    </h4>
                    <ul className={styles.tocList}>
                      {toc.map((heading) => (
                        <li 
                          key={heading.id} 
                          style={{
                             paddingLeft: heading.level === 3 ? '16px' : '0'
                          }}
                        >
                          <a 
                            href={`#${heading.id}`}
                            onClick={(e) => handleTocClick(heading.id, e)}
                            className={styles.tocLink}
                          >
                            {heading.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </aside>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
