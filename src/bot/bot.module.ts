import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { VoiceModule } from '../voice/voice.module';

@Module({
  imports: [VoiceModule],
  providers: [BotService],
})
export class BotModule {}
