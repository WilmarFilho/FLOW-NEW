// Libs
import { motion, AnimatePresence } from 'framer-motion';
// Css
import Styles from './DropdownPeriod.module.css'
// Icon
import Icon from '../../../components/Gerais/Icons/Icons';

export type ViewType = 'weekly' | 'monthly';
export type DropdownId = string | null;

interface DropdownPeriodProps {
  value: ViewType;
  onChange: (value: ViewType) => void;
  id: DropdownId;
  openId: DropdownId;
  setOpenId: (id: DropdownId) => void;
}

const options = [
  { value: 'weekly', label: 'Semanal' },
];

export default function DropdownPeriod({
  value,
  onChange,
  id,
  openId,
  setOpenId
}: DropdownPeriodProps) {
  return (
    <div className={Styles.dropdownSelect}>
      <button
        className={Styles.dropdownSelectButton}
        onClick={() => setOpenId(openId === id ? null : id)}
      >
        <Icon nome='calendar' />
        {options.find(o => o.value === value)?.label}
      </button>

      <AnimatePresence>
        {openId === id && (
          <motion.ul
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className={Styles.dropdownSelectList}
          >
            {options.map(opt => (
              <li
                key={opt.value}
                className={Styles.dropdownSelectListItem}
                onClick={() => {
                  onChange(opt.value as ViewType);
                  setOpenId(null);
                }}
              >
                {opt.label}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}