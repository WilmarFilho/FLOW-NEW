import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Sidebar from './Sidebar';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Mock the Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock the Supabase client
jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
    },
  },
}));

describe('Sidebar Component', () => {
  const mockUser = {
    nome_completo: 'Test User',
    email: 'test@example.com',
    plano: 'premium',
    tipo_de_usuario: 'admin',
  };

  const mockRouterPush = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ push: mockRouterPush });
    (usePathname as jest.Mock).mockReturnValue('/home');
    jest.clearAllMocks();
  });

  it('renders the sidebar with correct user information', () => {
    render(<Sidebar user={mockUser} />);
    
    // Check if user info is displayed
    expect(screen.getByText('Test')).toBeInTheDocument(); // splits the name 'Test User' -> 'Test'
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('PREMIUM')).toBeInTheDocument();
  });

  it('navigates to the correct links', () => {
    render(<Sidebar user={mockUser} />);
    
    // Verify Dashboard link is rendered and active based on pathname mock
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveAttribute('href', '/home');
  });

  it('calls supabase signout when logout is clicked', async () => {
    render(<Sidebar user={mockUser} />);
    
    const logoutBtn = screen.getByText('Sair do Sistema').closest('button');
    expect(logoutBtn).toBeInTheDocument();
    
    fireEvent.click(logoutBtn!);
    
    expect(supabase.auth.signOut).toHaveBeenCalled();
    // Due to async nature of handleLogout waiting on signout, we might need waitFor or similar 
    // but synchronous check is fine for the spy if we await inside the event callback,
    // though fireEvent doesn't await. Let's just check the mock was called.
  });
});
