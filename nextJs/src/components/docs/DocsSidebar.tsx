'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DOCS_DATA } from '@/lib/docsData';
import styles from './Docs.module.css';

export default function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      {DOCS_DATA.map((section, idx) => (
        <div key={idx} className={styles.sidebarSection}>
          <h4 className={styles.sidebarTitle}>{section.title}</h4>
          <ul className={styles.sidebarList}>
            {section.items.map((item) => {
              const href = `/docs/${item.slug}`;
              const isActive = pathname === href;
              return (
                <li key={item.slug}>
                  <Link
                    href={href}
                    className={`${styles.sidebarLink} ${isActive ? styles.sidebarLinkActive : ''}`}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
