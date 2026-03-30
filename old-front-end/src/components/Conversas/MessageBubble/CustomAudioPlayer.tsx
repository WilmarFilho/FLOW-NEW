import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import styles from './MessageBubble.module.css';
import defaultAvatar from '../assets/default.webp';
import Icon from '../../../components/Gerais/Icons/Icons';

interface Props {
  sender: 'me' | 'other';
  src: string;
  avatarUrl: string | null;
  time?: string;
}

const waveOptions = {
  waveColor: '#7F8C9A',
  progressColor: '#4CAF50',
  cursorColor: 'transparent',
  barWidth: 3,
  barRadius: 3,
  barGap: 2,
  minWidth: 320,
  height: 40,
  normalize: true,
};

export function CustomAudioPlayer({ src, avatarUrl, time, sender }: Props) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const waveWrapperRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // SOLUÇÃO: Usar um ref para o estado de arrastar para não causar re-renderizações
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!waveformRef.current) return;

    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      ...waveOptions,
      url: src,
    });
    wavesurferRef.current = wavesurfer;

    wavesurfer.on('ready', () => setDuration(wavesurfer.getDuration()));
    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('finish', () => {
      setIsPlaying(false);
      wavesurfer.seekTo(0);
      setCurrentTime(0);
    });

    wavesurfer.on('audioprocess', (current) => {
      // Checa o ref em vez do estado
      if (!isDraggingRef.current) {
        setCurrentTime(current);
      }
    });

    wavesurfer.on('seeking', (time) => setCurrentTime(time));

    return () => {
      wavesurfer.destroy();
    };
    // SOLUÇÃO: Remover 'isDragging' do array de dependências
  }, [src]);

  const togglePlay = () => {
    wavesurferRef.current?.playPause();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveWrapperRef.current || !wavesurferRef.current) return;
    const wrapperRect = waveWrapperRef.current.getBoundingClientRect();
    const clickPositionX = e.clientX - wrapperRect.left;
    const percentage = Math.max(0, Math.min(1, clickPositionX / wrapperRect.width)); // Garante que a porcentagem esteja entre 0 e 1
    wavesurferRef.current.seekTo(percentage);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // SOLUÇÃO: Atualiza o valor do ref
    isDraggingRef.current = true;
    handleSeek(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // SOLUÇÃO: Checa o valor do ref
    if (isDraggingRef.current) {
      handleSeek(e);
    }
  };

  const handleMouseUpOrLeave = () => {
    // SOLUÇÃO: Atualiza o valor do ref
    isDraggingRef.current = false;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.audioContainer}>
      <button onClick={togglePlay} className={styles.audioButton}>
        {isPlaying ? <Icon nome="pause" /> : <Icon nome="playaudio" />}
      </button>

      <div
        className={styles.waveWrapper}
        ref={waveWrapperRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        <div
          ref={waveformRef}
          className={`${styles.audioWaveform} ${styles.audioWaveHeight}`}
        ></div>

        <div
          className={styles.customCursor}
          style={{ left: `${progress}%` }}
        ></div>

        <div className={styles.timeRow}>
          <span className={styles.messageTime}>{formatTime(currentTime)}</span>
          {time && <span className={styles.messageTime}>{time}</span>}
        </div>
      </div>
      {sender === 'other' && (
        <img
          src={avatarUrl || defaultAvatar}
          alt="Avatar"
          className={styles.audioAvatar}
        />
      )}
    </div>
  );
}