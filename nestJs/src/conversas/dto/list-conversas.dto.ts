export type ListConversasParams = {
  assignedUserId?: string;
  filter?: 'all' | 'mine' | 'unread' | 'ai' | 'deleted';
  limit?: number;
  offset?: number;
  search?: string;
  whatsappConnectionId?: string;
};

export type ListMensagensParams = {
  limit?: number;
  offset?: number;
};

export type PaginatedResult<T> = {
  hasMore: boolean;
  items: T[];
  nextOffset: number | null;
};
