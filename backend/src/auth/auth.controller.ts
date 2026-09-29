import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { AuthService } from './auth.service';
import { authMode, AuthUser } from './auth.types';
import { CurrentUser, Public } from './decorators';

class DevLoginDto {
  @ApiProperty({ example: 'collector.nagpur@demo.rnlam.in' })
  @IsEmail()
  email: string;
}

class OtpRequestDto {
  @ApiProperty({ example: '9800000001', description: '10-digit Indian mobile number' })
  @Matches(/^[6-9]\d{9}$/)
  phone: string;
}

class OtpVerifyDto {
  @ApiProperty()
  @IsString()
  requestId: string;

  @ApiProperty({ example: '123456' })
  @Length(6, 6)
  code: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('mode')
  @ApiOperation({ summary: 'Which auth mode the server runs in (dev or keycloak)' })
  mode() {
    return { mode: authMode() };
  }

  @Public()
  @Get('personas')
  @ApiOperation({ summary: 'DEV ONLY: demo users for the role switcher' })
  personas() {
    return this.auth.personas();
  }

  @Public()
  @Post('dev-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'DEV ONLY: issue a signed JWT for a demo user' })
  devLogin(@Body() dto: DevLoginDto) {
    return this.auth.devLogin(dto.email);
  }

  @Public()
  @Post('citizen/otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Citizen login step 1: request an OTP' })
  requestOtp(@Body() dto: OtpRequestDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Public()
  @Post('citizen/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Citizen login step 2: verify the OTP and receive a token' })
  verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyOtp(dto.requestId, dto.code);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'The authenticated caller' })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
