import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { seedDemo } from '../prisma/seed/demo';
import { PrismaService } from '../src/prisma/prisma.service';

/** Each e2e file starts from the same story, so files can run in any order. */
export async function resetDemo(app: INestApplication) {
  await seedDemo(app.get(PrismaService) as unknown as PrismaClient);
}
