'use client';

import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Link2, Phone, X } from 'lucide-react';

type ContactDetails = {
  id: string;
  nome: string;
  whatsapp: string;
  avatar_url: string | null;
  created_at?: string;
  connections: Array<{
    id: string;
    first_seen_at: string;
    last_seen_at: string;
    whatsapp_connection: {
      id: string;
      nome: string;
      numero: string | null;
      status: 'connected' | 'connecting' | 'disconnected' | 'deleted';
      cor: string | null;
      deleted_at?: string | null;
    } | null;
  }>;
};

type Props = {
  details: ContactDetails | null;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
};

function formatDate(value?: string | null) {
  if (!value) {
    return 'Sem registro';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getConnectionStatusLabel(
  connection: ContactDetails['connections'][number]['whatsapp_connection'],
) {
  if (!connection) {
    return 'desconhecido';
  }

  if (connection.deleted_at) {
    return 'Excluída';
  }

  if (connection.status === 'deleted') {
    return 'Excluída';
  }

  if (connection.status === 'connected') {
    return 'Conectada';
  }

  if (connection.status === 'connecting') {
    return 'Conectando';
  }

  return 'Desconectada';
}

export default function ContactDetailsModal({
  details,
  isLoading,
  isOpen,
  onClose,
}: Props) {
  const modalContent = (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[270] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[rgba(9,13,24,0.96)] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="mb-2 inline-flex rounded-full bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Detalhes do contato
                </span>

              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {isLoading ? (
              <div className="flex min-h-[260px] items-center justify-center">
                <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/15 border-t-[var(--color-secondary)]" />
              </div>
            ) : details ? (
              <div className="mt-6 grid gap-5">
                <div className="grid gap-4 rounded-[24px] border border-white/8 bg-white/4 p-4 md:grid-cols-[auto_1fr]">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[rgba(18,105,244,0.18)] text-xl font-extrabold text-white">
                    {details.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={details.avatar_url}
                        alt={details.nome}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      details.nome.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <strong className="block text-lg text-white">{details.nome}</strong>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/64">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5">
                        <Phone size={14} />
                        {details.whatsapp}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5">
                        <Link2 size={14} />
                        {details.connections.length} conexão(ões) com conversa
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">Connections relacionadas</h3>
                    <p className="mt-1 text-sm leading-6 text-white/56">
                      Estas são as conexões de WhatsApp em que este contato já apareceu em conversas.
                    </p>
                  </div>

                  {details.connections.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-white/10 bg-white/3 p-6 text-center text-sm text-white/50">
                      Este contato ainda não aparece em nenhuma conexão com conversa registrada.
                    </div>
                  ) : (
                    details.connections.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[22px] border border-white/8 bg-white/4 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ backgroundColor: item.whatsapp_connection?.cor || '#22c55e' }}
                            />
                            <div className="min-w-0">
                              <strong className="block truncate text-sm text-white">
                                {item.whatsapp_connection?.nome || 'Conexão não encontrada'}
                              </strong>
                              <span className="mt-1 block text-[12px] text-white/48">
                                {item.whatsapp_connection?.numero || 'Número não disponível'}
                              </span>
                            </div>
                          </div>
                          <span className="rounded-full bg-white/8 px-3 py-1.5 text-[11px] font-bold uppercase text-white/68">
                            {getConnectionStatusLabel(item.whatsapp_connection)}
                          </span>
                        </div>


                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-white/55">
                Não foi possível carregar os detalhes deste contato.
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
