import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
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
  ) {}
  @Post('register')
  @ApiCreatedResponse({
    type: PublicUser,
    description:
      'Estudiante @ucb.edu.bo con bono configurable (demo: 8 creditos); usuario y movimiento atomicos',
  })
  @ApiConflictResponse({ description: 'Correo no disponible' })
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponse })
  @ApiUnauthorizedResponse()
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
