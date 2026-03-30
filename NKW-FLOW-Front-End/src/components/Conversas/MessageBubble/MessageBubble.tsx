import { useEffect, useRef, useState } from 'react';
import styles from './MessageBubble.module.css';
import Icon from '../../../components/Gerais/Icons/Icons';
import { DropdownMenu } from '../../../components/Gerais/Dropdown/DropdownMenu';
import { useDropdownMenu } from '../../../components/Gerais/Dropdown/DropdownMenuContext';
import { CustomAudioPlayer } from './CustomAudioPlayer';

interface MessageBubbleProps {
  id: string;
  text?: string | null;
  senderName: string;
  sender: 'me' | 'other';
  mimetype?: string;
  base64?: string;
  filename?: string;
  quote?: { mensagem?: string | null; mimetype?: string; remetente: 'Usuário' | 'Contato' | 'IA' };
  onReply?: () => void;
  createdAt: string;
  excluded: boolean;
  onDelete?: (id: string) => void;
  isMobileLayout?: boolean;
  avatarUrl: string | null;
}

export default function MessageBubble(props: MessageBubbleProps) {
  const {
    id, sender, mimetype, filename, onReply,
    quote, senderName, createdAt, excluded,
    avatarUrl, base64, text
  } = props;

  const parseToLocalDate = (utcTimestamp: string): Date => {
    if (utcTimestamp && !utcTimestamp.endsWith('Z')) {
      const isoString = utcTimestamp.replace(' ', 'T') + 'Z';
      return new Date(isoString);
    }
    return new Date(utcTimestamp);
  };

  const createdAtLocal = parseToLocalDate(createdAt);
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<'top' | 'bottom'>('bottom');
  const [expandedMedia, setExpandedMedia] = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<'image' | 'video' | null>(null);
  const [fileSizeText, setFileSizeText] = useState<string | null>(null);
  const [loadedImage, setLoadedImage] = useState(false);
  const [loadedVideo, setLoadedVideo] = useState(false);

  const bubbleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { openMenuId } = useDropdownMenu();
  const menuHeightRef = useRef<number>(0);

  // 🔍 MIME fallback
  const inferMime = (dataUrl: string, fallback: string): string => {
    const match = dataUrl.match(/^data:([^;]+);/);
    return match ? match[1] : fallback;
  };

  // 🧮 Tamanho do arquivo
  const calculateFileSize = (base64Data: string): string => {
    try {
      const sizeInBytes = (base64Data.length * 3) / 4;
      if (sizeInBytes < 1024) return `${sizeInBytes.toFixed(0)} B`;
      if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
      return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
    } catch {
      return '—';
    }
  };

  useEffect(() => {
    if (base64) setFileSizeText(calculateFileSize(base64));
  }, [base64]);

  // 🧭 Posição do menu
  const computePosition = () => {
    if (!bubbleRef.current) return;
    const bubbleRect = bubbleRef.current.getBoundingClientRect();
    const maybeEl = bubbleRef.current.closest('[data-scroll="messages"]');
    const scroller: HTMLElement | Window = maybeEl instanceof HTMLElement ? maybeEl : window;

    const scrollerRect =
      scroller instanceof Window
        ? ({ top: 0, bottom: window.innerHeight } as unknown as DOMRect)
        : (scroller as HTMLElement).getBoundingClientRect();

    if (menuRef.current && !menuHeightRef.current)
      menuHeightRef.current = menuRef.current.offsetHeight;

    const estimatedMenuHeight = menuHeightRef.current || 200;
    const spaceBelow = scrollerRect.bottom - bubbleRect.bottom;
    const spaceAbove = bubbleRect.top - scrollerRect.top;
    const shouldUseTop = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    setMenuPosition(shouldUseTop ? 'top' : 'bottom');
  };

  useEffect(() => {
    const isOpenHere = openMenuId === `message-${id}`;
    if (!isOpenHere) return;

    const tick = () => {
      computePosition();
      requestAnimationFrame(computePosition);
    };
    const t = setTimeout(tick, 0);

    const maybeEl = bubbleRef.current?.closest('[data-scroll="messages"]');
    const scroller: HTMLElement | Window = maybeEl instanceof HTMLElement ? maybeEl : window;

    const onScrollOrResize = () => requestAnimationFrame(computePosition);

    window.addEventListener('resize', onScrollOrResize);
    scroller.addEventListener('scroll', onScrollOrResize, { passive: true });

    const ro = new ResizeObserver(() => requestAnimationFrame(computePosition));
    if (menuRef.current) ro.observe(menuRef.current);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onScrollOrResize);
      scroller.removeEventListener('scroll', onScrollOrResize);
      ro.disconnect();
    };
  }, [openMenuId, id]);

  useEffect(() => {
    const isOpenHere = openMenuId === `message-${id}`;
    setShowMenu(isOpenHere);
    if (!isOpenHere) setIsHovered(false);
  }, [openMenuId, id]);

  const handleTriggerClick = () => setIsHovered(true);

  const bubbleClasses = [
    styles.messageBubble,
    sender === 'me' ? styles.isMe : styles.isOther,
    mimetype === 'sticker' ? styles.stickerBubble : '',
    excluded ? styles.isExcluded : '',
  ].join(' ');

  // 💬 Render principal
  const renderMessageContent = () => {
    const type = mimetype || 'text';

    if (type === 'image/webp' && base64) {
      return <img src={base64} alt="Sticker" className={styles.stickerImage} loading="lazy" />;
    }

    if (type.startsWith('image') && base64) {
      return (
        <div className={styles.imageWrapper}>
          {!loadedImage && <div className={styles.placeholder} />}
          <img
            src={base64}
            alt="Imagem enviada"
            className={`${styles.messageImage} ${loadedImage ? styles.visible : styles.hidden}`}
            loading="lazy"
            onLoad={() => setLoadedImage(true)}
            onClick={() => { setExpandedMedia(base64); setExpandedType('image'); }}
          />
          {text && <p>{text}</p>}
        </div>
      );
    }

    if (type.startsWith('video') && base64) {
      return (
        <div className={styles.imageWrapper}>
          {!loadedVideo && <div className={styles.placeholder} />}
          <video
            src={base64}
            className={styles.messageImage}
            preload="metadata"
            playsInline
            muted
            onLoadedData={() => setLoadedVideo(true)}
            onClick={() => { setExpandedMedia(base64); setExpandedType('video'); }}
          />
          {text && <p>{text}</p>}
        </div>
      );
    }

    if (type !== 'text' && base64) {
      const fileMime = inferMime(base64, type);
      const sizeLabel = fileSizeText ?? '—';
      return (
        <>
          <div className={styles.documentContainer}>
            <div className={styles.documentLeft}><Icon nome="document" /></div>
            <div className={styles.documentBody}>
              <div className={styles.documentName}>{filename}</div>
              <div className={styles.documentMeta}>{fileMime} • {sizeLabel}</div>
            </div>
            <div className={styles.documentRight}>
              <a href={base64} download={filename} aria-label={`Baixar ${filename}`}>
                <Icon nome="arrowdownload" />
              </a>
            </div>
          </div>
          {text && <p>{text}</p>}
        </>
      );
    }

    if (type !== 'texto' && !base64)
      return <div className={styles.documentContainer}>🚫 Tipo de mensagem não suportado.</div>;

    if (!text) return null;

    return (
      <p className={styles.messageText}>
        {text.split('\n').map((line, idx) => (
          <span key={idx}>{line.trim()}<br /></span>
        ))}
      </p>
    );
  };

  // 🖼 Lightbox (trava scroll e fecha com ESC)
  useEffect(() => {
    if (!expandedMedia) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpandedMedia(null);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [expandedMedia]);

  return (
    <>
      <div
        ref={bubbleRef}
        className={bubbleClasses}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => !showMenu && setIsHovered(false)}
      >
        {quote && (
          <div className={styles.quotedMessage}>
            <span className={styles.quotedSender}>{quote.remetente === 'Usuário' ? 'Você' : senderName}</span>
            <p className={styles.quotedText}>
              {quote.mensagem
                || (quote.mimetype?.startsWith('image/') ? '📷 Imagem'
                  : quote.mimetype?.startsWith('video/') ? '🎬 Vídeo'
                    : 'Mensagem')}
            </p>
          </div>
        )}

        {mimetype?.startsWith('audio') && base64 ? (
          <CustomAudioPlayer
            sender={sender}
            src={base64}
            avatarUrl={avatarUrl}
            time={createdAtLocal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}
          />
        ) : (
          renderMessageContent()
        )}

        {excluded && (
          <div className={styles.deletedOverlay}>
            <i>🚫 Mensagem apagada</i>
          </div>
        )}

        {!mimetype?.startsWith('audio') && (
          <span className={styles.time}>
            {createdAtLocal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        )}

        {!excluded && (isHovered || showMenu) && (
          <DropdownMenu
            menuRef={menuRef}
            id={`message-${id}`}
            variant="message"
            position={menuPosition}
            direction={sender === 'me' ? 'right' : 'left'}
            trigger={<button className={styles.actionButton} onClick={handleTriggerClick}><Icon nome="arrowdown" /></button>}
            className={`${styles.messageMenu} ${sender === 'me' ? styles.menuRight : styles.menuLeft}`}
          >
            <button onClick={() => onReply?.()}><Icon nome="arrow" /> {props.isMobileLayout ? 'Responder' : 'Responder Mensagem'}</button>
            {props.text && (
              <button onClick={() => navigator.clipboard.writeText(props.text || '')}>
                <Icon nome="copy" /> {props.isMobileLayout ? 'Copiar' : 'Copiar mensagem'}
              </button>
            )}
            {sender === 'me' && (Date.now() - createdAtLocal.getTime() <= 5 * 60 * 1000) && (
              <button onClick={() => props.onDelete?.(id)}>
                <Icon nome="trash" /> {props.isMobileLayout ? 'Apagar' : 'Apagar mensagem'}
              </button>
            )}
          </DropdownMenu>
        )}
      </div>

      {expandedMedia && (
        <div className={styles.mediaOverlay} onClick={() => setExpandedMedia(null)}>
          <button className={styles.closeButton} onClick={() => setExpandedMedia(null)}>
            <Icon nome="close" />
          </button>
          <div className={styles.mediaContainer} onClick={(e) => e.stopPropagation()}>
            {expandedType === 'image'
              ? <img src={expandedMedia} alt="Visualização" className={styles.mediaFull} />
              : <video src={expandedMedia} className={styles.mediaFull} controls autoPlay />}
          </div>
        </div>
      )}
    </>
  );
}
