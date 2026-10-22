import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PublicUser } from './user.types';
import { UsersService } from './users.service';

@ApiTags('Usuarios')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me')
  @ApiOkResponse({ type: PublicUser })
  me(@CurrentUser() user: PublicUser) {
    return this.users.me(user.id);
  }
  @Patch('me')
  @ApiOkResponse({ type: PublicUser })
  update(@CurrentUser() user: PublicUser, @Body() input: UpdateProfileDto) {
    return this.users.updateMe(user.id, input);
  }
}
