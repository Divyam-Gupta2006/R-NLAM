import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface PaymentInstruction {
  compensationId: string;
  beneficiaryName: string;
  amountPaise: bigint;
  accountLast4: string | null;
}

export interface PaymentResult {
  status: 'SUCCESS' | 'FAILED';
  utrNumber: string;
  gateway: string;
  message: string;
}

/**
 * Money never moves inside R-NLAM: disbursement is PFMS / State Treasury's job.
 * R-NLAM sends the instruction and records the returned UTR.
 */
export interface PaymentGateway {
  readonly name: string;
  readonly synthetic: boolean;
  disburse(instruction: PaymentInstruction): Promise<PaymentResult>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/**
 * SYNTHETIC PFMS adapter for demos. UTRs are prefixed "SYN" so no reference
 * can be mistaken for a real treasury transaction. Accounts ending 0000 fail,
 * to demonstrate the failed-payment path.
 */
@Injectable()
export class SyntheticPfmsGateway implements PaymentGateway {
  readonly name = 'PFMS_SYNTHETIC';
  readonly synthetic = true;

  async disburse(instruction: PaymentInstruction): Promise<PaymentResult> {
    const utrNumber = `SYN${Date.now().toString().slice(-9)}${crypto.randomInt(1000, 9999)}`;
    if (instruction.accountLast4 === '0000') {
      return { status: 'FAILED', utrNumber, gateway: this.name, message: 'Synthetic failure: account closed (demo)' };
    }
    return { status: 'SUCCESS', utrNumber, gateway: this.name, message: 'Synthetic credit confirmation' };
  }
}
