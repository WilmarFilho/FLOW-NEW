'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LogEntry {
  id: string;
  created_at: string;
  level: string;
  action: string;
  message: string;
  service_name: string;
  http_status: number;
  duration_ms: number;
  trace_id: string;
  instance_id: string;
  request_path: string;
}

import { Activity, Server, Clock, RefreshCw, Key, ShieldAlert, TerminalSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { validateObserverSecret } from './actions';

export default function ObservabilidadePage() {
  const [accessGranted, setAccessGranted] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    errors: 0,
    serverErrors: 0,
    avgLatency: 0,
  });

  useEffect(() => {
    if (!accessGranted) return;

    fetchLogs();
    fetchStats();

    const interval = setInterval(() => {
      fetchLogs();
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [accessGranted]);

  const handleAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await validateObserverSecret(secretInput);
    if (isValid) {
      setAccessGranted(true);
    } else {
      alert('Chave secreta incorreta.');
      setSecretInput('');
    }
  };

  if (!accessGranted) {
    return (
      <div className="relative flex min-h-[80vh] items-center justify-center p-6 overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--color-primary)]/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[var(--color-secondary)]/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>

        <form onSubmit={handleAccessSubmit} className="relative z-10 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-[var(--radius-xl)] p-8 max-w-sm w-full flex flex-col gap-6 shadow-[var(--shadow-elevated)]">
          <div className="text-center mb-2 flex flex-col items-center">
            <div className="h-16 w-16 bg-[var(--glass-bg)] rounded-[var(--radius-lg)] flex items-center justify-center mb-4 border border-[var(--glass-border)]">
              <ShieldAlert className="h-8 w-8 text-[var(--color-secondary)]" />
            </div>
            <h1 className="text-2xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">Área Restrita</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-2">Informe a chave de observabilidade do cluster para acessar os logs do sistema.</p>
          </div>

          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground">
              <Key className="h-4 w-4" />
            </div>
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              className="flex h-11 w-full rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--color-surface-elevated)] pl-10 pr-3 text-sm ring-offset-[var(--color-surface)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] text-[var(--color-text)]"
              placeholder="Chave secreta..."
              required
              autoFocus
            />
          </div>
          <button type="submit" style={{ backgroundImage: 'var(--gradient-primary)' }} className="h-11 w-full text-white hover:opacity-90 inline-flex items-center justify-center rounded-[var(--radius-md)] text-sm font-semibold transition-all shadow-[var(--shadow-primary)]">
            Acessar Painel
          </button>
        </form>
      </div>
    );
  }

  const fetchStats = async () => {
    try {
      const { data: errorData } = await supabase
        .from('app_logs')
        .select('*', { count: 'exact', head: true })
        .eq('level', 'error')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const { data: serverErrorData } = await supabase
        .from('app_logs')
        .select('*', { count: 'exact', head: true })
        .gte('http_status', 500)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const { data: latencyData } = await supabase
        .from('app_logs')
        .select('duration_ms')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .not('duration_ms', 'is', null)
        .limit(100);

      const latencies = latencyData?.map(l => l.duration_ms) || [];
      const avgLat = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

      setStats({
        errors: errorData?.length || 0,
        serverErrors: serverErrorData?.length || 0,
        avgLatency: Math.round(avgLat),
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data as LogEntry[]);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full min-h-screen relative">
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>

      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-[var(--color-text)]">
            <TerminalSquare className="h-8 w-8 text-[var(--color-secondary)]" />
            Observabilidade do Cluster
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2">Monitoramento centralizado e logs distribuídos (Swarm)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchLogs(); fetchStats(); }}
            disabled={loading}
            className="h-10 px-4 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] hover:bg-[rgba(255,255,255,0.08)] rounded-[var(--radius-md)] flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 text-[var(--color-text)]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-[var(--color-secondary)]' : 'text-[var(--color-text)]'}`} />
            <span className="text-sm font-medium">{loading ? 'Sincronizando...' : 'Atualizar'}</span>
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="group bg-[var(--color-surface-card)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] p-6 flex flex-col relative overflow-hidden transition-all shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl transition-all" style={{ backgroundColor: 'var(--color-warning)', opacity: 0.1 }}></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-[var(--radius-sm)]" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Alertas / Erros (24h)</span>
          </div>
          <span className="text-4xl font-black text-[var(--color-text)]">{stats.errors}</span>
        </div>
        
        <div className="group bg-[var(--color-surface-card)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] p-6 flex flex-col relative overflow-hidden transition-all shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl transition-all" style={{ backgroundColor: 'var(--color-danger)', opacity: 0.1 }}></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-[var(--radius-sm)]" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>
              <Server className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Erros Severos (500+) (24h)</span>
          </div>
          <span className="text-4xl font-black text-[var(--color-text)]">{stats.serverErrors}</span>
        </div>
        
        <div className="group bg-[var(--color-surface-card)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] p-6 flex flex-col relative overflow-hidden transition-all shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl transition-all" style={{ backgroundColor: 'var(--color-success)', opacity: 0.1 }}></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-[var(--radius-sm)]" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)' }}>
              <Clock className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Latência Média (100 req)</span>
          </div>
          <span className="text-4xl font-black text-[var(--color-text)] flex items-baseline gap-1">
            {stats.avgLatency} <span className="text-lg font-medium text-[var(--color-text-muted)]">ms</span>
          </span>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[var(--color-surface-elevated)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-card)]">
        <div className="p-5 border-b border-[var(--glass-border)] bg-[rgba(0,0,0,0.2)] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[var(--color-secondary)]" />
            <h2 className="font-semibold text-lg text-[var(--color-text)]">Stream de Logs</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--color-success)' }}></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: 'var(--color-success)' }}></span>
            </span>
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Live</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]" style={{ backgroundColor: 'var(--color-aux-dark-blue)' }}>
                <th className="px-5 py-4 text-left font-semibold text-[var(--color-text-secondary)]">Hora</th>
                <th className="px-5 py-4 text-left font-semibold text-[var(--color-text-secondary)]">Status</th>
                <th className="px-5 py-4 text-left font-semibold text-[var(--color-text-secondary)]">Serviço/Container</th>
                <th className="px-5 py-4 text-left font-semibold text-[var(--color-text-secondary)]">Ação / Rota</th>
                <th className="px-5 py-4 text-left font-semibold text-[var(--color-text-secondary)] w-1/3">Contexto</th>
              </tr>
            </thead>
            <tbody style={{ divideColor: 'var(--glass-border)' }}>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottomColor: 'var(--glass-border)' }} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap text-[var(--color-text-secondary)] font-mono text-xs">
                    {format(new Date(log.created_at), 'dd/MM HH:mm:ss', { locale: ptBR })}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${log.level === 'error' ? 'bg-[rgba(239,68,68,0.1)] text-[var(--color-danger)] border border-[var(--color-danger)]' :
                        log.level === 'warn' ? 'bg-[rgba(245,158,11,0.1)] text-[var(--color-warning)] border border-[var(--color-warning)]' :
                          log.level === 'info' && log.http_status === 200 ? 'bg-[rgba(34,197,94,0.1)] text-[var(--color-success)] border border-[var(--color-success)]' :
                            'bg-[rgba(0,71,179,0.15)] text-[var(--color-primary-light)] border border-[var(--color-primary-light)]'
                        }`}>
                        {log.level.toUpperCase()}
                      </span>
                      {log.http_status && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {log.http_status >= 500 ? <AlertTriangle className="h-3 w-3" style={{ color: 'var(--color-danger)' }} /> :
                            log.http_status >= 400 ? <AlertTriangle className="h-3 w-3" style={{ color: 'var(--color-warning)' }} /> :
                              <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--color-success)' }} />}
                          <span className="font-mono text-xs font-semibold" style={{ color: log.http_status >= 500 ? 'var(--color-danger)' : log.http_status >= 400 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                            {log.http_status}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-[var(--color-text)]">{log.service_name || 'N/A'}</span>
                      <span className="text-[11px] font-mono text-[var(--color-text-secondary)] bg-[rgba(0,0,0,0.3)] px-1.5 py-0.5 rounded border border-[var(--glass-border)] w-fit">
                        {log.instance_id?.split('-')[0] || 'unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-[var(--color-text)]">{log.action || 'HTTP Request'}</span>
                      {log.request_path && <span className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-[200px]">{log.request_path}</span>}
                      {log.duration_ms && <span className="text-[11px] text-[var(--color-primary-light)] font-mono">{log.duration_ms}ms</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5 bg-[rgba(255,255,255,0.03)] rounded border border-[var(--glass-border)] p-2">
                      <span className="font-mono text-xs text-[var(--color-text)] break-words font-light">{log.message}</span>
                      {log.trace_id && (
                        <div className="flex items-center gap-1 mt-1 border-t border-[var(--glass-border)] pt-1.5">
                          <Key className="h-3 w-3 text-[var(--color-text-muted)]" />
                          <span className="text-[10px] text-[var(--color-text-muted)] font-mono truncate" title={log.trace_id}>
                            Trace: {log.trace_id}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-[var(--color-text-secondary)]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-4 bg-[var(--glass-bg)] rounded-[var(--radius-full)]">
                        <Activity className="h-8 w-8 text-[var(--color-text-muted)]" />
                      </div>
                      <p>Nenhum log encontrado para exibição.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
