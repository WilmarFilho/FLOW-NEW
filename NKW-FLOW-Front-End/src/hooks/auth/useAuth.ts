import { useRecoilState } from 'recoil';
import { authTokenState, userState } from '../../state/atom';
import { useApi } from '../utils/useApi';
import { User } from '../../types/user';

export const useAuth = () => {
  const [token, setToken] = useRecoilState(authTokenState);
  const [user, setUser] = useRecoilState(userState);
  const api = useApi();

  const login = async (email: string, senha: string) => {
    try {

      const response = await api.post<{ message: string; token: string; user: User }>('/login', { email, senha });

      if (!response || !response.token) {
        throw { message: 'Erro ao realizar login. Tente novamente.', status: 500 };
      }

      setToken({ token: response.token, userId: response.user.id });
      setUser(response.user);

    } catch (err: unknown) {
      const apiError = err as { message: string; status?: number };

      if (apiError.status === 401) {
        throw { message: 'E-mail ou senha incorretos.', status: 401 };
      } else {
        throw { message: apiError.message || 'Erro ao fazer login. Tente novamente.', status: apiError.status || 500 };
      }
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authTokenState');
  };

  const isAuthenticated = !!token;

  return { token, isAuthenticated, login, logout, user };
};