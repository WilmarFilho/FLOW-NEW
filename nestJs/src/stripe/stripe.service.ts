import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StripeService {
  private readonly stripe: any;
  private readonly logger = new Logger(StripeService.name);

  // Mapping plans according to the User request
  private readonly PLANS: Record<string, any> = {
    'prod_TtWwXIpxANb0GU': { id: 'iniciante', name: 'Iniciante', priceMensal: 400, priceAnual: 4000, maxMessages: 1200, maxContacts: 200 },
    'prod_TtWx8O8eVpJuAt': { id: 'intermediario', name: 'Intermediário', priceMensal: 700, priceAnual: 7000, maxMessages: 1800, maxContacts: 300 },
    'prod_TtWwDnPoyUyOg2': { id: 'avancado', name: 'Avançado', priceMensal: 900, priceAnual: 9000, maxMessages: 3000, maxContacts: 500 },
  };

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {
    const key = this.configService.get<string>('STRIPE_SECRET_KEY') || process.env.STRIPE_SECRET_KEY;
    this.stripe = new Stripe(
      key as string,
      { apiVersion: '2023-10-16' } as any,
    );
  }

  async createCheckoutSession(profileId: string, productId: string, interval: 'month' | 'year', origin: string) {
    const planConfig = this.PLANS[productId];
    if (!planConfig) {
      throw new Error(`Invalid Product ID: ${productId}`);
    }

    // Retrieve or create customer
    const supers = this.supabaseService.getClient();
    const { data: sub } = await supers
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('profile_id', profileId)
      .single();

    let customerId = sub?.stripe_customer_id;
    if (!customerId) {
      const { data: profile } = await supers
        .from('profile')
        .select('nome_completo')
        .eq('auth_id', profileId)
        .single();

      const customer = await this.stripe.customers.create({
        name: profile?.nome_completo || 'Customer',
        metadata: { profile_id: profileId },
      });
      customerId = customer.id;

      await supers
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('profile_id', profileId);
    }

    const unitAmount = interval === 'year' ? planConfig.priceAnual * 100 : planConfig.priceMensal * 100;

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product: productId,
            unit_amount: unitAmount,
            recurring: {
              interval: interval,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/dashboard?success=true`,
      cancel_url: `${origin}/configuracoes?canceled=true`,
      metadata: { profile_id: profileId, productId },
    });

    return { url: session.url };
  }

  async createPortalSession(profileId: string, origin: string) {
    const supers = this.supabaseService.getClient();
    const { data: sub } = await supers
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('profile_id', profileId)
      .single();

    if (!sub?.stripe_customer_id) {
      throw new Error('Nenhum customer id encontrado');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/configuracoes`,
    });

    return { url: session.url };
  }

  async constructEventFromPayload(signature: string, payload: Buffer) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || process.env.STRIPE_WEBHOOK_SECRET;
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret as string);
  }

  async handlePaymentSucceeded(invoice: any) {
    const customerId = invoice.customer as string;
    const subscriptionId = invoice.subscription as string;

    // Retrieve subscription from Stripe to get the product
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const productId = subscription.items.data[0].price.product as string;

    const configuredPlan: Record<string, any> = this.PLANS;
    const planConfig = Object.values(configuredPlan).find(p => p.maxMessages === configuredPlan[productId]?.maxMessages) || configuredPlan[productId];

    if (planConfig) {
      const supers = this.supabaseService.getClient();
      // Update usage and limits
      await supers
        .from('subscriptions')
        .update({
          plano: planConfig.id,
          limite_mensagens_mensais: planConfig.maxMessages,
          limite_contatos_campanhas: planConfig.maxContacts,
          mensagens_enviadas: 0,
          contatos_usados_campanhas: 0,
          stripe_subscription_id: subscriptionId,
          stripe_status: 'active',
          data_proxima_renovacao: new Date(subscription.current_period_end * 1000).toISOString()
        })
        .eq('stripe_customer_id', customerId);


    }
  }

  async handlePaymentFailed(invoice: any) {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return;

    try {
      // Configurar a assinatura para cancelar daqui a 7 dias exatos.
      const cancelAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);

      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at: cancelAt,
      });

    } catch (e) {
      this.logger.error(`Erro ao atualizar cancelamento: ${e.message}`);
    }
  }

  async handleSubscriptionDeleted(subscription: any) {
    const customerId = subscription.customer as string;
    const supers = this.supabaseService.getClient();

    // Reverter para Freemium
    await supers
      .from('subscriptions')
      .update({
        plano: 'freemium',
        limite_mensagens_mensais: 500,
        limite_contatos_campanhas: 100,
        mensagens_enviadas: 0,
        contatos_usados_campanhas: 0,
        stripe_subscription_id: null,
        stripe_status: 'canceled'
      })
      .eq('stripe_customer_id', customerId);
  }
}

