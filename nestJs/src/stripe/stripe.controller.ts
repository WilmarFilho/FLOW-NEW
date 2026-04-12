import { Controller, Post, Body, Req, Res, Headers } from '@nestjs/common';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private stripeService: StripeService) {}

  @Post('/checkout-session')
  async createCheckoutSession(
    @Body() body: { profileId: string; productId: string; interval: 'month' | 'year'; origin: string },
    @Res() res: any
  ) {
    try {
      const result = await this.stripeService.createCheckoutSession(
        body.profileId,
        body.productId,
        body.interval,
        body.origin || 'https://flow.nkwflow.com'
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  @Post('/customer-portal')
  async createCustomerPortal(
    @Body() body: { profileId: string; origin: string },
    @Res() res: any
  ) {
    try {
      const result = await this.stripeService.createPortalSession(
        body.profileId,
        body.origin || 'https://flow.nkwflow.com'
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  @Post('/webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: any,
    @Res() res: any
  ) {
    if (!signature) {
      return res.status(400).send('Missing signature');
    }

    if (!req.rawBody) {
      return res.status(400).send('Missing raw body. Ensure rawBody is enabled in NestFactory.');
    }

    try {
      const event = await this.stripeService.constructEventFromPayload(signature, req.rawBody);

      switch (event.type) {
        case 'invoice.payment_succeeded':
          await this.stripeService.handlePaymentSucceeded(event.data.object as any);
          break;
        case 'invoice.payment_failed':
          await this.stripeService.handlePaymentFailed(event.data.object as any);
          break;
        case 'customer.subscription.deleted':
          await this.stripeService.handleSubscriptionDeleted(event.data.object as any);
          break;
        default:
          break;
      }

      res.status(200).send();
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
}
