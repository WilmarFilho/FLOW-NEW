import { AnimatePresence, motion } from 'framer-motion';
import {
  useEffect,
  useRef,
  cloneElement,
  ReactElement,
  isValidElement,
  MouseEvent as ReactMouseEvent,
} from 'react';
import styles from './DropdownMenu.module.css';
import { useDropdownMenu } from './DropdownMenuContext';

interface DropdownMenuProps {
  id: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  isSmall?: string;
  position?: 'top' | 'bottom';
  direction?: 'left' | 'right';
  variant?: 'message' | 'header';
  // usamos um MutableRefObject porque é o que você passa de cima (useRef)
  menuRef?: React.MutableRefObject<HTMLDivElement | null>;
}

export function DropdownMenu({
  id,
  trigger,
  children,
  isSmall,
  className,
  position = 'bottom',
  direction = 'right',
  variant = 'header',
  menuRef,
}: DropdownMenuProps) {
  const { openMenuId, setOpenMenuId } = useDropdownMenu();
  const isOpen = openMenuId === id;

  const wrapperRef = useRef<HTMLSpanElement>(null);

  // Fecha com qualquer click fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setOpenMenuId]);

  // Envelopa itens para fechar o menu após clique
  const enhanceChild = (child: React.ReactNode, key?: number) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ onClick?: (e: ReactMouseEvent<HTMLElement>) => void }>;
    return cloneElement(el, {
      key,
      onClick: (e: ReactMouseEvent<HTMLElement>) => {
        el.props.onClick?.(e);
        setOpenMenuId(null);
      },
    });
  };

  const wrappedChildren = Array.isArray(children)
    ? children.map((child, i) => enhanceChild(child, i))
    : enhanceChild(children);

  return (
    <span
      ref={wrapperRef}
      className={`${styles.dropdownWrapper} ${
        variant === 'message' ? styles.messageWrapper : styles.headerWrapper
      }`}
    >
      <span
        className={`${variant === 'message' ? styles.actionButton : ''}`}
        onMouseDown={(e) => {
          // evita que o clique na trigger seja capturado pelo listener global
          e.stopPropagation();
          setOpenMenuId(isOpen ? null : id);
        }}
      >
        {trigger}
      </span>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: position === 'bottom' ? -5 : 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: position === 'bottom' ? -5 : 5 }}
            transition={{ duration: 0.1 }}
            className={`${styles.menu}
              ${position === 'top' ? styles.menuTop : styles.menuBottom}
              ${direction === 'left' ? styles.menuLeft : styles.menuRight}
              ${className || ''}
              ${isSmall ? styles.isSmall : ''}`}
          >
            {wrappedChildren}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}