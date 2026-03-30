import { Chat } from '@/types/chats';
import { Message } from '../../types/message';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface UseInfiniteScrollProps {
  activeChat: Chat | null;
  fetchMoreMessages: () => void;
  hasMore: boolean;
  isLoading: boolean;
  messages: Message[];
  chatId?: string | null;
}

export function useInfiniteScroll({
  fetchMoreMessages,
  hasMore,
  isLoading,
  activeChat
}: UseInfiniteScrollProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);

  const [canFetch, setCanFetch] = useState(false); // só pode fetch depois do scroll inicial
  const lockRef = useRef(false); // lock para evitar múltiplos fetches

  // scroll inicial para o final do chat
  useLayoutEffect(() => {
    if (!activeChat || isLoading) return;
    
    const list = listRef.current;
    if (!list) return;

    const scrollToBottom = () => {
      setTimeout(() => {

        list.scrollTo({ top: list.scrollHeight, behavior: 'auto' });
        
        setTimeout(() => {
          setCanFetch(true); // habilita fetch após scroll inicial
        }, 100);

      }, 200);
    };

    // Pega todas as imagens e vídeos dentro do container
    const medias = list.querySelectorAll('img, video');

    if (medias.length === 0) {
      // Se não houver mídias, faz scroll imediatamente
      scrollToBottom();
      return;
    }

    let loadedCount = 0;

    const handleMediaLoad = () => {
      loadedCount += 1;
      if (loadedCount === medias.length) {
        // todas as mídias carregadas, espera um pouco para garantir layout
        setTimeout(() => {
          scrollToBottom();
        }, 150);
      }
    };

    medias.forEach((media) => {
      if (
        (media.tagName === 'IMG' && (media as HTMLImageElement).complete) ||
        (media.tagName === 'VIDEO' && (media as HTMLVideoElement).readyState >= 2)
      ) {
        handleMediaLoad();
      } else {
        media.addEventListener('load', handleMediaLoad);
        media.addEventListener('error', handleMediaLoad);
        if (media.tagName === 'VIDEO') {
          media.addEventListener('loadeddata', handleMediaLoad);
        }
      }
    });

    return () => {
      medias.forEach((media) => {
        media.removeEventListener('load', handleMediaLoad);
        media.removeEventListener('error', handleMediaLoad);
        if (media.tagName === 'VIDEO') {
          media.removeEventListener('loadeddata', handleMediaLoad);
        }
      });
    };
  }, [activeChat?.id, isLoading]);


  // Observer para scroll no topo
  useEffect(() => {
    const list = listRef.current;
    const sentinel = topSentinelRef.current;
  
    if (!list || !sentinel || !canFetch || isLoading) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            hasMore &&
            !isLoading &&
            !lockRef.current
          ) {
            lockRef.current = true; // bloqueia fetch até terminar
            await fetchMoreMessages();
            lockRef.current = false;
          }
        }
      },
      { root: list, rootMargin: '350px', threshold: 0.2 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, fetchMoreMessages, canFetch]);

  return { listRef, topSentinelRef };
}


