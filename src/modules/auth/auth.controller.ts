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
import { LoginDto } from './dto/login.dto';
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
  constructor(private readonly auth: AuthService) {}
  @Post('register')
  @ApiCreatedResponse({
    type: PublicUser,
    description:
      'Usuario Estudiante con saldo inicial cero en el almacenamiento configurado',
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
}
