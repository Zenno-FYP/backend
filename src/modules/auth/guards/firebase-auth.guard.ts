import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseService } from '../../../firebase/firebase.service';
import { ALLOW_UNVERIFIED_KEY } from '../decorators/allow-unverified.decorator';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private firebaseService: FirebaseService,
    private reflector: Reflector,
  ) {}

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

      // Defense-in-depth: reject password-provider tokens whose email has not
      // yet been verified. Federated providers (google.com, github.com, etc.)
      // are exempt because the IdP has already verified the email.
      //
      // Exception: routes decorated with @AllowUnverified() are permitted to
      // receive unverified tokens. This is intentionally narrow — only
      // PUT /user/me (initial profile creation) carries that decorator, so a
      // brand-new user can create their MongoDB record before verifying email.
      const signInProvider: string | undefined =
        decodedToken?.firebase?.sign_in_provider;

      if (
        signInProvider === 'password' &&
        decodedToken?.email_verified === false
      ) {
        const allowUnverified = this.reflector.getAllAndOverride<boolean>(
          ALLOW_UNVERIFIED_KEY,
          [context.getHandler(), context.getClass()],
        );

        if (!allowUnverified) {
          this.logger.warn(
            `Rejecting unverified password token for ${request.method} ${request.url} (uid=${decodedToken?.uid ?? 'unknown'})`,
          );
          throw new UnauthorizedException({
            code: 'AUTH_EMAIL_NOT_VERIFIED',
            message: 'Email is not verified',
          });
        }

        this.logger.debug(
          `Allowing unverified token on @AllowUnverified route ${request.method} ${request.url}`,
        );
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
