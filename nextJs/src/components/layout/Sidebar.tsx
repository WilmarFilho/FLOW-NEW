'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, Users, MessageSquare, Settings, HelpCircle, ChevronLeft, ChevronRight, LogOut, Award, Menu, MessageCircle, BookOpen, UserCircle, Calendar, BookOpenText } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import styles from './Sidebar.module.css';

interface SidebarProps {
  user: {
    nome_completo: string;
    email?: string;
    foto_perfil?: string;
    plano: string;
    tipo_de_usuario: string;
  };
}

export default function Sidebar({ user }: SidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 500) {
        setIsMobile(true);
        // Em mobile a sidebar sai da tela e abre só via hamburger
      } else {
        setIsMobile(false);
        setMobileMenuOpen(false);
        if (width < 1000) {
          setExpanded(false); // Obriga a minimizar <= 1000px
        } else {
          setExpanded(true);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const menuItems = [
    { label: 'Dashboard', icon: Home, href: '/home', section: 'principal' },
    { label: 'Conversas', icon: MessageSquare, href: '/conversas', section: 'principal' },
    { label: 'WhatsApps', icon: MessageCircle, href: '/whatsapp', section: 'principal' },
    { label: 'Contatos', icon: UserCircle, href: '/contatos', section: 'principal' },
    { label: 'Conhecimentos', icon: BookOpenText, href: '/conhecimentos', section: 'principal' },
    { label: 'Agendamentos', icon: Calendar, href: '/agendamentos', section: 'principal' },
    { label: 'Atendentes', icon: Users, href: '/atendentes', section: 'principal' },
  ];

  const suporteItems = [
    { label: 'Configurações', icon: Settings, href: '/configuracoes', section: 'suporte' },
    { label: 'Ajuda', icon: HelpCircle, href: '/ajuda', section: 'suporte' },
  ];

  const sidebarVisible = isMobile ? mobileMenuOpen : true;
  const isVisuallyExpanded = isMobile ? true : expanded;

  return (
    <>
      {isMobile && (
        <div className={styles.mobileTopBar}>
          <button onClick={() => setMobileMenuOpen(true)} className={styles.hamburgerBtn}>
            <Menu size={24} color="#fff" />
          </button>
        </div>
      )}

      {isMobile && mobileMenuOpen && (
        <div className={styles.mobileBackdrop} onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside className={`
        ${styles.sidebar}
        ${!isMobile && expanded ? styles.expanded : ''}
        ${!isMobile && !expanded ? styles.collapsed : ''}
        ${isMobile ? styles.mobileSidebar : ''}
        ${isMobile && mobileMenuOpen ? styles.mobileSidebarOpen : ''}
      `}>
        <div className={styles.topSection}>
          {isVisuallyExpanded && (
            <div className={styles.logoRow}>
              <img src="/assets/logo.svg" alt="FLOW Logo" className={styles.fullLogo} />
            </div>
          )}

          <nav className={styles.navGroup}>
            {isVisuallyExpanded && <h4>Menu Principal</h4>}
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`${styles.navItem} ${isActive ? styles.active : ''}`} onClick={() => isMobile && setMobileMenuOpen(false)}>
                  <Icon size={isVisuallyExpanded ? 22 : 24} />
                  {isVisuallyExpanded && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <nav className={styles.navGroup} style={{ marginTop: '20px' }}>
            {isVisuallyExpanded && <h4>Sistema</h4>}
            {suporteItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`${styles.navItem} ${isActive ? styles.active : ''}`} onClick={() => isMobile && setMobileMenuOpen(false)}>
                  <Icon size={isVisuallyExpanded ? 22 : 24} />
                  {isVisuallyExpanded && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={styles.bottomSection}>
          <div className={styles.bottomActions}>
            {!isMobile && (
              <button onClick={() => setExpanded(!expanded)} className={styles.actionItem} title="Esconder Menu">
                {expanded ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
                {expanded && <span className={styles.fadeText}>Minimizar</span>}
              </button>
            )}

            <button onClick={handleLogout} className={`${styles.actionItem} ${styles.danger}`} title="Sair">
              <LogOut size={isVisuallyExpanded ? 22 : 24} />
              {isVisuallyExpanded && <span className={styles.fadeText}>Sair do Sistema</span>}
            </button>
          </div>

          {isVisuallyExpanded ? (
            <div className={styles.userInfo}>
              <div className={styles.avatar}>
                {user.foto_perfil ? (
                  <img src={user.foto_perfil} alt="Avatar" />
                ) : (
                  <div className={styles.avatarFallback}>{user.nome_completo.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div className={styles.userDetails}>
                <span className={styles.userName}>{user.nome_completo.split(' ')[0]}</span>
                {user.email && <span className={styles.userEmail}>{user.email}</span>}
                <div className={styles.planBadge}>
                  <Award size={12} style={{ marginRight: 4 }} />
                  {user.plano.toUpperCase()}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.collapsedUser}>
              {user.foto_perfil ? (
                <img src={user.foto_perfil} alt="Avatar" className={styles.miniAvatar} />
              ) : (
                <div className={styles.miniAvatarFallback}>{user.nome_completo.charAt(0).toUpperCase()}</div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
