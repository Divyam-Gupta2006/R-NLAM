import { Injectable } from '@nestjs/common';

/**
 * Injectable "now". Demo mode can pin the clock (DEMO_NOW=2026-10-15T10:00:00+05:30)
 * so statutory countdowns and interest accrual tell the same story every time.
 */
@Injectable()
export class Clock {
  private pinned: Date | null = process.env.DEMO_NOW ? new Date(process.env.DEMO_NOW) : null;

  now(): Date {
    return this.pinned ? new Date(this.pinned) : new Date();
  }

  pin(at: Date | null): void {
    this.pinned = at;
  }

  isPinned(): boolean {
    return this.pinned !== null;
  }
}
