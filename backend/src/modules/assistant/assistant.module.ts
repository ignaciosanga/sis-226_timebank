import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
