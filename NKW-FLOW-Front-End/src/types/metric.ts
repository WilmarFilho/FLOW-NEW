export interface ChatsMetricLabel {
    name: string;
    chats: number;
}

export interface ChatsMetricResponse {
    labels: ChatsMetricLabel[];
    total: number;
    previous_total: number;
    diff: number;
    percent: number;
}

export interface ConnectionsMetric {
    name: string;
    value: number;
}

export interface MetricsState {
    novos: ChatsMetricResponse | null;
    fechados: ChatsMetricResponse | null;
    atendentes: ChatsMetricLabel[];
    conexoes: ConnectionsMetric[];
}
