'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  Bot,
  CalendarRange,
  Clock3,
  MessageCircleMore,
  RadioTower,
  Sparkles,
  Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  cardEntrance,
  headerEntrance,
  listStagger,
  pageEntrance,
} from '@/lib/motion/variants';
import {
  type ChartSeriesKey,
  type DashboardData,
  type RangeOption,
  useDashboardPage,
} from './useDashboardPage';
import styles from './HomePage.module.css';

const RANGE_OPTIONS: Array<{ label: string; value: RangeOption }> = [
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
  { label: '90 dias', value: '90d' },
];

const SERIES_META: Record<
  ChartSeriesKey,
  { color: string; label: string; muted: string }
> = {
  campaigns: {
    color: '#f8e96f',
    label: 'Campanhas',
    muted: 'rgba(248, 233, 111, 0.18)',
  },
  chats: {
    color: '#2f8cff',
    label: 'Chats',
    muted: 'rgba(47, 140, 255, 0.18)',
  },
  contacts: {
    color: '#6ee7b7',
    label: 'Contatos',
    muted: 'rgba(110, 231, 183, 0.18)',
  },
  messages: {
    color: '#9bd8ff',
    label: 'Mensagens',
    muted: 'rgba(155, 216, 255, 0.18)',
  },
};

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  completed: 'Concluida',
  draft: 'Rascunho',
  failed: 'Falhou',
  running: 'Rodando',
};

