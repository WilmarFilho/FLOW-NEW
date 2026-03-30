import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { ToastContainer } from 'react-toastify';
// Components
import SidebarWrapper from './Sidebars/SidebarWrapper';
// Hooks
import { useRealtimeEvents } from '../../hooks/utils/useRealtimeEvents';
// State
import { authTokenState, userState } from '../../state/atom';
// Estilos
import styles from './Layout.module.css';
import 'react-toastify/dist/ReactToastify.css';

export default function Layout() {
  const user = useRecoilValue(userState);
  const [token] = useRecoilState(authTokenState);

  // Estado para controlar popup de assinatura vencida
  const [showSubscriptionAlert, setShowSubscriptionAlert] = useState(true);

  if (token === null || user === null) {
    return <></>;
  }

  const modoTela = user.modo_tela || 'dark';
  const modoSideBar = user.modo_side_bar || 'Full';

  useRealtimeEvents(token.userId, token.token);

  const body = document.body;
  body.classList.remove('modo-light', 'modo-dark');
  if (user?.modo_tela === 'White') {
    body.classList.add('modo-light');
  } else {
    body.classList.add('modo-dark');
  }

  return (
    <div className={`${styles.layoutContainer} ${modoTela === 'White' ? styles.light : styles.dark}`}>
      <ToastContainer
        position="top-right"
        autoClose={2000}
        theme="light"
      />

      {/* Popup de assinatura vencida */}
      {user.subscription_status === 'past_due' && showSubscriptionAlert && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '2.5rem 2rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              maxWidth: 450,
              textAlign: 'center',
              textWrap: 'balance',
            }}
          >
            <h2 style={{ color: '#d32f2f', marginBottom: 16 }}>Assinatura em atraso</h2>
            <p style={{ color: '#222', marginBottom: 24 }}>
              Sua assinatura está em atraso. Entre em contato com o suporte ou regularize seu pagamento para evitar a exclusão da sua conta do sistema em 7 dias.
            </p>
            <button
              style={{
                background: '#d32f2f',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '0.7rem 1.5rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginRight: 12,
              }}
              onClick={() => setShowSubscriptionAlert(false)}
            >
              Fechar
            </button>
            <button className={styles.linkButtonGreen} onClick={() => window.open('https://billing.stripe.com/p/login/dRm00j8Eo4xGfAo6Lygbm00', '_blank')}>
              Gerenciar Assinatura
            </button>
          </div>
        </div>
      )}

      <SidebarWrapper />

      <main className={`${modoSideBar === 'Full' ? styles.contentAreaMinimal : styles.contentArea}`}>
        <Outlet />
      </main>
    </div>
  );
}