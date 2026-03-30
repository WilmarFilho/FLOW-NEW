// Recoil
import { useRecoilState, useSetRecoilState } from 'recoil';
import { userState, authTokenState } from '../../state/atom';
// Hooks
import { useApi } from '../utils/useApi';
// Types
import type { User } from '../../types/user';
import type { Upload } from '../../types/upload';

export function useUserAction() {

    // Carrega estados
    const [user, setUser] = useRecoilState(userState);
    const setToken = useSetRecoilState(authTokenState);

    // Hooks de API
    const { post, put } = useApi();

    const updateUser = async (updates: Partial<User>): Promise<User | null> => {
        if (!user) return null;

        // Chamada para atualizar usuário
        const response = await put<{
            id: string;
            nome: string;
            email: string;
            // ...outros campos do usuário...
            plano?: string;
            subscription_status?: string;
            token?: string;
        }>(`/users/${user.id}`, updates);

        if (!response) return null;

        // Se a API retornou um token novo, salva
        if (response.token) {
            setToken({ token: response.token, userId: response.id });
            localStorage.setItem('authTokenState', JSON.stringify({ token: response.token, userId: response.id }));
        }

        // Faz merge do user antigo com o novo, preservando campos não enviados
        const updatedUser: User = {
            ...user,
            ...updates,
            ...response, // sobrescreve com dados vindos do backend (inclui plano, subscription_status, etc)
        };

        setUser(updatedUser);

        return updatedUser;
    };

    const uploadProfileImage = async (file: File): Promise<string | null> => {
        if (!user) return null;

        const formData = new FormData();
        formData.append('arquivo', file);

        const result = await post<Upload>(`/upload/user/${user.id}`, formData);
        if (!result) return null;

        return result.url;
    };

    return { updateUser, uploadProfileImage };
}