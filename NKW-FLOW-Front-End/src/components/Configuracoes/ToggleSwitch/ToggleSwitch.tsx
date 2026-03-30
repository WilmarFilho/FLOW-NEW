// CSS Modules
import styles from './ToggleSwitch.module.css';

type ToggleSwitchProps = {
  isOn: boolean;
  onToggle: () => void;
  variant?: string;
};

export default function ToggleSwitch({ isOn, onToggle, variant = 'primary' }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      className={`${ variant === 'secondary' ? styles.toggleSwitchSecondary : styles.toggleSwitch} ${isOn ? styles.on : styles.off}`}
      onClick={onToggle}
    >
      <div className={`${variant === 'secondary' ? styles.switchKnobSecondary : styles.switchKnob}   ${isOn ? styles.on : styles.off}`} />
    </button>
  );
}