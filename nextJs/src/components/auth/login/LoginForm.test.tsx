import { render, screen, fireEvent } from '@testing-library/react';
import LoginForm from './LoginForm';

// Mock do supabase client
jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
    },
  },
}));

describe('LoginForm', () => {
  it('deve renderizar os campos de email e senha', () => {
    render(<LoginForm />);
    
    expect(screen.getByPlaceholderText('E-mail')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
  });

  it('deve mostrar erro se formulário for submetido vazio', () => {
    render(<LoginForm />);
    
    const entrarButton = screen.getByRole('button', { name: 'Entrar' });
    fireEvent.click(entrarButton);

    expect(screen.getByText('Por favor, preencha todos os campos.')).toBeInTheDocument();
  });

  it('deve alternar a tela quando clicar em Criar conta', () => {
    const mockOnSwitchView = jest.fn();
    render(<LoginForm onSwitchView={mockOnSwitchView} />);

    // Procurar por "Criar conta" dentro do link
    const criarContaLink = screen.getByText(/Criar conta/i);
    fireEvent.click(criarContaLink);

    expect(mockOnSwitchView).toHaveBeenCalled();
  });

  it('deve chamar onForgot quando clicar em "Esqueci minha senha"', () => {
    const mockOnForgot = jest.fn();
    render(<LoginForm onForgot={mockOnForgot} />);

    const forgotLink = screen.getByText('Esqueci minha senha');
    fireEvent.click(forgotLink);

    expect(mockOnForgot).toHaveBeenCalled();
  });
});
