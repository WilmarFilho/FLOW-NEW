import { render, screen, fireEvent } from '@testing-library/react';
import ForgotPasswordForm from './ForgotPasswordForm';
import { apiRequest } from '@/lib/api/client';
import { supabase } from '@/lib/supabaseClient';

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

jest.mock('@/lib/api/client', () => ({
  apiRequest: jest.fn(),
}));

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('deve impedir recuperação para atendente', async () => {
    (apiRequest as jest.Mock).mockResolvedValue({ allowed: false });

    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByPlaceholderText('E-mail'), {
      target: { value: 'atendente@teste.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }));

    expect(
      await screen.findByText(
        'Apenas o administrador pode alterar ou recuperar a senha de um atendente.',
      ),
    ).toBeInTheDocument();
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('deve enviar email de recuperação para admin', async () => {
    (apiRequest as jest.Mock).mockResolvedValue({ allowed: true });
    (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
      error: null,
    });

    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByPlaceholderText('E-mail'), {
      target: { value: 'admin@teste.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }));

    expect(await screen.findByText(/e-mail de recuperação enviado com sucesso/i)).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/profile/password-reset-eligibility', {
      method: 'POST',
      body: { email: 'admin@teste.com' },
    });
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });
});
