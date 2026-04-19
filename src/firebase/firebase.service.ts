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

  async sendMulticastPush(
    tokens: string[],
    notification: { title: string; body: string },
    data: Record<string, string>,
  ): Promise<{ successCount: number; failedTokens: string[] }> {
    if (!tokens.length) {
      return { successCount: 0, failedTokens: [] };
    }

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification,
        data,
        android: { priority: 'high' },
        webpush: {
          headers: { Urgency: 'high' },
          notification: { icon: '/icon-192.png' },
        },
      });

      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            failedTokens.push(tokens[idx]);
          }
          this.logger.warn(`FCM send failed for token[${idx}]: ${resp.error?.message}`);
        }
      });

      return { successCount: response.successCount, failedTokens };
    } catch (error) {
      this.logger.error('FCM multicast send failed', error);
      return { successCount: 0, failedTokens: [] };
    }
  }
}
