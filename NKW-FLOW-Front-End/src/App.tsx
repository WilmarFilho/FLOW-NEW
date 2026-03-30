import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Layout from './components/Layout/Layout';
import LoadingScreen from './components/Layout/LoadingScreen';
import { ProtectedRouteByRole, PublicRoute } from './routes/ProtectedRoute';
import { ChakraProvider } from '@chakra-ui/react'
import { AuthInitializer } from './components/Login/AuthInitializer';

const ConversasPage = lazy(() => import('./pages/ConversasPage'));
const AtendentesPage = lazy(() => import('./pages/AtendentesPage'));
const AgentesPage = lazy(() => import('./pages/AgentesPage'));
const ConexoesPage = lazy(() => import('./pages/ConexoesPage'));
const ConfiguracoesPage = lazy(() => import('./pages/ConfiguracoesPage'));
const AjudaPage = lazy(() => import('./pages/AjudaPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ResumoPage = lazy(() => import('./pages/ResumoPage'));
const RecompensasPage = lazy(() => import('./pages/RecompensasPage'));

function App() {

  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AuthInitializer>
        <ChakraProvider>
          <Routes>

            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <LoginPage />
                  </Suspense>
                </PublicRoute>
              }
            />

            <Route
              path="/"
              element={
                <ProtectedRouteByRole allowedRoles={['admin', 'atendente']}>
                  <Layout />
                </ProtectedRouteByRole>
              }
            >

              {/* Rota padrão ao acessar "/" */}
              <Route
                index
                element={<Navigate to="conversas" replace />}
              />

              {/* ATENDENTES */}
              <Route
                path="conversas"
                element={
                  <ProtectedRouteByRole allowedRoles={['atendente', 'admin']}>
                    <Suspense fallback={<LoadingScreen />}><ConversasPage /></Suspense>
                  </ProtectedRouteByRole>
                }
              />
              <Route
                path="configuracoes"
                element={
                  <ProtectedRouteByRole allowedRoles={['atendente', 'admin']}>
                    <Suspense fallback={<LoadingScreen />}><ConfiguracoesPage /></Suspense>
                  </ProtectedRouteByRole>
                }
              />
              <Route
                path="ajuda"
                element={
                  <ProtectedRouteByRole allowedRoles={['atendente', 'admin']}>
                    <Suspense fallback={<LoadingScreen />}><AjudaPage /></Suspense>
                  </ProtectedRouteByRole>
                }
              />

              {/* ADMINS */}
              <Route
                path="dashboard"
                element={
                  <ProtectedRouteByRole allowedRoles={['admin']}>
                    <Suspense fallback={<LoadingScreen />}><ResumoPage /></Suspense>
                  </ProtectedRouteByRole>
                }
              />
              <Route
                path="atendentes"
                element={
                  <ProtectedRouteByRole allowedRoles={['admin']}>
                    <Suspense fallback={<LoadingScreen />}><AtendentesPage /></Suspense>
                  </ProtectedRouteByRole>
                }
              />
              <Route
                path="agentes"
                element={
                  <ProtectedRouteByRole allowedRoles={['admin']}>
                    <Suspense fallback={<LoadingScreen />}><AgentesPage /></Suspense>
                  </ProtectedRouteByRole>
                }
              />
              <Route
                path="conexoes"
                element={
                  <ProtectedRouteByRole allowedRoles={['admin']}>
                    <Suspense fallback={<LoadingScreen />}><ConexoesPage /></Suspense>
                  </ProtectedRouteByRole>
                }
              />
              <Route
                path="cashback"
                element={
                  <ProtectedRouteByRole allowedRoles={['admin']}>
                    <Suspense fallback={<LoadingScreen />}><RecompensasPage /></Suspense>
                  </ProtectedRouteByRole>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />

          </Routes>
        </ChakraProvider>

      </AuthInitializer>
    </BrowserRouter>
  );
}

export default App;


