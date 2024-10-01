import { Module } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Voice, VoiceSchema } from '../schemas/voice.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Voice.name, schema: VoiceSchema }]),
  ],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
