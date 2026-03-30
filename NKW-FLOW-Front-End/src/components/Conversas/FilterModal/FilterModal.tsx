import { useState } from 'react';
import Modal from '../../Gerais/Modal/Modal';
import SearchBar from '../SearchBar/Searchbar';
import GlobalStyles from '../../../global.module.css';

interface FilterModalProps<T> {
  isOpen: boolean;
  title: string;
  items: T[] | null;
  labelSelector: (item: T) => string;
  onSelect: (item: T) => void;
  onClose: () => void;
}

export function FilterModal<T>({
  isOpen,
  title,
  items,
  labelSelector,
  onSelect,
  onClose,
}: FilterModalProps<T>) {
  const [search, setSearch] = useState('');

  const filteredItems = items?.filter((item) =>
    labelSelector(item).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose}>
      <div className={GlobalStyles.wrapperModalFilter}>
        <SearchBar onSearch={setSearch} placeholder={`Buscar ${title.toLowerCase()}...`} />
        <div className={GlobalStyles.wrapperFilterItens}>
          {filteredItems?.map((item, idx) => (
            <div
              className={GlobalStyles.filterItens}
              key={idx}
              onClick={() => {
                onSelect(item);
                onClose();
              }}
            >
              {labelSelector(item)}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}