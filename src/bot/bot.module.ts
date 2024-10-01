import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { VoiceModule } from '../voice/voice.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [VoiceModule, AdminModule],
  providers: [BotService],
})
export class BotModule {}
