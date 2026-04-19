import { SetMetadata } from '@nestjs/common';

/**
 * When applied to a controller method, tells FirebaseAuthGuard to skip the
 * email-verified check for email/password (password provider) tokens.
 *
 * Use only on endpoints that must be reachable before email verification —
 * specifically the initial profile-creation route (PUT /user/me).  All other
 * routes remain protected by the guard's email_verified enforcement.
 */
export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
