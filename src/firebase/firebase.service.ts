import * as admin from 'firebase-admin';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private auth: admin.auth.Auth;
  private readonly logger = new Logger(FirebaseService.name);

  onModuleInit() {
    try {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      this.logger.log(`Initializing Firebase with project: ${projectId}`);

      if (!privateKey || !projectId || !clientEmail) {
        this.logger.error('Missing Firebase credentials in environment variables');
        throw new Error('Missing Firebase credentials');
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

  getAuth(): admin.auth.Auth {
    return this.auth;
  }

  async verifyToken(token: string): Promise<admin.auth.DecodedIdToken> {
    return this.auth.verifyIdToken(token);
  }

  async createUser(email: string, password: string, displayName: string) {
    this.logger.log(`Creating user: ${email}`);
    return this.auth.createUser({
      email,
      password,
      displayName,
    });
  }

  async updateUser(uid: string, data: admin.auth.UpdateRequest) {
    return this.auth.updateUser(uid, data);
  }

  async deleteUser(uid: string) {
    return this.auth.deleteUser(uid);
  }

  async getUserByEmail(email: string) {
    return this.auth.getUserByEmail(email);
  }

  async getUserByUid(uid: string) {
    return this.auth.getUser(uid);
  }

  async revokeTokens(uid: string) {
    this.logger.log(`Revoking tokens for user: ${uid}`);
    return this.auth.revokeRefreshTokens(uid);
  }
}
