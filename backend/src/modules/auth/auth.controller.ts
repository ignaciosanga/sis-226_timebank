import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import { Throttle } from '@nestjs/throttler';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PublicUser } from '../users/user.types';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthService } from './google-auth.service';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';
import { renderVerificationPage } from './verification-page';

class RegistrationResponse extends PublicUser {
  @ApiProperty({
    example: true,
    description:
      'Cuenta Pendiente, saldo cero y sin sesion; revisar correo institucional',
  })
  verification_required!: boolean;
}

class VerificationResponse {
  @ApiProperty({ enum: ['verified'] }) status!: 'verified';
  @ApiProperty({ example: true }) login_required!: boolean;
}

class LoginResponse {
  @ApiProperty()
  access_token!: string;
  @ApiProperty({ enum: ['Bearer'] })
  token_type!: 'Bearer';
  @ApiProperty({ type: PublicUser })
  user!: PublicUser;
}

@ApiTags('Autenticación')
@ApiBadRequestResponse({
  description: 'DTO inválido o propiedades adicionales',
})
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly googleAuth: GoogleAuthService,
    private readonly verification: EmailVerificationService,
  ) {}
  @Post('register')
  @ApiCreatedResponse({
    type: RegistrationResponse,
    description:
      'Crea cuenta Pendiente sin bono. Envia enlace por correo; no devuelve token ni sesion. Si falla el transporte, usar resend-verification.',
  })
  @ApiConflictResponse({ description: 'Correo no disponible' })
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }
  @Post('verify-email')
  @HttpCode(200)
  @ApiOkResponse({
    type: VerificationResponse,
    description:
      'Consume el enlace y activa con bono una sola vez; reutilizarlo no entrega otra sesion ni bono',
  })
  confirmEmail(@Body() input: VerifyEmailDto) {
    return this.verification.confirm(input.token);
  }
  @Post('resend-verification')
  @HttpCode(202)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiAcceptedResponse({
    description:
      'Respuesta generica; rota enlaces pendientes, con espera de 60 segundos por cuenta',
  })
  resend(@Body() input: ResendVerificationDto) {
    return this.verification.resend(input.correo);
  }
  @Get('verify-email')
  @ApiOkResponse({
    description:
      'Pagina HTML de confirmacion explicita; GET no consume credenciales',
  })
  verificationPage(@Res() response: Response) {
    const nonce = randomBytes(18).toString('base64');
    response.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.type('html').send(renderVerificationPage(nonce));
  }
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponse })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({
    description:
      'Cuenta pendiente: code EMAIL_VERIFICATION_REQUIRED; confirmar correo antes de iniciar sesion',
  })
  login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }
  @Post('google')
  @HttpCode(200)
  @ApiOkResponse({
    description:
      'Sesión con una cuenta de Google @ucb.edu.bo verificada; si la cuenta no existe devuelve registration_required y se completa enviando idCarrera y semestre',
  })
  @ApiUnauthorizedResponse()
  loginWithGoogle(@Body() input: GoogleLoginDto) {
    return this.googleAuth.signIn(input);
  }
}
