import { useEffect, useState } from 'react';
import styles from './LoadingScreen.module.css'

interface LoadingScreenProps {
  message?: string;
  onFinish?: () => void;
}

export default function LoadingScreen({ message = 'Carregando...', onFinish }: LoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      if (onFinish) {
        setTimeout(onFinish, 500);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className={`${styles.loadingOverlay} ${fadeOut ? styles.fadeOut : ''}`}>
      <div className={styles.spinner}></div>
      <p className={styles.message}>{message}</p>
    </div>
  );
}