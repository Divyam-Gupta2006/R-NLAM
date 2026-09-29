import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { authMode } from './auth/auth.types';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { installBigIntJson } from './common/money';

export async function createApp() {
  installBigIntJson();
  if (authMode() === 'dev' && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_MODE=dev is not allowed with NODE_ENV=production');
  }
  const app = await NestFactory.create(AppModule, { logger: process.env.JEST_WORKER_ID ? ['error', 'warn'] : ['error', 'warn', 'log'] });
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: false,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}

export function buildOpenApi(app: Awaited<ReturnType<typeof createApp>>) {
  const config = new DocumentBuilder()
    .setTitle('R-NLAM API')
    .setDescription(
      'Real-Time National Land Acquisition & Management System. All routes need a Bearer token unless marked public. ' +
        'In AUTH_MODE=dev, get one from POST /api/auth/dev-login. Money is integer paise; dates are UTC.',
    )
    .setVersion('2.0.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await createApp();
  SwaggerModule.setup('api/docs', app, buildOpenApi(app));
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  logger.log(`R-NLAM API on http://localhost:${port}/api (auth: ${authMode()}), docs at /api/docs`);
}

if (require.main === module) {
  void bootstrap();
}
