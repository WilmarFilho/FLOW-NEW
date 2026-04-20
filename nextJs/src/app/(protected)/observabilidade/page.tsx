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

    // Re-fetch every 30 seconds
    const interval = setInterval(() => {
      fetchLogs();
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [accessGranted]);

  const handleAccessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (secretInput === process.env.NEXT_PUBLIC_OBSERVER_SECRET_KEY) {
      setAccessGranted(true);
    } else {
      alert('Chave secreta incorreta.');
      setSecretInput('');
    }
  };

  if (!accessGranted) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
        <form onSubmit={handleAccessSubmit} className="bg-card border rounded-lg p-8 max-w-sm w-full flex flex-col gap-4">
          <div className="text-center mb-2">
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">Área Restrita</h1>
            <p className="text-sm text-muted-foreground mt-1">Informe a chave de observabilidade.</p>
          </div>
          <input
            type="password"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            placeholder="Chave secreta"
            required
            autoFocus
          />
          <button type="submit" className="h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors">
            Acessar Logs
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
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Observabilidade</h1>
        <p className="text-muted-foreground">Monitoramento em tempo real do Swarm</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6 flex flex-col">
          <span className="text-sm font-medium text-muted-foreground mb-2">Erros (24h)</span>
          <span className="text-3xl font-bold">{stats.errors}</span>
        </div>
        <div className="bg-card border rounded-lg p-6 flex flex-col">
          <span className="text-sm font-medium text-muted-foreground mb-2">Erros Servidor (500+) (24h)</span>
          <span className="text-3xl font-bold">{stats.serverErrors}</span>
        </div>
        <div className="bg-card border rounded-lg p-6 flex flex-col">
          <span className="text-sm font-medium text-muted-foreground mb-2">Latência Média (100 req)</span>
          <span className="text-3xl font-bold">{stats.avgLatency} ms</span>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
          <h2 className="font-semibold">Logs Recentes</h2>
          <button 
            onClick={fetchLogs}
            disabled={loading}
            className="text-sm px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hora</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Level</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ação</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Serviço</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status / Tempo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-1/3">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {format(new Date(log.created_at), 'dd/MM HH:mm:ss', { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={\`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium \${
                      log.level === 'error' ? 'bg-red-500/10 text-red-500' :
                      log.level === 'warn' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-blue-500/10 text-blue-500'
                    }\`}>
                      {log.level.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{log.action}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>{log.service_name || 'N/A'}</span>
                      <span className="text-xs text-muted-foreground">{log.instance_id?.split('-')[0]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col">
                      {log.http_status && (
                        <span className={log.http_status >= 500 ? 'text-red-500' : log.http_status >= 400 ? 'text-yellow-500' : 'text-green-500'}>
                          HTTP {log.http_status}
                        </span>
                      )}
                      {log.duration_ms && <span className="text-xs text-muted-foreground">{log.duration_ms} ms</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs">{log.message}</span>
                      {log.request_path && <span className="text-xs text-muted-foreground truncate max-w-sm">Path: {log.request_path}</span>}
                      {log.trace_id && <span className="text-xs text-muted-foreground truncate max-w-sm" title={log.trace_id}>Trace: {log.trace_id.substring(0,8)}...</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum log encontrado.
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
