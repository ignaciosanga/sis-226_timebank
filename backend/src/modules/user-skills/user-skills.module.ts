import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExchangePersistenceModule } from '../exchanges/exchange-persistence.module';
import { SkillsModule } from '../skills/skills.module';
import { MemoryUserSkillsRepository } from './memory-user-skills.repository';
import { UserSkillsController } from './user-skills.controller';
import { USER_SKILLS_REPOSITORY } from './user-skills.repository';
import { UserSkillsService } from './user-skills.service';

@Module({
  imports: [AuthModule, SkillsModule, ExchangePersistenceModule],
  controllers: [UserSkillsController],
  providers: [
    UserSkillsService,
    { provide: USER_SKILLS_REPOSITORY, useClass: MemoryUserSkillsRepository },
  ],
  exports: [UserSkillsService],
})
export class UserSkillsModule {}
