'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PaywallModal({
  reason,
  profileId,
}: {
  reason: string;
  profileId: string;
}) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const plans = [
    {
      id: 'prod_TtWwXIpxANb0GU',
      name: 'Iniciante',
      mensal: 400,
      anual: 4000, // Equivale a 333/mês
      features: ['Até 1.200 mensagens/mês', 'Até 200 contatos em campanhas', 'Suporte Padrão'],
      color: 'from-white-500 to-white-400',
    },
    {
      id: 'prod_TtWx8O8eVpJuAt',
      name: 'Intermediário',
      mensal: 700,
      anual: 7000,
      features: ['Até 1.800 mensagens/mês', 'Até 300 contatos em campanhas', 'Suporte Prioritário'],
      popular: true,
      color: 'from-blue-500 to-blue-400',
    },
    {
      id: 'prod_TtWwDnPoyUyOg2',
      name: 'Avançado',
      mensal: 900,
      anual: 9000,
      features: ['Até 3.000 mensagens/mês', 'Até 500 contatos em campanhas', 'Suporte VIP / Setup Auxiliado'],
      color: 'from-white-500 to-white-400',
    },
  ];

  const handleCheckout = async (productId: string) => {
    setLoadingPlan(productId);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/stripe/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          productId,
          interval: 'month',
          origin: window.location.origin,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao gerar sessão de pagamento.');
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      toast.error('Erro ao redirecionar para pagamento: ' + (e as Error).message);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-6xl mx-auto p-4 tablet:p-8 flex flex-col items-center min-h-screen py-16"
      >
        <div className="text-center mb-10 max-w-2xl mx-auto pt-10">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-4xl tablet:text-5xl font-bold text-white mb-4 tracking-tight">
            Limite Alcançado
          </h1>
          <p className="text-lg text-gray-400 text-balance">
            {reason} Faça o upgrade e desbloqueie o real poder de automação para o seu time!
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full max-w-4xl mx-auto">
          {plans.map((plan) => {
            const price = plan.mensal;
            const subtitle = 'Cobrado mensalmente';

            return (
              <motion.div
                key={plan.id}
                className={`relative py-10 flex flex-col p-5 rounded-2xl border transition-all duration-300 ${plan.popular
                  ? 'border-blue-500/50 bg-blue-950/20 shadow-[0_0_40px_-15px_rgba(99,102,241,0.3)]'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-blue-500 to-blue-500 rounded-full flex items-center gap-1 shadow-lg">
                    <Sparkles className="w-3 h-3 text-white" />
                    <span className="text-[10px] font-bold text-white tracking-wide uppercase font-inter">Recomendado</span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-gray-400 text-base font-medium">R$</span>
                    <span className="text-3xl font-black text-white tracking-tight">{price}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-medium">{subtitle}</p>
                </div>

                <div className="flex-1">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${plan.color}`}>
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                        <span className="text-sm text-gray-300 font-medium leading-relaxed">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={loadingPlan === plan.id}
                  className={`w-full cursor-pointer py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${plan.popular
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/25'
                    : 'bg-white text-black hover:bg-gray-100'
                    } ${loadingPlan === plan.id ? 'opacity-80 cursor-wait' : ''}`}
                >
                  {loadingPlan === plan.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
                  ) : (
                    'Assinar Agora'
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-12 text-center text-sm text-gray-500 font-medium text-balance">
          Pagamento seguro via Stripe. Cancele a qualquer momento pagando no cartão de crédito. Boleto e Pix não são suportados.
        </div>
      </motion.div>
    </div>
  );
}
