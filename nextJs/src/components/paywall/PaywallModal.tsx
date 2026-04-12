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
  const [interval, setIntervalState] = useState<'month' | 'year'>('month');

  const plans = [
    {
      id: 'prod_TtWwXIpxANb0GU',
      name: 'Iniciante',
      mensal: 400,
      anual: 4000, // Equivale a 333/mês
      features: ['Até 1.200 mensagens/mês', 'Até 200 contatos em campanhas', 'Inteligência Artificial Base', '2 Conexões WhatsApp', 'Suporte Padrão'],
      color: 'from-blue-500 to-cyan-400',
    },
    {
      id: 'prod_TtWx8O8eVpJuAt',
      name: 'Intermediário',
      mensal: 700,
      anual: 7000, 
      features: ['Até 1.800 mensagens/mês', 'Até 300 contatos em campanhas', 'I.A Aprimorada', '5 Conexões WhatsApp', 'Suporte Prioritário'],
      popular: true,
      color: 'from-indigo-500 to-purple-500',
    },
    {
      id: 'prod_TtWwDnPoyUyOg2',
      name: 'Avançado',
      mensal: 900,
      anual: 9000, 
      features: ['Até 3.000 mensagens/mês', 'Até 500 contatos em campanhas', 'Tudo do Intermediário', '10 Conexões WhatsApp', 'Suporte VIP / Setup Auxiliado'],
      color: 'from-fuchsia-500 to-pink-500',
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
          interval,
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
          <p className="text-lg text-gray-400">
            {reason} Faça o upgrade e desbloqueie o real poder de automação para o seu time!
          </p>
          
          <div className="mt-8 inline-flex items-center p-1 bg-white/5 border border-white/10 rounded-full">
            <button
              onClick={() => setIntervalState('month')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                interval === 'month' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setIntervalState('year')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                interval === 'year' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              Anual <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 uppercase tracking-widest border border-green-500/30">Ganhe 2 Meses</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 tablet:grid-cols-3 gap-6 w-full max-w-5xl mx-auto">
          {plans.map((plan) => {
            const price = interval === 'month' ? plan.mensal : plan.anual;
            const subtitle = interval === 'year' ? `R$ ${(plan.anual / 12).toFixed(2)}/mês cobrado anualmente` : 'Cobrado mensalmente';
            
            return (
              <motion.div
                key={plan.id}
                whileHover={{ y: -8 }}
                className={`relative flex flex-col p-8 rounded-3xl border transition-all duration-300 ${
                  plan.popular 
                    ? 'border-indigo-500/50 bg-indigo-950/20 shadow-[0_0_40px_-15px_rgba(99,102,241,0.3)]' 
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center gap-1.5 shadow-lg">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                    <span className="text-xs font-bold text-white tracking-wide uppercase font-inter">Recomendado</span>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-gray-400 text-lg font-medium">R$</span>
                    <span className="text-5xl font-black text-white tracking-tight">{price}</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2 font-medium">{subtitle}</p>
                </div>

                <div className="flex-1">
                  <ul className="space-y-4 mb-8">
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
                  className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/25'
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
        
        <div className="mt-12 text-center text-sm text-gray-500 font-medium">
          Pagamento seguro via Stripe. Cancele a qualquer momento pagando no cartão de crédito. <br/> Boleto e Pix não são suportados.
        </div>
      </motion.div>
    </div>
  );
}
