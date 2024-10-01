import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Voice } from '../schemas/voice.schema';

@Injectable()
export class VoiceService {
  constructor(
    @InjectModel(Voice.name) private readonly voiceModel: Model<Voice>,
  ) {}

  async addVoice(fileId: string, title: string) {
    const voice = { fileId, title };
    const newVoice = new this.voiceModel(voice);
    await newVoice.save();
    return voice;
  }

  async searchVoices(query: string) {
    return this.voiceModel
      .find({
        title: { $regex: query, $options: 'i' },
      })
      .limit(50)
      .exec();
  }
}
