// Libs
import { motion } from 'framer-motion';
// CSS Modules
import styles from './ChatListItem.module.css';
// Assets
import defaultAvatar from '../assets/default.webp';
import { useState } from 'react';
import React from 'react';
// Types
import { Chat } from '../../../types/chats';
// Utils
import { useFormatDate } from '../../../hooks/utils/useFormatDate';
import { Message } from '@/types/message';

interface ChatListItemProps {
  name: string;
  status: string;
  avatar: string | null;
  chatId: string;
  isActive: boolean;
  onClick: () => void;
  ultimaMensagem?: Partial<Message>;
  mensagemData: string;
  fetchImageProfile: (chatId: string) => Promise<Chat | null>;
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

function ChatListItem({
  name,
  avatar,
  isActive,
  onClick,
  chatId,
  fetchImageProfile,
  ultimaMensagem,
  status,
  mensagemData,
}: ChatListItemProps) {

  const [avatarUrl, setAvatarUrl] = useState(avatar || defaultAvatar);
  const [hasError, setHasError] = useState(false);

  const handleImageError = async () => {
    if (!hasError) {
      setHasError(true);

      const data = await fetchImageProfile(chatId);
      if (data?.foto_perfil) {
        setAvatarUrl(data.foto_perfil);
      } else {
        setAvatarUrl(defaultAvatar);
      }
    }
  };

  const nameInMessageRegex = /^\*.*?\*\s?/;

  let lastMessage = ultimaMensagem?.mensagem?.replace(nameInMessageRegex, '').trim();

  if(ultimaMensagem?.mimetype !== 'texto') {
    lastMessage = 'Arquivo de mídia 📎';
  }

  const containerClasses = `${styles.chatListItem} ${isActive ? styles.active : ''}`;

  return (
    <motion.button
      variants={itemVariants}
      className={containerClasses}
      onClick={onClick}
      type="button"
    >
      <img
        src={avatarUrl}
        onError={handleImageError}
        alt={`Avatar de ${name}`}
        className={styles.avatar}
        loading="lazy"
      />

      <div className={styles.textContainer}>
        {/* Linha superior: nome + data */}
        <div className={styles.columnLeft}>
          <strong>{name}</strong>
          <p className={styles.message}>{lastMessage}</p>

        </div>

        {/* Linha inferior: última mensagem + badge de não lido */}
        <div className={styles.columnRight}>
          {mensagemData && (
            <span
              className={
                ultimaMensagem?.remetente === 'Contato' && status === 'Open'
                  ? styles.headerActiveCount
                  : styles.headerCount
              }
            >
              {useFormatDate(mensagemData)}
            </span>
          )}
          {ultimaMensagem?.remetente === 'Contato' && status === 'Open' && (
            <span className={styles.countUnread}>*</span>
          )}
        </div>

      </div>
    </motion.button>
  );
}

export default React.memo(ChatListItem);