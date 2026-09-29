import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { DevTokenService } from './dev-token.service';
import { KeycloakVerifierService } from './keycloak-verifier.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, DevTokenService, KeycloakVerifierService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService, DevTokenService],
})
export class AuthModule {}
