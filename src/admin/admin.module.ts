import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Admins, AdminsSchema } from '../schemas/admins.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Admins.name, schema: AdminsSchema }]),
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
