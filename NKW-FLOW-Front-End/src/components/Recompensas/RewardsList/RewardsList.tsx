import Styles from './RewardsList.module.css';
import Icon from '../../../components/Gerais/Icons/Icons';

interface Reward {
  tier: number;
  name: string;
  goal: number;
  casbackPercentual: number;
  rewardBonus?: string;
}

interface RewardsListProps {
  rewards: Reward[];
  totalIndicacoes: number;
}

export default function RewardsList({ rewards, totalIndicacoes }: RewardsListProps) {
  return (
    <div className={Styles.containerRewards}>
      {rewards.map((reward) => (
        <div
          key={reward.tier}
          className={`${Styles.boxReward} ${
            totalIndicacoes >= reward.goal
              ? Styles.boxRewardUnlock
              : Styles.boxRewardLocked
          }`}
        >
          <div className={Styles.rowContainerRewards}>
            <Icon nome="medal" />
            <h2>{reward.goal} indicações</h2>
          </div>

          <div className={Styles.bodyContainerRewards}>
            <div className={Styles.rowBodyContainerRewards}>
              <h4>{reward.name}</h4>
              <span> -------------- Recompensas: -------------- </span>
            </div>

            <div className={Styles.containerLiRewards}>
              <div className={Styles.rowLiRewards}>
                <Icon nome="check" />
                <p>{reward.casbackPercentual}% de desconto</p>
              </div>
              {reward.rewardBonus && (
                <div className={Styles.rowLiRewards}>
                  <Icon nome="check" />
                  <p>{reward.rewardBonus}</p>
                </div>
              )}
            </div>
          </div>

          <div className={Styles.footerContainerRewards}>
            {totalIndicacoes >= reward.goal ? 'Desbloqueado' : 'Bloqueado'}
          </div>
        </div>
      ))}
    </div>
  );
}