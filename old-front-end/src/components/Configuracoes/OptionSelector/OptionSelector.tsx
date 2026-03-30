import styles from './OptionSelector.module.css';

type OptionSelectorProps = {
  options: string[];
  selected: string;
  onChange: (value: string) => void;
};

export default function OptionSelector({ options, selected, onChange }: OptionSelectorProps) {
  return (
    <div className={styles.container}>
      {options.map((opt) => (
        <button
          key={opt}
          className={`${styles.button} ${selected === opt ? styles.active : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}