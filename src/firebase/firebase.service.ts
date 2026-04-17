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

      // Check if the private key is Base64 encoded (doesn't start with '-----BEGIN')
      if (!privateKey.startsWith('-----BEGIN')) {
        // Decode from Base64
        privateKey = Buffer.from(privateKey, 'base64').toString('utf-8');
        this.logger.log('Firebase private key decoded from Base64');
      } else {
        // Fallback: handle escaped newlines for standard format
        privateKey = privateKey.replace(/\\n/g, '\n');
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
}
