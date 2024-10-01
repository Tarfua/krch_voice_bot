import { Prop, Schema } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Admins extends Document {
  @Prop({ required: true, unique: true })
  telegramId: number;

  @Prop()
  username: string;
}
