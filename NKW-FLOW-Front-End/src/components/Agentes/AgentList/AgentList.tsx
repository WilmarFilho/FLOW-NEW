// Component
import AgentCard from '../AgentCard/AgentCard';
// Css
import Style from './AgentList.module.css';
// Type
import type { Agent } from '../../../types/agent';

interface AgentListProps {
  agents: Agent[] | null;
  onSelectAgent: (agent: Agent | null) => void;
}

export default function AgentList({ agents, onSelectAgent }: AgentListProps) {
  return (
    <div className={Style.agentsList}>
      {agents && agents.map((agent) => (
        <AgentCard
          key={agent.id}
          tipo={agent.tipo_de_agente}
          description={agent.descricao}
          onViewDetails={() => onSelectAgent(agent)}
        />
      ))}
    </div>
  );
}