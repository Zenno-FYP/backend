import * as admin from 'firebase-admin';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private auth: admin.auth.Auth;
  private readonly logger = new Logger(FirebaseService.name);

  onModuleInit() {
    try {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      this.logger.log(`Initializing Firebase with project: ${projectId}`);

      if (!privateKey || !projectId || !clientEmail) {
        this.logger.error('Missing Firebase credentials in environment variables');
        throw new Error('Missing Firebase credentials');
      }

      // Aggressive cleanup:
      if (privateKey) {
        // Remove all whitespace (spaces, newlines, tabs)
        privateKey = privateKey.replace(/\s+/g, '');

        // Check if it's Base64 (doesn't start with '-----BEGIN')
        if (!privateKey.startsWith('-----BEGIN')) {
          // Decode from Base64
          privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
          this.logger.log('Firebase private key decoded from Base64');
        }

        // Remove any accidental wrapping quotes and fix double-escaped newlines
        privateKey = privateKey
          .replace(/^["']|["']$/g, '') // Remove quotes at start/end
          .replace(/\\n/g, '\n');      // Fix literal \n into real newlines
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey,
            clientEmail,
          }),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      }

      this.auth = admin.auth();
    } catch (error) {
      this.logger.error('Failed to initialize Firebase:', error);
      throw error;
    }
  }

  async verifyToken(token: string): Promise<admin.auth.DecodedIdToken> {
    return this.auth.verifyIdToken(token);
  }

  /** Short fingerprint for logs (full FCM tokens are secrets). */
  private tokenHint(token: string): string {
    if (!token?.length) return '(empty)';
    if (token.length <= 28) return `${token}…`;
    return `${token.slice(0, 14)}…${token.slice(-8)}`;
  }

  async sendMulticastPush(
    tokens: string[],
    notification: { title: string; body: string },
    data: Record<string, string>,
  ): Promise<{
    successCount: number;
    failedTokens: string[];
    /** Set when `sendEachForMulticast` throws before per-token results exist */
    multicastError?: string;
    /** One entry per failed token (same order as input tokens where applicable) */
    failureDetails?: Array<{ tokenHint: string; code: string; message: string }>;
  }> {
    if (!tokens.length) {
      return { successCount: 0, failedTokens: [] };
    }

    this.logger.log(`FCM sendMulticastPush: ${tokens.length} token(s)`);

    // Mirror the title/body into the data payload too. The mobile
    // foreground handler used to silently no-op when `RemoteMessage.notification`
    // came back null (some Android OEMs strip it for high-priority data
    // pushes); duplicating into `data` guarantees the local notification
    // can always render even in that edge case.
    const dataWithFallback: Record<string, string> = {
      ...data,
      title: notification.title,
      body: notification.body,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification,
        data: dataWithFallback,
        android: {
          priority: 'high',
          // Pin the channel id, sound and visibility on the Admin SDK side
          // so background pushes (which Android renders directly without the
          // app being awake) land on the same heads-up channel as the
          // in-app local notification — matching the channel created by
          // FcmService and registered in AndroidManifest.xml as
          // `com.google.firebase.messaging.default_notification_channel_id`.
          notification: {
            channelId: 'zenno_notifications',
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            priority: 'max',
            visibility: 'public',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              contentAvailable: true,
            },
          },
        },
        webpush: {
          headers: { Urgency: 'high' },
          notification: { icon: '/icon-192.png' },
        },
      });

      const failedTokens: string[] = [];
      const failureDetails: Array<{
        tokenHint: string;
        code: string;
        message: string;
      }> = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code ?? 'unknown';
          const hint = this.tokenHint(tokens[idx]);
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            failedTokens.push(tokens[idx]);
          }
          failureDetails.push({
            tokenHint: hint,
            code,
            message: resp.error?.message ?? 'n/a',
          });
          this.logger.warn(
            `FCM send failed token=${hint} code=${code} message=${resp.error?.message ?? 'n/a'}`,
          );
        }
      });

      this.logger.log(
        `FCM push sent: ${response.successCount}/${tokens.length} ok` +
          (failedTokens.length ? `, ${failedTokens.length} stale token(s) will be purged` : ''),
      );

      return {
        successCount: response.successCount,
        failedTokens,
        failureDetails:
          failureDetails.length > 0 ? failureDetails : undefined,
      };
    } catch (error) {
      const err = error as Error & { code?: string };
      const msg = err?.message ?? String(error);
      this.logger.error(
        `FCM multicast send threw: ${msg} code=${err?.code ?? 'n/a'}`,
        err?.stack,
      );
      return {
        successCount: 0,
        failedTokens: [],
        multicastError: msg,
      };
    }
  }
}
