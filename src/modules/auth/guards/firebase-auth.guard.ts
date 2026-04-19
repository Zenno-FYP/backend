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

      // Defense-in-depth: reject password-provider tokens whose email has
      // not yet been verified. The mobile/web clients already gate this
      // client-side, but a tampered or out-of-date client could still send
      // an unverified password token. Federated providers (google.com,
      // github.com, apple.com, etc.) get a free pass because the IdP has
      // already verified the email.
      const signInProvider: string | undefined =
        decodedToken?.firebase?.sign_in_provider;
      if (
        signInProvider === 'password' &&
        decodedToken?.email_verified === false
      ) {
        this.logger.warn(
          `Rejecting unverified password token for ${request.method} ${request.url} (uid=${decodedToken?.uid ?? 'unknown'})`,
        );
        throw new UnauthorizedException({
          code: 'AUTH_EMAIL_NOT_VERIFIED',
          message: 'Email is not verified',
        });
      }

      request.user = decodedToken;
      return true;
    } catch (error: any) {
      // Re-throw the email-not-verified case so the response code propagates.
      if (
        error instanceof UnauthorizedException &&
        (error.getResponse() as { code?: string })?.code ===
          'AUTH_EMAIL_NOT_VERIFIED'
      ) {
        throw error;
      }
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
