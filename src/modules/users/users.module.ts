import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

// No se registra un repositorio ficticio. Vincular USERS_REPOSITORY tras recibir el esquema.
@Module({ providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
