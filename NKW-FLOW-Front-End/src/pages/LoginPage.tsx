import LoginForm from '../components/Login/LoginForm';
import bgImage from '../components/Layout/assets/bgDark.webp';

export default function LoginPage() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: `radial-gradient(300.92% 96.88% at 97.01% 12.45%, rgba(13, 13, 13, 0.8) 0%, rgba(14, 17, 38, 0.8) 100%), url(${bgImage}) lightgray 50% / cover no-repeat`,
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        fontFamily: 'var(--font-main)',
      }}
    >
      <LoginForm />
    </div>
  );
}