function formatDelta(
  metric: DashboardData['summary']['chatsStarted'],
  positiveLabel = 'vs período anterior',
) {
  if (metric.delta === null) {
    return 'Sem comparação';
  }

  if (metric.direction === 'flat') {
    return 'Estável';
  }

  const signal = metric.direction === 'up' ? '+' : '';
  return `${signal}${metric.delta}% ${positiveLabel}`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function describeScope(scope: DashboardData['scope']) {
  return scope === 'restricted'
    ? 'Resumo das conexões liberadas para este atendente'
    : 'Resumo operacional completo da plataforma';
}

function buildLinePath(values: number[], width: number, height: number) {
  if (!values.length) {
    return '';
  }

  const max = Math.max(...values, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (value / max) * height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function buildAreaPath(values: number[], width: number, height: number) {
  if (!values.length) {
    return '';
  }

  const linePath = buildLinePath(values, width, height);
  return `${linePath} L ${width} ${height} L 0 ${height} Z`;
}

function ChartPanel({
  activeSeries,
  data,
  onToggleSeries,
}: {
  activeSeries: ChartSeriesKey[];
  data: DashboardData;
  onToggleSeries: (series: ChartSeriesKey) => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 820;
  const height = 260;
  const hoveredPoint = hoveredIndex === null ? null : data.timeline[hoveredIndex];

  const visibleSeries: ChartSeriesKey[] = activeSeries.length
    ? activeSeries
    : ['chats'];
  const maxValue = Math.max(
    1,
    ...data.timeline.flatMap((point) =>
      visibleSeries.map((series) => point[series]),
    ),
  );

  return (
    <motion.section className={styles.chartCard} variants={cardEntrance}>
      <div className={styles.chartHeader}>
        <div>
          <span className={styles.eyebrow}>Pulso operacional</span>
          <h2>Movimento da operação ao longo do tempo</h2>
          <p>
            Ligue ou desligue séries para comparar volume de chats, mensagens,
            contatos e campanhas no mesmo recorte.
          </p>
        </div>

        <div className={styles.seriesToggleGrid}>
          {(Object.keys(SERIES_META) as ChartSeriesKey[]).map((series) => {
            const active = activeSeries.includes(series);
            const meta = SERIES_META[series];

            return (
              <button
                key={series}
                type="button"
                className={`${styles.seriesToggle} ${active ? styles.seriesToggleActive : ''
                  }`}
                onClick={() => onToggleSeries(series)}
              >
                <span
                  className={styles.seriesDot}
                  style={{ backgroundColor: meta.color }}
                />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.chartCanvasWrap}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.chartCanvas}
          role="img"
          aria-label="Gráfico de tendência do dashboard"
        >
          {[0, 1, 2, 3].map((step) => {
            const y = (height / 3) * step;
            return (
              <line
                key={step}
                x1="0"
                x2={width}
                y1={y}
                y2={y}
                className={styles.chartGridLine}
              />
            );
          })}

          {visibleSeries.map((series) => {
            const values = data.timeline.map((point) => point[series]);
            const meta = SERIES_META[series];
            return (
              <g key={series}>
                <path
                  d={buildAreaPath(values, width, height)}
                  fill={meta.muted}
                  className={styles.chartArea}
                />
                <path
                  d={buildLinePath(values, width, height)}
                  stroke={meta.color}
                  className={styles.chartLine}
                />
              </g>
            );
          })}

          {data.timeline.map((point, index) => {
            const x =
              data.timeline.length > 1
                ? (width / (data.timeline.length - 1)) * index
                : width / 2;

            return (
              <g key={point.key}>
                <line
                  x1={x}
                  x2={x}
                  y1="0"
                  y2={height}
                  className={`${styles.chartCursor} ${hoveredIndex === index ? styles.chartCursorVisible : ''
                    }`}
                />
                <rect
                  x={Math.max(0, x - width / data.timeline.length / 2)}
                  y="0"
                  width={Math.max(22, width / data.timeline.length)}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onFocus={() => setHoveredIndex(index)}
                />
              </g>
            );
          })}

          {hoveredIndex !== null &&
            visibleSeries.map((series) => {
              const value = data.timeline[hoveredIndex]?.[series] || 0;
              const x =
                data.timeline.length > 1
                  ? (width / (data.timeline.length - 1)) * hoveredIndex
                  : width / 2;
              const y = height - (value / maxValue) * height;

              return (
                <circle
                  key={`${series}-${hoveredIndex}`}
                  cx={x}
                  cy={y}
                  r="5.5"
                  fill={SERIES_META[series].color}
                  className={styles.chartPoint}
                />
              );
            })}
        </svg>

        <div className={styles.chartLabels}>
          {data.timeline.map((point, index) => (
            <button
              key={point.key}
              type="button"
              className={`${styles.chartLabel} ${hoveredIndex === index ? styles.chartLabelActive : ''
                }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onFocus={() => setHoveredIndex(index)}
              onClick={() => setHoveredIndex(index)}
            >
              {point.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartFooter}>
        {hoveredPoint ? (
          <>
            <div>
              <span className={styles.chartFooterLabel}>Janela selecionada</span>
              <strong>{hoveredPoint.label}</strong>
            </div>
            <div className={styles.chartFooterStats}>
              {visibleSeries.map((series) => (
                <span key={series}>
                  {SERIES_META[series].label}: {hoveredPoint[series]}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <div>
              <span className={styles.chartFooterLabel}>Leitura atual</span>
              <strong>Passe o mouse no gráfico para inspecionar cada janela</strong>
            </div>
            <div className={styles.chartFooterStats}>
              <span>Total de pontos: {data.timeline.length}</span>
            </div>
          </>
        )}
      </div>
    </motion.section>
  );
}

export default function HomePage() {
  const {
    activeSeries,
    data,
    headlineCards,
    isLoading,
    range,
    setActiveSeries,
    setRange,
  } = useDashboardPage();

  const doughnutValues = useMemo(() => {
    if (!data) {
      return { active: 0, archived: 0, human: 0 };
    }

    const total = Math.max(
      1,
      data.summary.activeChats +
      data.summary.archivedChats +
      data.summary.humanAttentionChats,
    );

    return {
      active: Math.round((data.summary.activeChats / total) * 100),
      archived: Math.round((data.summary.archivedChats / total) * 100),
      human: Math.round((data.summary.humanAttentionChats / total) * 100),
    };
  }, [data]);

  const donutCircumference = 2 * Math.PI * 52;
  const humanStroke = (doughnutValues.human / 100) * donutCircumference;
  const archivedStroke = (doughnutValues.archived / 100) * donutCircumference;
  const activeStroke = (doughnutValues.active / 100) * donutCircumference;

  const toggleSeries = (series: ChartSeriesKey) => {
    setActiveSeries((current) => {
      if (current.includes(series)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== series);
      }

      return [...current, series];
    });
  };

  if (isLoading || !data) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loadingOrb} />
        <strong>Carregando a central de performance...</strong>
        <span>
          Estamos consolidando chats, campanhas, contatos e agenda para montar
          o panorama do seu workspace.
        </span>
      </div>
    );
  }

  return (
    <motion.div
      className={styles.page}
      variants={pageEntrance}
      initial="hidden"
      animate="visible"
    >
      <motion.header className={styles.header} variants={headerEntrance}>
        <div className={styles.headerContent}>
          <span className={styles.headerEyebrow}>Dashboard FLOW</span>

        </div>

        <div className={styles.headerControls}>
          <div className={styles.rangePicker}>
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.rangeChip} ${range === option.value ? styles.rangeChipActive : ''
                  }`}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className={styles.headerMeta}>
            <Sparkles size={16} />
            Atualizado em {formatTimestamp(data.generatedAt)}
          </div>
        </div>
      </motion.header>

      <motion.section
        className={styles.heroStats}
        variants={listStagger}
        initial="hidden"
        animate="visible"
      >
        {headlineCards.map((card) => (
          <motion.article
            key={card.label}
            className={`${styles.statCard} ${styles[`statCard${card.accent[0].toUpperCase()}${card.accent.slice(1)}`]}`}
            variants={cardEntrance}
          >
            <span className={styles.statLabel}>{card.label}</span>
            <strong className={styles.statValue}>{card.value}</strong>
            <span
              className={`${styles.statDelta} ${card.metric.direction === 'down'
                  ? styles.statDeltaDown
                  : card.metric.direction === 'up'
                    ? styles.statDeltaUp
                    : styles.statDeltaFlat
                }`}
            >
              {formatDelta(card.metric)}
            </span>
          </motion.article>
        ))}
      </motion.section>

      <div className={styles.primaryGrid}>
        <ChartPanel
          activeSeries={activeSeries}
          data={data}
          onToggleSeries={toggleSeries}
        />

        <motion.aside className={styles.engineCard} variants={cardEntrance}>
          <div className={styles.engineHeader}>
            <span className={styles.eyebrow}>Estado do funil</span>
            <h2>Saúde do motor de atendimento</h2>
            <p>
              Veja como os chats estão distribuídos entre operação ativa,
              arquivados e pontos que pedem atenção humana.
            </p>
          </div>

          <div className={styles.donutWrap}>
            <svg viewBox="0 0 140 140" className={styles.donutChart}>
              <circle cx="70" cy="70" r="52" className={styles.donutTrack} />
              <circle
                cx="70"
                cy="70"
                r="52"
                className={styles.donutSegmentHuman}
                strokeDasharray={`${humanStroke} ${donutCircumference - humanStroke
                  }`}
              />
              <circle
                cx="70"
                cy="70"
                r="52"
                className={styles.donutSegmentArchived}
                strokeDasharray={`${archivedStroke} ${donutCircumference - archivedStroke
                  }`}
                strokeDashoffset={-humanStroke}
              />
              <circle
                cx="70"
                cy="70"
                r="52"
                className={styles.donutSegmentActive}
                strokeDasharray={`${activeStroke} ${donutCircumference - activeStroke
                  }`}
                strokeDashoffset={-(humanStroke + archivedStroke)}
              />
            </svg>

            <div className={styles.donutCenter}>
              <strong>{data.summary.activeChats}</strong>
              <span>chats ativos</span>
            </div>
          </div>

          <div className={styles.engineMetrics}>
            <div className={styles.engineMetric}>
              <span>
                <MessageCircleMore size={15} /> Chats ativos
              </span>
              <strong>{data.summary.activeChats}</strong>
            </div>
            <div className={styles.engineMetric}>
              <span>
                <Archive size={15} /> Arquivados
              </span>
              <strong>{data.summary.archivedChats}</strong>
            </div>
            <div className={styles.engineMetric}>
              <span>
                <Users size={15} /> Atenção humana
              </span>
              <strong>{data.summary.humanAttentionChats}</strong>
            </div>
            <div className={styles.engineMetric}>
              <span>
                <Bot size={15} /> IA ativa
              </span>
              <strong>{data.summary.aiActiveChats}</strong>
            </div>
            <div className={styles.engineMetric}>
              <span>
                <CalendarRange size={15} /> Agendamentos da semana
              </span>
              <strong>{data.summary.appointmentsThisWeek}</strong>
            </div>
            <div className={styles.engineMetric}>
              <span>
                <RadioTower size={15} /> Campanhas rodando
              </span>
              <strong>{data.summary.runningCampaigns}</strong>
            </div>
          </div>
        </motion.aside>
      </div>

      <motion.section
        className={styles.secondaryGrid}
        variants={listStagger}
        initial="hidden"
        animate="visible"
      >
        <motion.article className={styles.panel} variants={cardEntrance}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Distribuição</span>
              <h3>Chats por usuário</h3>
            </div>
            <Users size={18} className={styles.panelIcon} />
          </div>

          <div className={styles.barList}>
            {data.chatsByUser.length ? (
              data.chatsByUser.map((item) => {
                const maxCount = Math.max(
                  1,
                  ...data.chatsByUser.map((entry) => entry.count),
                );
                const width = (item.count / maxCount) * 100;

                return (
                  <div key={item.id} className={styles.barItem}>
                    <div className={styles.barMeta}>
                      <strong>{item.name}</strong>
                      <span>{item.count} chat(s)</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyMiniState}>
                Nenhum chat atribuído no período selecionado.
              </div>
            )}
          </div>
        </motion.article>

        <motion.article className={styles.panel} variants={cardEntrance}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Agenda da semana</span>
              <h3>Agendamentos por dia</h3>
            </div>
            <Clock3 size={18} className={styles.panelIcon} />
          </div>

          <div className={styles.weekList}>
            {data.appointmentsByWeekday.map((day) => {
              const maxTotal = Math.max(
                1,
                ...data.appointmentsByWeekday.map((entry) => entry.total),
              );
              const height = 26 + (day.total / maxTotal) * 90;

              return (
                <div key={day.key} className={styles.weekItem}>
                  <div className={styles.weekColumns}>
                    <div
                      className={styles.weekColumnConfirmed}
                      style={{ height: `${(day.confirmed / maxTotal) * height}px` }}
                    />
                    <div
                      className={styles.weekColumnPending}
                      style={{ height: `${(day.pending / maxTotal) * height}px` }}
                    />
                    <div
                      className={styles.weekColumnCancelled}
                      style={{ height: `${(day.cancelled / maxTotal) * height}px` }}
                    />
                  </div>
                  <strong>{day.total}</strong>
                  <span>{day.label}</span>
                </div>
              );
            })}
          </div>

          <div className={styles.legendRow}>
            <span>
              <i className={styles.legendConfirmed} />
              Confirmado
            </span>
            <span>
              <i className={styles.legendPending} />
              Pendente
            </span>
            <span>
              <i className={styles.legendCancelled} />
              Cancelado
            </span>
          </div>
        </motion.article>

        <motion.article className={styles.panel} variants={cardEntrance}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Canais em foco</span>
              <h3>WhatsApps mais ativos</h3>
            </div>
            <Activity size={18} className={styles.panelIcon} />
          </div>

          <div className={styles.connectionList}>
            {data.topConnections.length ? (
              data.topConnections.map((connection) => (
                <div key={connection.id} className={styles.connectionItem}>
                  <div className={styles.connectionHead}>
                    <div className={styles.connectionIdentity}>
                      <span
                        className={styles.connectionAccent}
                        style={{ backgroundColor: connection.accent }}
                      />
                      <strong>{connection.name}</strong>
                    </div>
                    <span>{connection.messages} msg</span>
                  </div>
                  <div className={styles.connectionStats}>
                    <span>{connection.chats} chats</span>
                    <span>{connection.campaigns} campanhas</span>
                    <span className={styles.connectionStatus}>
                      {connection.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyMiniState}>
                Nenhuma conexão ativa neste intervalo.
              </div>
            )}
          </div>
        </motion.article>

        <motion.article className={styles.panel} variants={cardEntrance}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Campanhas recentes</span>
              <h3>Últimos movimentos</h3>
            </div>
            <Sparkles size={18} className={styles.panelIcon} />
          </div>

          <div className={styles.campaignList}>
            {data.recentCampaigns.length ? (
              data.recentCampaigns.map((campaign) => (
                <div key={campaign.id} className={styles.campaignItem}>
                  <div className={styles.campaignTop}>
                    <strong>{campaign.nome}</strong>
                    <span className={styles.campaignBadge}>
                      {CAMPAIGN_STATUS_LABEL[campaign.status] || campaign.status}
                    </span>
                  </div>
                  <span className={styles.campaignDate}>
                    {formatTimestamp(campaign.created_at)}
                  </span>
                  <div className={styles.campaignProgressTrack}>
                    <div
                      className={styles.campaignProgressFill}
                      style={{ width: `${campaign.progress}%` }}
                    />
                  </div>
                  <span className={styles.campaignProgressLabel}>
                    {campaign.progress}% do lote processado
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.emptyMiniState}>
                Nenhuma campanha criada no recorte atual.
              </div>
            )}
          </div>
        </motion.article>
      </motion.section>
    </motion.div>
  );
}
