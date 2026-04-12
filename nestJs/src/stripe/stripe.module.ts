import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { ResetUsageService } from './reset-usage.service';

@Module({
  providers: [StripeService, ResetUsageService],
  controllers: [StripeController],
  exports: [StripeService],
})
export class StripeModule {}
