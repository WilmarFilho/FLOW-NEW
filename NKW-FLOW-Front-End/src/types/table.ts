export type FilterStatus = 'todos' | 'ativo' | 'inativo';
export type SortOrder = 'asc' | 'desc';

export type SortField<T> = keyof T | null;