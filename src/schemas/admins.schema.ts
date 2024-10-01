import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// export type AdminsDocument = Admins & Document;

@Schema()
export class Admins extends Document {
  @Prop({ required: true, unique: true })
  telegramId: number;

  @Prop()
  username: string;
}

export const AdminsSchema = SchemaFactory.createForClass(Admins);
