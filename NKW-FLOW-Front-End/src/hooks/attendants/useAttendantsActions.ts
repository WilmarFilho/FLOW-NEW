import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { userState } from '../../state/atom';
import { useAttendants } from './useAttendants';
import { useApi } from '../utils/useApi';
import type { Attendant, AttendantFormData } from '../../types/attendant';
import type { User } from '../../types/user';
import { toast } from 'react-toastify';

interface NewAttendantData {
    nome: string;
    numero: string;
    email: string;
    password: string;
    connection_id?: string | null;
}

interface CreateUserResponse {
    message: string;
    authUser: {
        user: User;
    };
    userData: User;
}

export const useAttendantsActions = () => {
    const [user] = useRecoilState(userState);

    const { fetchAttendants } = useAttendants();
    const { post, del, put, patch } = useApi();

    // ✅ Criar atendente
    const addAttendant = async (attendantData: Partial<NewAttendantData>) => {
        try {
            if (user?.tipo_de_usuario !== 'admin') return;

            if (!attendantData.email || !attendantData.nome || !attendantData.numero || !attendantData.password) {
                throw new Error('Campos obrigatórios não fornecidos');
            }

            // 1️⃣ Criar usuário atendente
            const userResponse = await post<CreateUserResponse>('/createUser', {
                nome: attendantData.nome,
                numero: attendantData.numero,
                email: attendantData.email,
                password: attendantData.password,
                cidade: user.cidade,
                endereco: user.endereco,
                tipo_de_usuario: 'atendente'
            });

            if (!userResponse?.authUser) return;

            // 2️⃣ Vincular atendente ao admin logado
            await post('/attendants', {
                user_id: userResponse.authUser.user.id,
                connection_id: attendantData.connection_id
            });

            // 3️⃣ Atualizar lista de atendentes
            await fetchAttendants();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            let errorMessage =
                error?.response?.data?.message ||
                error?.message ||
                'Erro ao salvar as alterações. Tente novamente.';

            if(errorMessage === 'A user with this email address has already been registered') {
                errorMessage = 'Já existe um usuário admin ou atendente com este email'
            }

            toast.error(errorMessage);
            throw Error
        }
    };

    // ❌ Remover atendente
    const removeAttendant = async (id: string) => {
        try {
            if (user?.tipo_de_usuario !== 'admin') return;
            await del(`/attendants/${id}`);
            await fetchAttendants();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                'Erro ao remover atendente.'
            );
        }
    };

    // ✏️ Editar atendente
    const editAttendant = async (
        attendantId: string,
        updatedData: Partial<AttendantFormData>
    ) => {
        try {
            if (user?.tipo_de_usuario !== 'admin') return;

            await patch(`/attendants/${attendantId}`, {
                connection_id: updatedData.connection_id,
                nome: updatedData.nome,
                numero: updatedData.numero,
                email: updatedData.email,
                password: updatedData.password,
                status: updatedData.status
            });

            await fetchAttendants();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                'Erro ao editar atendente.'
            );
        }
    };

    // 🔄 Ativar/desativar atendente
    const updateAttendantStatus = useCallback(async (attendant: Attendant) => {
        try {
            if (!user || user.tipo_de_usuario !== 'admin') return;
            await put(`/users/${attendant.user.id}`, { status: !attendant.user.status });
            await fetchAttendants();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                'Erro ao atualizar status do atendente.'
            );
        }
    }, [put, fetchAttendants, user]);

    return { addAttendant, removeAttendant, editAttendant, updateAttendantStatus };
};
