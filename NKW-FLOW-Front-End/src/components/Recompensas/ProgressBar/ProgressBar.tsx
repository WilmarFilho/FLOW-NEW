import Styles from './ProgressBar.module.css';

interface Reward {
  tier: number;
  name: string;
  goal: number;
}

interface ProgressBarProps {
  rewards: Reward[];
  totalIndicacoes: number;
  progresso: number;
}

export default function ProgressBar({ rewards, totalIndicacoes, progresso }: ProgressBarProps) {
  return (
    <div className={Styles.progressBar}>
      <div
        className={Styles.progressFillReward}
        style={{ width: `${progresso}%` }}
      ></div>
      {rewards.map((reward) => (
        <div
          key={reward.tier}
          className={`${Styles.progressCheckpoint} ${
            totalIndicacoes >= reward.goal ? Styles.completed : ''
          }`}
          style={{
            left: `${(reward.goal / rewards[rewards.length - 1].goal) * 100}%`,
          }}
          title={`${reward.name} - ${reward.goal} indicações`}
        >
          {reward.tier}
        </div>
      ))}
    </div>
  );
}