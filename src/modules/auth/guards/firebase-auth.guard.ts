import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { FirebaseService } from '../../../firebase/firebase.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(private firebaseService: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException({
        code: 'AUTH_MISSING',
        message: 'Missing authorization header',
      });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_MALFORMED',
        message: 'Malformed authorization header',
      });
    }

    try {
      const decodedToken = await this.firebaseService.verifyToken(token);
      request.user = decodedToken;
      return true;
    } catch (error: any) {
      const firebaseCode: string = error?.code ?? error?.errorInfo?.code ?? '';
      if (firebaseCode.includes('expired')) {
        this.logger.warn(`Token expired for request ${request.method} ${request.url}`);
        throw new UnauthorizedException({
          code: 'AUTH_TOKEN_EXPIRED',
          message: 'Firebase token has expired',
        });
      }
      this.logger.warn(`Token invalid for request ${request.method} ${request.url}: ${firebaseCode || error?.message}`);
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Invalid firebase token',
      });
    }
  }
}
