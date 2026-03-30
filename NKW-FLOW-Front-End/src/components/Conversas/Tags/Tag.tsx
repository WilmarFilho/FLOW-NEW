// Libs
import React from 'react';
// Css
import styles from './Tag.module.css';

interface TagProps {
  label?: string | null;
  active?: boolean;
  onClick?: () => void;
}

function Tag({ label, active = false, onClick }: TagProps) {

  const tagClasses = `${styles.tag} ${active ? styles.active : ''}`;

  return (
    <button type="button" className={tagClasses} onClick={onClick}>
      {label}
    </button>
  );
}

export default React.memo(Tag);