import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/auth/useAuth';
import { JSX } from 'react';
import { useRecoilValue } from 'recoil';
import { userState } from '../state/atom';
import LoadingScreen from '../components/Layout/LoadingScreen';

interface RoleProps {
  children: JSX.Element;
  allowedRoles: Array<'admin' | 'atendente'>;
}

export const ProtectedRouteByRole = ({ children, allowedRoles }: RoleProps) => {
  const { isAuthenticated } = useAuth();
  const user = useRecoilValue(userState);
  const plano = (user?.plano || '').toLowerCase();
  const location = useLocation();

  // Caso tenha token mas o usuário ainda não foi carregado → espera
  if (isAuthenticated && !user) {
    return <LoadingScreen />;
  }

  // Sem token ou sem user depois do carregamento → manda pro login
  if (!isAuthenticated || !user) {
    return <Navigate to='/login' replace />;
  }

  // Se user existe mas o tipo não é permitido → redireciona
  if (!allowedRoles.includes(user.tipo_de_usuario)) {
    return <Navigate to='/conversas' replace />;
  }

  if (location.pathname.startsWith('/agentes') && plano === 'basico') {
    return <Navigate to='/conversas' replace />;
  }

  // Tudo certo → renderiza a rota
  return children;
};

export const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to='/conversas' replace />;
  }

  return children;
};