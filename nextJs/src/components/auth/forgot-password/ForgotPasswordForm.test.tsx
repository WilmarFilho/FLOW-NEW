import { render, screen, fireEvent } from '@testing-library/react';
import ForgotPasswordForm from './ForgotPasswordForm';

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

describe('ForgotPasswordForm', () => {
  it('deve renderizar o input de email', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByPlaceholderText('E-mail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar link/i })).toBeInTheDocument();
  });

  it('deve mostrar erro se o email não for preenchido', () => {
    render(<ForgotPasswordForm />);
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }));
    expect(screen.getByText('Por favor, informe o seu e-mail.')).toBeInTheDocument();
  });

  it('deve alternar para o login', () => {
    const mockOnSwitchView = jest.fn();
    render(<ForgotPasswordForm onSwitchView={mockOnSwitchView} />);

    fireEvent.click(screen.getByText(/Lembrou da senha\?/i));
    expect(mockOnSwitchView).toHaveBeenCalled();
  });
});
