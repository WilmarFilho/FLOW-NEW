import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMediaQuery } from 'react-responsive';
import Button from '../components/Gerais/Buttons/Button';
import MetricCard from '../components/Resumo/MetricCard/MetricCard';
import DropdownPeriod from '../components/Resumo/DropdownPeriod/DropdownPeriod';
import BarMetricChart from '../components/Resumo/BarMetricChart/BarMetricChart';
import LineMetricChart from '../components/Resumo/LineMetricChart/LineMetricChart';
import Icon from '../components/Gerais/Icons/Icons';
import GlobalStyles from '../global.module.css';
import { useResumoPage } from '../hooks/pages/useResumoPage';

export default function ResumoPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery({ maxWidth: 595.98 });

  const {
    viewChatsNovos,
    setViewChatsNovos,
    viewChatsFechados,
    setViewChatsFechados,
    openDropdown,
    setOpenDropdown,
    dataNovos,
    dataFechados,
    dataConexoes,
    dataAtendentes,
    heightAtedentes,
    widthConexoes,
  } = useResumoPage();

  const getMobileData = useCallback(<T,>(data?: T[]) => (isMobile && data ? data.slice(-3) : data ?? []), [isMobile]);
  const formatValue = useCallback((v?: number) => `${v ?? 0}`, []);
  const formatPercent = useCallback((p?: number) => (p != null ? `${p.toFixed(1)}%` : '0%'), []);

  const formatMetric = useCallback(
    (data?: { total?: number; percent?: number; diff?: number }) => ({
      value: `+ ${formatValue(data?.total)}`,
      percent: formatPercent(data?.percent),
      variationText: `${data?.diff && data.diff >= 0 ? '+' : ''}${data?.diff ?? 0} comparado ao período anterior`,
    }),
    [formatValue, formatPercent]
  );

  const novos = useMemo(() => formatMetric(dataNovos ?? undefined), [dataNovos, formatMetric]);
  const fechados = useMemo(() => formatMetric(dataFechados ?? undefined), [dataFechados, formatMetric]);

  return (
    <div className={GlobalStyles.pageContainer}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
        className={GlobalStyles.pageHeader}
      >
        <div className={GlobalStyles.pageHeaderTitles}>
          <h2>Veja seu resumo</h2>
          <h3>Resumos de produtividade para acompanhamento fácil.</h3>
        </div>
        <Button onClick={() => navigate('/ajuda')} label="Quero Ajuda" />
      </motion.div>

      <div className={GlobalStyles.pageContentResumo}>

        {/* Chats Novos / Fechados */}
        <motion.div className={GlobalStyles.pageRow}>
          <MetricCard
            title="Chats Novos"
            icon={<Icon nome="chaton" />}
            value={novos.value}
            variation={novos.percent}
            variationText={novos.variationText}
            dropdown={
              <DropdownPeriod
                value={viewChatsNovos}
                onChange={setViewChatsNovos}
                id="novos"
                openId={openDropdown}
                setOpenId={setOpenDropdown}
              />
            }
            isMobile={isMobile}
          >
            <BarMetricChart data={getMobileData(dataNovos?.labels)} dataKey="chats" />
          </MetricCard>

          <MetricCard
            title="Chats Fechados"
            icon={<Icon nome="chatoff" />}
            value={fechados.value}
            variation={fechados.percent}
            variationText={fechados.variationText}
            dropdown={
              <DropdownPeriod
                value={viewChatsFechados}
                onChange={setViewChatsFechados}
                id="fechados"
                openId={openDropdown}
                setOpenId={setOpenDropdown}
              />
            }
            isMobile={isMobile}
          >
            <BarMetricChart data={getMobileData(dataFechados?.labels)} dataKey="chats" />
          </MetricCard>
        </motion.div>

        {/* Chats por Atendentes / Conexões / Convidados */}
        <motion.div className={GlobalStyles.pageRowVariant}>
          <MetricCard title="Chats por Atendentes" icon={<Icon nome="userlist" />} small isMobile={isMobile}>
            <div style={{ height: 200, overflowY: 'auto', paddingRight: 8, width: '100%', scrollbarWidth: 'none' }}>
              <BarMetricChart
                data={getMobileData(dataAtendentes)}
                dataKey="chats"
                vertical
                barSize={56}
                height={heightAtedentes}
              />
            </div>
          </MetricCard>

          <MetricCard title="Chats por Conexões" icon={<Icon nome="connect" />} small isMobile={isMobile}>
            <div className={GlobalStyles.chartContainer}>
              {(isMobile || (Array.isArray(dataConexoes) && dataConexoes.length > 3)) ? (
                <BarMetricChart
                  data={getMobileData(dataConexoes)}
                  dataKey="value"
                  vertical
                  barSize={56}
                  height={200}
                />
              ) : (
                <LineMetricChart data={getMobileData(dataConexoes)} dataKey="value" width={widthConexoes} />
              )}
            </div>
          </MetricCard>
        </motion.div>

      </div>

    </div>
  );
}

