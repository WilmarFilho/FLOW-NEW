import { atom } from 'recoil';

import type { Connection } from '../types/connection';
import type { Attendant } from '../types/attendant';
import type { Agent } from '../types/agent';
import type { MessagesHelpChat } from '../types/helpChat';
import type { Chat, ChatFilters } from '../types/chats';
import type { Message } from '../types/message';
import type { User } from '../types/user';
import type { MetricsState } from '../types/metric';

import { localStorageEffect, readLocalStorage } from '../utils/storage';

const KEYS = {
  CONNECTIONS: 'connectionsState',
  ACTIVE_CHAT: 'activeChatState',
  METRICS: 'metricsState',
  CHATS: 'chatsState',
  MESSAGES: 'messagesState',
  ADD_CONN_MODAL: 'addConnectionModalState',
  ATTENDANTS: 'attendantsState',
  AGENTS: 'agentsState',
  HELP_CHAT: 'helpChat',
  USER: 'userState',
  AUTH_TOKEN: 'authTokenState',
  NEXT_CURSOR: 'nextCursorState',
  CHAT_FILTERS: 'chatFiltersState',
};

export const connectionsState = atom<Connection[] | null>({
  key: KEYS.CONNECTIONS,
  default: null,
});

export const activeChatState = atom<Chat | null>({
  key: KEYS.ACTIVE_CHAT,
  default: null,
});

export const metricsState = atom<MetricsState | null>({
  key: KEYS.METRICS,
  default: null,
});

export const chatsState = atom<Chat[] | null>({
  key: KEYS.CHATS,
  default: null,
});

export const messagesState = atom<Record<string, Message[]> | null>({
  key: KEYS.MESSAGES,
  default: null,
});

export const addConnectionModalState = atom<{
  isOpen: boolean;
  editMode?: boolean;
  step: 1 | 2 | 3;
  qrCode: string | null;
  pairingCode?: string | null;
  isLoading: boolean;
}>({
  key: KEYS.ADD_CONN_MODAL,
  default: {
    isOpen: false,
    editMode: false,
    step: 1,
    qrCode: null,
    pairingCode: null,
    isLoading: false,
  },
});

export const attendantsState = atom<Attendant[] | null>({
  key: KEYS.ATTENDANTS,
  default: null,
});

export const agentsState = atom<Agent[] | null>({
  key: KEYS.AGENTS,
  default: null,
});

export const helpChatState = atom<MessagesHelpChat[] | null>({
  key: KEYS.HELP_CHAT,
  default: null,
});

export const userState = atom<User | null>({
  key: KEYS.USER,
  default: null,
});

export const authTokenState = atom<{ token: string; userId: string } | null>({
  key: KEYS.AUTH_TOKEN,
  default: readLocalStorage<{ token: string; userId: string }>(KEYS.AUTH_TOKEN),
  effects_UNSTABLE: [localStorageEffect<{ token: string; userId: string } | null>(KEYS.AUTH_TOKEN)],
});

export const nextCursorState = atom<string | null>({
  key: KEYS.NEXT_CURSOR,
  default: null,
});

export const chatFiltersState = atom<ChatFilters>({
  key: KEYS.CHAT_FILTERS,
  default: {
    search: null,
    connection_id: null,
    attendant_id: null,
    iaStatus: 'todos',
    status: 'Open',
    owner: 'all',
    isFetching: false,
  },
});

export const ragStatusState = atom<{ status_conhecimento: string; resumo: string } | null>({
  key: 'ragStatusState',
  default: null,
});



