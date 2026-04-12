'use client';

import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, LoaderCircle, Sparkles, XCircle } from 'lucide-react';

export type ContactQualificationJob = {
  currentContactName: string | null;
  error: string | null;
  finishedAt: string | null;
  id: string;
  processed: number;
  resultsByList: Array<{
    count: number;
    listId: string;
    listName: string;
  }>;
  startedAt: string;
  status: 'running' | 'completed' | 'failed';
  total: number;
  unqualifiedNoConversation: number;
  unqualifiedNoMatch: number;
};

type Props = {
  isOpen: boolean;
  isStarting: boolean;
  job: ContactQualificationJob | null;
  onClose: () => void;
  onConfirm: () => void;
};

const backdrop = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modal = {
  hidden: { opacity: 0, scale: 0.96, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 12 },
};

export default function ContactQualificationModal({
  isOpen,
  isStarting,
  job,
  onClose,
  onConfirm,
}: Props) {
  const isRunning = isStarting || job?.status === 'running';
  const isCompleted = job?.status === 'completed';
  const isFailed = job?.status === 'failed';
  const qualifiedTotal =
    job?.resultsByList.reduce((acc, item) => acc + item.count, 0) ?? 0;
  const progress =
    job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  const modalContent = (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={isRunning ? undefined : onClose}
        >
          <motion.div
            className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[rgba(9,13,24,0.94)] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
            variants={modal}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="mb-2 inline-flex rounded-full bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Qualificação automática
                </span>

              </div>
              {!isRunning ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  Fechar
                </button>
              ) : null}
            </div>

            {!job ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-white/78">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-amber-100">
                    <AlertTriangle size={16} />
                    Antes de continuar
                  </div>
                  <p className="leading-6">
                    Vamos analisar os contatos sem lista, ler o histórico de conversa
                    disponível e tentar encaixar cada um em uma lista com base na
                    descrição que você cadastrou para ela.
                  </p>
                  <p className="mt-3 leading-6 text-white/60">
                    Contatos sem conversa suficiente ou sem aderência clara a
                    nenhuma descrição ficam sem qualificação no resumo final.
                  </p>
                </div>

                <div className="grid gap-3 rounded-2xl border border-white/8 bg-white/4 p-4 text-sm text-white/68">
                  <div className="flex items-center gap-2 font-medium text-white/84">
                    <Sparkles size={16} />
                    O que acontece agora
                  </div>
                  <p>1. Buscamos contatos seus que ainda não estão em nenhuma lista.</p>
                  <p>2. Lemos o histórico das conversas existentes desses contatos.</p>
                  <p>3. Classificamos cada contato na lista mais adequada, quando houver evidência clara.</p>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isStarting}
                    className="rounded-2xl bg-[var(--color-secondary)] px-5 py-3 text-sm font-semibold text-[var(--color-aux-black)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isStarting ? 'Iniciando...' : 'Iniciar qualificação'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                      Progresso
                    </span>
                    <strong className="mt-2 block text-2xl text-white">
                      {job.processed}/{job.total}
                    </strong>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                      Qualificados
                    </span>
                    <strong className="mt-2 block text-2xl text-white">
                      {qualifiedTotal}
                    </strong>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                      Sem qualificação
                    </span>
                    <strong className="mt-2 block text-2xl text-white">
                      {(job.unqualifiedNoConversation || 0) + (job.unqualifiedNoMatch || 0)}
                    </strong>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm text-white/62">
                    <span>
                      {isRunning
                        ? job.currentContactName
                          ? `Analisando ${job.currentContactName}`
                          : 'Preparando qualificação'
                        : isCompleted
                          ? 'Processamento finalizado'
                          : 'Processamento interrompido'}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  {job.resultsByList.map((item) => (
                    <div
                      key={item.listId}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/4 px-4 py-3"
                    >
                      <span className="text-sm text-white/74">{item.listName}</span>
                      <strong className="text-white">{item.count}</strong>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-white/4 p-4 text-sm text-white/68">
                    <div className="mb-2 flex items-center gap-2 font-medium text-white/84">
                      <XCircle size={16} />
                      Sem conversa suficiente
                    </div>
                    <strong className="block text-xl text-white">
                      {job.unqualifiedNoConversation}
                    </strong>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/4 p-4 text-sm text-white/68">
                    <div className="mb-2 flex items-center gap-2 font-medium text-white/84">
                      <AlertTriangle size={16} />
                      Sem aderência clara
                    </div>
                    <strong className="block text-xl text-white">
                      {job.unqualifiedNoMatch}
                    </strong>
                  </div>
                </div>

                {isCompleted ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-4 text-sm text-emerald-50/90">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    <p className="leading-6">
                      Resumo final: {qualifiedTotal} contato(s) qualificado(s),
                      {` ${job.unqualifiedNoConversation}`} sem conversa suficiente
                      e {job.unqualifiedNoMatch} sem aderência clara às descrições
                      cadastradas.
                    </p>
                  </div>
                ) : null}

                {isFailed ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-400/15 bg-rose-400/10 p-4 text-sm text-rose-50/90">
                    <XCircle size={18} className="mt-0.5 shrink-0" />
                    <p className="leading-6">
                      {job.error || 'A qualificação falhou antes de concluir o processamento.'}
                    </p>
                  </div>
                ) : null}

                <div className="flex justify-end">
                  {isRunning ? (
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-white/70">
                      <LoaderCircle size={16} className="animate-spin" />
                      Processando em tempo real
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-2xl bg-[var(--color-secondary)] px-5 py-3 text-sm font-semibold text-[var(--color-aux-black)] transition hover:-translate-y-0.5"
                    >
                      Fechar resumo
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(modalContent, document.body);
}
