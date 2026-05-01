import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../user/schemas/user.schema';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const email = (req.user?.email ?? '').toLowerCase().trim();
    if (!email) {
      throw new UnauthorizedException({ code: 'AUTH_MISSING', message: 'Missing firebase user email' });
    }

    const user = await this.userModel.findOne({ email }).select('isAdmin').lean();
    if (!user?.isAdmin) {
      throw new ForbiddenException({ code: 'ADMIN_FORBIDDEN', message: 'Admin access required' });
    }

    return true;
  }
}
