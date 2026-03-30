import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../hooks/auth/useUser';
import LoadingScreen from '../Layout/LoadingScreen';
import { useRecoilState } from 'recoil';
import { authTokenState } from '../../state/atom';

interface AuthInitializerProps {
  children: React.ReactNode;
}
export const AuthInitializer = ({ children }: AuthInitializerProps) => {

  const { fetchUser } = useUser();
  const [token, setToken] = useRecoilState(authTokenState);


  const [isInitializing, setIsInitializing] = useState(true);
  const [progressMessage, setProgressMessage] = useState('Iniciando...');

  // evita reentradas/loops
  const initRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    if (!token) {
      initRef.current = false;
      if (mounted) setIsInitializing(false);
      return;
    }

    if (initRef.current) return;
    initRef.current = true;
    setIsInitializing(true);

    (async () => {
      try {
        await fetchUser({
          force: true,
          onProgress: (msg) => {
            if (mounted) setProgressMessage(msg);
          },
        });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        localStorage.removeItem('authTokenState');
        setToken(null);
      } finally {
        if (mounted) setIsInitializing(false);
      }
    })();

    return () => {
      mounted = false;
    };

  }, [token]);

  if (isInitializing) {
    return <LoadingScreen message={progressMessage} />;
  }

  return <>{children}</>;
};
export default AuthInitializer;



