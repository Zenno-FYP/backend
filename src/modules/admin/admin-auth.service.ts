import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'zenno_admin_token';

export interface AdminJwtPayload {
  sub: 'admin';
  typ: 'admin';
}

@Injectable()
export class AdminAuthService {
  private requireJwtSecret(): string {
    const s = process.env.ADMIN_JWT_SECRET;
    if (!s || s.length < 16) {
      throw new UnauthorizedException({
        code: 'ADMIN_AUTH_NOT_CONFIGURED',
        message: 'Admin JWT secret missing or too short (set ADMIN_JWT_SECRET)',
      });
    }
    return s;
  }

  static cookieName(): string {
    return COOKIE_NAME;
  }

  verifyPassword(email: string, password: string): boolean {
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!adminEmail || email.trim().toLowerCase() !== adminEmail) {
      return false;
    }

    const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
    const plain = process.env.ADMIN_PASSWORD?.trim();

    if (hash) {
      return bcrypt.compareSync(password, hash);
    }
    if (plain) {
      try {
        const a = Buffer.from(password, 'utf8');
        const b = Buffer.from(plain, 'utf8');
        if (a.length !== b.length) {
          return false;
        }
        return timingSafeEqual(a, b);
      } catch {
        return false;
      }
    }
    return false;
  }

  issueToken(): string {
    const payload: AdminJwtPayload = { sub: 'admin', typ: 'admin' };
    return jwt.sign(payload, this.requireJwtSecret(), { expiresIn: '7d' });
  }

  verifyToken(token: string): AdminJwtPayload {
    try {
      const decoded = jwt.verify(token, this.requireJwtSecret()) as jwt.JwtPayload & Partial<AdminJwtPayload>;
      if (decoded.sub !== 'admin' || decoded.typ !== 'admin') {
        throw new UnauthorizedException({ code: 'ADMIN_TOKEN_INVALID', message: 'Invalid admin token' });
      }
      return { sub: 'admin', typ: 'admin' };
    } catch {
      throw new UnauthorizedException({ code: 'ADMIN_TOKEN_INVALID', message: 'Invalid or expired admin token' });
    }
  }

  extractTokenFromRequest(headers: { authorization?: string }, cookies?: Record<string, string>): string | null {
    const auth = headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const t = auth.slice(7).trim();
      if (t) {
        return t;
      }
    }
    const c = cookies?.[COOKIE_NAME];
    return c || null;
  }
}
