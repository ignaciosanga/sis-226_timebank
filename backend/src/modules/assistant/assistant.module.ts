import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ExchangesModule } from '../exchanges/exchanges.module';
import { SkillsModule } from '../skills/skills.module';
import { TutoringModule } from '../tutoring/tutoring.module';
import { UserSkillsModule } from '../user-skills/user-skills.module';
import { AssistantController } from './assistant.controller';
import { AssistantProfileStore } from './assistant-profile.store';
import { AssistantService } from './assistant.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ExchangesModule,
    SkillsModule,
    TutoringModule,
    UserSkillsModule,
  ],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantProfileStore],
})
export class AssistantModule {}
