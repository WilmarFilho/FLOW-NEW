import { useCallback, useMemo } from 'react';
import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { apiConfig } from '../../config/api';
import { useRecoilValue } from 'recoil';
import { authTokenState } from '../../state/atom';

export interface ApiError {
  message: string;
  status: number;
}

export const useApi = () => {
  const tokenState = useRecoilValue(authTokenState);

  const token = tokenState?.token;
  const authId = tokenState?.userId;

  const executeRequest = useCallback(async <T>(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    requestData?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> => {
    const url = `${apiConfig.node}${path}`;

    const headers = {
      ...(config?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(authId ? { 'x-auth-id': authId } : {})
    };

    const finalConfig = { ...config, headers };

    try {
      let response: AxiosResponse<T>;
      switch (method) {
        case 'get': response = await axios.get<T>(url, finalConfig); break;
        case 'post': response = await axios.post<T>(url, requestData, finalConfig); break;
        case 'put': response = await axios.put<T>(url, requestData, finalConfig); break;
        case 'patch': response = await axios.patch<T>(url, requestData, finalConfig); break;
        case 'delete': response = await axios.delete<T>(url, finalConfig); break;
        default: throw { message: 'Método HTTP não suportado', status: 500 } as ApiError;
      }
      return response.data;
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ message?: string }>;
      const message = axiosError.response?.data?.message || axiosError.response?.statusText || axiosError.message || 'Erro desconhecido';
      const status = axiosError.response?.status || 500;
      throw { message, status } as ApiError;
    }
  }, [token, authId]);

  const get = useCallback(<T>(path: string, config?: AxiosRequestConfig) =>
    executeRequest<T>('get', path, undefined, config), [executeRequest]);

  const post = useCallback(<T>(path: string, data?: unknown, config?: AxiosRequestConfig) =>
    executeRequest<T>('post', path, data, config), [executeRequest]);

  const put = useCallback(<T>(path: string, data?: unknown, config?: AxiosRequestConfig) =>
    executeRequest<T>('put', path, data, config), [executeRequest]);

  const patch = useCallback(<T>(path: string, data?: unknown, config?: AxiosRequestConfig) =>
    executeRequest<T>('patch', path, data, config), [executeRequest]);

  const del = useCallback(<T>(path: string, config?: AxiosRequestConfig) =>
    executeRequest<T>('delete', path, undefined, config), [executeRequest]);

  return useMemo(() => ({ get, post, put, patch, del }), [get, post, put, patch, del]);
};