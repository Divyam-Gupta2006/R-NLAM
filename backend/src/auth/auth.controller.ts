import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string }) {
    return this.authService.login(body.email || 'admin@rnlam.gov.in');
  }

  @Get('me')
  async me(@Query('email') email?: string) {
    return this.authService.validateUser(email || 'admin@rnlam.gov.in');
  }
}
