import styles from './Sidebar.module.css';

export const metadata = {
  title: 'Home | FLOW',
};

export default function HomePage() {
  return (
    <div>
      <h1>Bem-vindo à Home</h1>
      <p style={{ color: '#aaa', marginTop: '10px' }}>Você está autenticado e o layout base com Sidebar está funcionando!</p>
    </div>
  );
}
