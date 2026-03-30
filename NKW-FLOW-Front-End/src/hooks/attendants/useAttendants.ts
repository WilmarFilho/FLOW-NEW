import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { attendantsState, userState } from '../../state/atom';
import { useApi } from '../utils/useApi';
import type { Attendant } from '../../types/attendant';
import { User } from '../../types/user';

export const useAttendants = () => {
  const [user] = useRecoilState(userState);
  const [attendants, setAttendants] = useRecoilState(attendantsState);
  const { get } = useApi();

  const fetchAttendants = useCallback(async (userParam?: User) => {

    const currentUser = userParam ?? user;
    if (!currentUser) return;
    if (currentUser.tipo_de_usuario !== 'admin') return;

    const fetchedData = await get<Attendant[]>('/attendants');

    if (fetchedData) setAttendants(fetchedData);
  }, [get, setAttendants, user]);

  return { attendants, fetchAttendants };
};