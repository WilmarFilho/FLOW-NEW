import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WhatsappPage from './WhatsappPage';

// Mock Supabase client
jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'test@test.com' },
        },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    }),
    removeChannel: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/lib/logger.api', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('WhatsappPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: return empty connections
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it('renders the page title', async () => {
    render(<WhatsappPage />);

    expect(screen.getByText('WhatsApps')).toBeInTheDocument();
  });

  it('renders the add connection button', async () => {
    render(<WhatsappPage />);

    expect(screen.getByText('Adicionar Conexão')).toBeInTheDocument();
  });

  it('renders filter chips', async () => {
    render(<WhatsappPage />);

    expect(screen.getByText('Todos')).toBeInTheDocument();
    expect(screen.getByText('Conectados')).toBeInTheDocument();
    expect(screen.getByText('Desconectados')).toBeInTheDocument();
  });

  it('shows empty state when no connections exist', async () => {
    render(<WhatsappPage />);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conexão ainda')).toBeInTheDocument();
    });
  });

  it('opens create modal when add button is clicked', async () => {
    render(<WhatsappPage />);

    fireEvent.click(screen.getByText('Adicionar Conexão'));

    expect(screen.getByText('Nova Conexão')).toBeInTheDocument();
    expect(screen.getByText('Conectar via QR Code')).toBeInTheDocument();
    expect(screen.getByText('Conectar via Código')).toBeInTheDocument();
  });

  it('renders connections when data is fetched', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: '1',
          nome: 'WhatsApp Vendas',
          numero: '5511999',
          status: 'connected',
          instance_name: 'inst_1',
          agente_id: null,
          conhecimento_id: null,
          agentes: null,
          conhecimentos: null,
        },
      ],
    });

    render(<WhatsappPage />);

    await waitFor(() => {
      expect(screen.getByText('WhatsApp Vendas')).toBeInTheDocument();
    });
  });
});
