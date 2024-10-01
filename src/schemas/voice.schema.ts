import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// export type VoiceDocument = Voice & Document;

@Schema()
export class Voice extends Document {
  @Prop({ required: true, unique: true })
  fileId: string;

  @Prop({ required: true })
  title: string;
}

export const VoiceSchema = SchemaFactory.createForClass(Voice);
