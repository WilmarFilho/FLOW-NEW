// Css
import TableStyles from './TableStyles.module.css';
// Icons
import Icon from '../Icons/Icons';
// Libs
import React from 'react';

interface GenericEntityRowProps<T extends { id: string | number }> {
    item: T;
    columns: {
        key: string;
        label?: string;
        onClick?: (item: T) => void;
        render?: (item: T) => React.ReactNode;
    }[];
    columnTemplate: string;
    onEdit?: (item: T) => void;
    onDelete?: (id: string | number) => void | Promise<void>;
}

export default function GenericEntityRow<T extends { id: string | number }>({
    item,
    columns,
    onEdit,
    onDelete,
    columnTemplate,
}: GenericEntityRowProps<T>) {
    return (
        <div
            className={TableStyles.tableRow}
            style={{ gridTemplateColumns: columnTemplate }}
        >
            {columns.map((col, idx) => {
                // Caso seja a coluna de Status, renderizamos diferente
                if (col.label === 'Status') {
                    return (
                        <div
                            key={idx}
                            data-label={col.label}
                            onClick={() => col.onClick?.(item)}
                            className={TableStyles.statusWithActions}
                        >
                            {/* Chip normal (desktop only) */}
                            <div className={TableStyles.statusChipDesktop}>
                                {col.render?.(item)}
                            </div>

                            {/* Chip + botões (mobile only) */}
                            <div className={TableStyles.inlineActions}>
                                <div className={TableStyles.statusChipMobile}>
                                    {col.render?.(item)}
                                </div>
                        
                                {onEdit && (
                                    <button
                                        className={TableStyles.actionButtonEdit}
                                        onClick={() => onEdit(item)}
                                    >
                                        <Icon nome="configpage" />
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        className={TableStyles.actionButtonDelete}
                                        onClick={() => onDelete(item.id)}
                                    >
                                        <Icon nome="close" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                }

                return (
                    <div className={TableStyles.columnsTable} key={idx} data-label={col.label} onClick={() => col.onClick?.(item)}>
                        {col.render?.(item) ?? null}
                    </div>
                );
            })}

            {/* Celula de ações normal, mas só aparece em telas grandes */}
            <div className={TableStyles.actionCell}>
                {onEdit && (
                    <button
                        className={TableStyles.actionButtonEdit}
                        onClick={() => onEdit(item)}
                    >
                        <Icon nome='configpage' />
                    </button>
                )}
                {onDelete && (
                    <button
                        className={TableStyles.actionButtonDelete}
                        onClick={() => onDelete(item.id)}
                    >
                        <Icon nome='close' />
                    </button>
                )}
            </div>
        </div>
    );
}
