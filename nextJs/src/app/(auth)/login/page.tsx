import AuthContainer from '@/components/auth/AuthContainer';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const initialView = (mode === 'register' || mode === 'forgot-password' || mode === 'reset-password') ? mode : 'login';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundImage: 'url(/assets/bgDark.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '2rem 1rem',
      }}
    >
      <AuthContainer initialView={initialView as any} />
    </div>
  );
}
