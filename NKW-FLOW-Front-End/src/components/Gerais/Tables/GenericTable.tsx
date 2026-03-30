// Libs
import React from 'react';
import { motion } from 'framer-motion';
// CSS Modules
import styles from './GenericTable.module.css';
// Icons
import Icon from '../Icons/Icons';

interface GenericTableProps<T> {
  columns: string[];
  data?: T[] | null;
  renderRow: (item: T, index: number) => React.ReactNode;
  gridTemplateColumns: string;
  onSortClick?: (col: string) => void;
  sortField?: string | null;
  sortOrder?: 'asc' | 'desc';
}

export default function GenericTable<T>({
  columns,
  data,
  renderRow,
  gridTemplateColumns,
  onSortClick,
  sortField,
  sortOrder
}: GenericTableProps<T>) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className={styles.tableContainer}
    >

      <header
        className={styles.tableHeader}
        style={{ gridTemplateColumns }}
      >
        {columns.map((col, i) => {
          const colKey = col.toLowerCase();
          const isActive = sortField === colKey;

          return (
            <div
              key={i}
              onClick={() => onSortClick?.(col)}
              className={styles.sortableHeader}
              style={{ cursor: (col === 'Nome' || col === 'Email') ? 'pointer' : 'default' }}
            >
              <span>{col}</span>

              {(col === 'Nome' || col === 'Email') && (
                <span className={styles.sortIcon}>
                  {isActive ? (
                    <>
                      <span className={styles.sortIcon}><Icon nome='filter' /></span>
                      {sortOrder === 'asc' ? <Icon nome='arrowup' /> : <Icon nome='arrowdown' />}
                    </>
                  ) : (
                    <span className={styles.sortIconInactive}><Icon nome='notfilter' /></span>
                  )}
                </span>
              )}

            </div>
          );
        })}
      </header>

      <div className={styles.tableBody}>
        {data ? data.map((item, index) => renderRow(item, index)) : null}
      </div>

    </motion.section>
  );
}


