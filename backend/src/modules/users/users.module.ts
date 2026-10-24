import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { USERS_REPOSITORY } from './users.repository';
import { MemoryUsersRepository } from './memory-users.repository';
import { ExchangePersistenceModule } from '../exchanges/exchange-persistence.module';
import { CareersModule } from '../careers/careers.module';

@Module({
  imports: [ExchangePersistenceModule, CareersModule],
  providers: [
    UsersService,
    { provide: USERS_REPOSITORY, useClass: MemoryUsersRepository },
  ],
  exports: [UsersService, USERS_REPOSITORY],
})
export class UsersModule {}
