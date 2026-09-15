import { Module, Global } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RolesGuard } from './roles.guard';
import { KeycloakVerifierService } from './keycloak-verifier.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, RolesGuard, KeycloakVerifierService],
  exports: [AuthService, RolesGuard, KeycloakVerifierService],
})
export class AuthModule {}
