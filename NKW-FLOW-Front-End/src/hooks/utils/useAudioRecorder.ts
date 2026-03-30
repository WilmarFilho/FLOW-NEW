import { useState, useRef, useCallback } from 'react';

type AudioRecorderHook = {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  sendRecording: () => void;
  cancelRecording: () => void;
  initVisualizer: (canvas: HTMLCanvasElement) => void;
};

export const useAudioRecorder = (
  onRecordingComplete: (base64: string, mimetype: string) => void
): AudioRecorderHook => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const source = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Função centralizada para limpar todos os recursos
  const cleanup = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    if (mediaRecorder.current?.stream) {
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
    source.current?.disconnect();
    audioContext.current?.close().catch(() => {}); // Adiciona catch para evitar erro em alguns navegadores
    setIsRecording(false);
  };

  const startRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      alert('A permissão para acessar o microfone foi negada ou não está disponível.');
      return;
    }

    setIsRecording(true);

    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorder.current = recorder;
    recorder.start();

    // Configuração do analisador de áudio
    const context = new AudioContext();
    audioContext.current = context;
    analyser.current = context.createAnalyser();
    source.current = context.createMediaStreamSource(stream);
    source.current.connect(analyser.current);

    audioChunks.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.current.push(event.data);
      }
    };
  };

  // Função que para a gravação e envia os dados
  const sendRecording = () => {
    if (!mediaRecorder.current || mediaRecorder.current.state === 'inactive') return;

    mediaRecorder.current.onstop = () => {
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        if (base64String) {
          onRecordingComplete(base64String, 'audio/webm');
        }
      };
      cleanup();
    };

    mediaRecorder.current.stop();
  };

  // Função que para a gravação e descarta os dados
  const cancelRecording = () => {
    if (!mediaRecorder.current || mediaRecorder.current.state === 'inactive') return;

    // Remove o evento onstop para garantir que o áudio não seja processado
    mediaRecorder.current.onstop = null;
    mediaRecorder.current.stop();
    cleanup();
  };

  const initVisualizer = useCallback((canvas: HTMLCanvasElement) => {
    if (!analyser.current) return;
    
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    analyser.current.fftSize = 256;
    const bufferLength = analyser.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyser.current || !isRecording) {
        cancelAnimationFrame(animationFrameId.current!);
        return;
      };

      animationFrameId.current = requestAnimationFrame(draw);
      analyser.current.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = Math.pow(dataArray[i] / 255, 2.5) * canvas.height;
        canvasCtx.fillStyle = '#52f2b73a'; 
        canvasCtx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight);
        x += barWidth + 2;
      }
    };

    draw();
  }, [isRecording]); 

  return { isRecording, startRecording, sendRecording, cancelRecording, initVisualizer };
};