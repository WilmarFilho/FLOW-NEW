import { useState, useRef, useEffect, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { useAudioRecorder } from '../../../hooks/utils/useAudioRecorder';
import styles from './ChatInput.module.css';
import Icon from '../Icons/Icons';

type ChatInputProps = {
  placeholder?: string;
  onSend: (message: string, mimetype?: string, base64?: string) => void;
};

const ChatInput = forwardRef<HTMLInputElement, ChatInputProps>(
  ({ placeholder = 'Digite sua mensagem...', onSend }, ref) => {
    const [input, setInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleRecordingComplete = (base64: string, mimetype: string) => {
      onSend('', mimetype, base64);
    };

    const { isRecording, startRecording, sendRecording, cancelRecording, initVisualizer } =
      useAudioRecorder(handleRecordingComplete);

    useEffect(() => {
      if (isRecording && canvasRef.current) {
        initVisualizer(canvasRef.current);
      }
    }, [isRecording, initVisualizer]);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (input.trim()) {
        onSend(input.trim());
        setInput('');
      }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const messageText = file.type.startsWith('image/') ? '' : file.name;
        onSend(messageText, file.type, base64);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };

    if (isRecording) {
      return (
        <div className={styles.recordingContainer}>
          <button type="button" className={`${styles.sendButton} ${styles.trashButton}`} onClick={cancelRecording}>
            <Icon nome="trash" />
          </button>
          <div className={styles.visualizerContainer}>
            <span className={styles.recordingLabel}>Gravando...</span>
            <canvas ref={canvasRef} className={styles.visualizer} height="40"></canvas>
          </div>
          <button type="button" className={`${styles.sendButton} ${styles.sendRecordingButton}`} onClick={sendRecording}>
            <Icon nome="send" />
          </button>
        </div>
      );
    }

    return (
      <motion.form className={styles.chatInputForm} onSubmit={handleSubmit}>
        <input
          type="text"
          className={styles.inputField}
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          ref={ref} // 🔑 ref externo aplicado aqui
        />

        <input
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.ppt,.pptx,audio/*"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleFileChange}
        />

        <button type="button" className={styles.sendButton} onClick={() => fileInputRef.current?.click()}>
          <Icon nome="upload" />
        </button>

        {input.trim() ? (
          <button type="submit" className={styles.sendButton}>
            <Icon nome="send" />
          </button>
        ) : (
          <button type="button" className={styles.sendButton} onClick={startRecording}>
            <Icon nome="mic" />
          </button>
        )}
      </motion.form>
    );
  }
);

export default ChatInput;