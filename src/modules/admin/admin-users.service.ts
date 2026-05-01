import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  isVerified: boolean;
  role: string;
  activity_sync_at: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AdminUsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  async listUsers(params: {
    page: number;
    limit: number;
    verified?: 'all' | 'true' | 'false';
  }) {
    const page = Math.max(1, params.page);
    const limit = Math.min(100, Math.max(1, params.limit));
    const filter: Record<string, unknown> = {};
    if (params.verified === 'true') {
      filter.isVerified = true;
    } else if (params.verified === 'false') {
      filter.isVerified = false;
    }

    const [rows, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('email name isVerified role activity_sync_at createdAt updatedAt')
        .sort({ activity_sync_at: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(filter),
    ]);

    const items: AdminUserRow[] = rows.map((u: any) => ({
      id: u._id.toString(),
      email: u.email,
      name: u.name,
      isVerified: !!u.isVerified,
      role: u.role ?? 'user',
      activity_sync_at: u.activity_sync_at ?? null,
      createdAt: (u.createdAt as Date)?.toISOString?.() ?? '',
      updatedAt: (u.updatedAt as Date)?.toISOString?.() ?? '',
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
