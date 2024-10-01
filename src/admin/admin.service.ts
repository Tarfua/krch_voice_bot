import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Admins } from '../schemas/admins.schema';
import { Model } from 'mongoose';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admins.name) private readonly adminModel: Model<Admins>,
  ) {}

  addAdmin(id: number) {
    return this.adminModel.create({ telegramId: id });
  }

  getAdmin(id: number) {
    return this.adminModel.findOne({ telegramId: id });
  }

  async isAdmin(id: number): Promise<boolean> {
    const exists = await this.adminModel.exists({ telegramId: id });
    return exists !== null;
  }

  deleteAdmin(id: number) {
    return this.adminModel.deleteOne({ telegramId: id });
  }

  getAdmins() {
    return this.adminModel.find();
  }
}
