import { render, screen } from '@testing-library/react';
import React from 'react';
import AuthContainer from './AuthContainer';

// Mock the child components to simplify container testing
jest.mock('./login/LoginForm', () => (props: any) => <div data-testid="login-view" onClick={() => props.onSwitchView('register')} />);
jest.mock('./register/RegisterForm', () => (props: any) => <div data-testid="register-view" onClick={() => props.onSwitchView('login')} />);
jest.mock('./forgot-password/ForgotPasswordForm', () => (props: any) => <div data-testid="forgot-password-view" onClick={() => props.onSwitchView('login')} />);
jest.mock('./reset-password/ResetPasswordForm', () => (props: any) => <div data-testid="reset-password-view" onClick={() => props.onSwitchView('login')} />);
jest.mock('./confirm-email/ConfirmEmailForm', () => (props: any) => <div data-testid="confirm-email-view" onClick={() => props.onSwitchView('login')} />);

describe('AuthContainer', () => {
  it('renderiza o form de Login como padrão', () => {
    render(<AuthContainer />);
    expect(screen.getByTestId('login-view')).toBeInTheDocument();
  });

  it('renderiza views diferentes de acordo com a propriedade initialView', () => {
    render(<AuthContainer initialView="register" />);
    expect(screen.getByTestId('register-view')).toBeInTheDocument();
  });
});
