import { render, screen, fireEvent } from '@testing-library/react';
import RegisterForm from './RegisterForm';

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
    },
  },
}));

describe('RegisterForm', () => {
  it('deve renderizar o step 1 inicialmente', () => {
    render(<RegisterForm />);
    
    expect(screen.getByPlaceholderText('E-mail')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Senha')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirmar Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
  });

  it('deve mostrar erro se as senhas não coincidirem no step 1', () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'teste@teste.com' } });
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('Confirmar Senha'), { target: { value: '1234567' } });
    
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument();
  });

  it('deve avançar para step 2, voltar e mostrar dados corretamente', () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'teste@teste.com' } });
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('Confirmar Senha'), { target: { value: '123456' } });
    
    // go to step 2
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    expect(screen.queryByPlaceholderText('E-mail')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nome Completo *')).toBeInTheDocument();
    
    // click back
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(screen.getByPlaceholderText('E-mail')).toBeInTheDocument();
  });

  it('deve alternar de volta para o login ao clicar no link correspondente', () => {
    const mockOnSwitchView = jest.fn();
    render(<RegisterForm onSwitchView={mockOnSwitchView} />);

    const loginLink = screen.getByText(/Fazer Login/i);
    fireEvent.click(loginLink);

    expect(mockOnSwitchView).toHaveBeenCalled();
  });
});
