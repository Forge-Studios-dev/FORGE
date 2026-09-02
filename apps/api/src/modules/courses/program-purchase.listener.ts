import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CreatorProgramsService } from './creator-programs.service';

export type ProgramPurchaseCompletedEvent = {
  userId: string;
  programId: string;
  amountCents: number;
  currency?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
};

export type ProgramPurchaseRevokedEvent = {
  userId?: string;
  programId?: string;
  paymentIntentId?: string;
};

@Injectable()
export class ProgramPurchaseListener {
  constructor(private readonly programsService: CreatorProgramsService) {}

  @OnEvent('program.purchase.completed')
  async onPurchaseCompleted(payload: ProgramPurchaseCompletedEvent) {
    await this.programsService.fulfillPaidPurchase(payload);
  }

  @OnEvent('program.purchase.revoked')
  async onPurchaseRevoked(payload: ProgramPurchaseRevokedEvent) {
    await this.programsService.revokePaidPurchaseByPaymentIntent(payload.paymentIntentId);
  }
}
