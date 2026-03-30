import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConnectionCard from './ConnectionCard';
import type { WhatsappConnection } from './ConnectionCard';

describe('ConnectionCard', () => {
  const mockConnection: WhatsappConnection = {
    id: 'uuid-1',
    nome: 'WhatsApp Vendas',
    numero: '5511999999999',
    status: 'connected',
    instance_name: 'flow_abc_123',
    agente_id: 'agent-1',
    conhecimento_id: 'conhec-1',
    agentes: { id: 'agent-1', nome: 'Sales Bot', tipo_de_agente: 'atendente' },
    conhecimentos: { id: 'conhec-1', titulo: 'Manual de Vendas' },
  };

  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnTest = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders connection name and number', () => {
    render(
      <ConnectionCard
        connection={mockConnection}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onTest={mockOnTest}
      />
    );

    expect(screen.getByText('WhatsApp Vendas')).toBeInTheDocument();
    expect(screen.getByText('5511999999999')).toBeInTheDocument();
  });

  it('renders connected status badge', () => {
    render(
      <ConnectionCard
        connection={mockConnection}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onTest={mockOnTest}
      />
    );

    expect(screen.getByText('Conectado')).toBeInTheDocument();
  });

  it('renders disconnected status badge', () => {
    const disconnected: WhatsappConnection = { ...mockConnection, status: 'disconnected' };
    render(
      <ConnectionCard
        connection={disconnected}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onTest={mockOnTest}
      />
    );

    expect(screen.getByText('Desconectado')).toBeInTheDocument();
  });

  it('renders agent and knowledge info', () => {
    render(
      <ConnectionCard
        connection={mockConnection}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onTest={mockOnTest}
      />
    );

    expect(screen.getByText('atendente')).toBeInTheDocument();
    expect(screen.getByText('Manual de Vendas')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    render(
      <ConnectionCard
        connection={mockConnection}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onTest={mockOnTest}
      />
    );

    fireEvent.click(screen.getByText('Editar'));
    expect(mockOnEdit).toHaveBeenCalledWith(mockConnection);
  });

  it('calls onTest when test button is clicked', () => {
    render(
      <ConnectionCard
        connection={mockConnection}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onTest={mockOnTest}
      />
    );

    fireEvent.click(screen.getByText('Testar'));
    expect(mockOnTest).toHaveBeenCalledWith(mockConnection);
  });

  it('disables test button when not connected', () => {
    const disconnected: WhatsappConnection = { ...mockConnection, status: 'disconnected' };
    render(
      <ConnectionCard
        connection={disconnected}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onTest={mockOnTest}
      />
    );

    const testBtn = screen.getByText('Testar').closest('button');
    expect(testBtn).toBeDisabled();
  });
});
