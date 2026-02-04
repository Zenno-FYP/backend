import { Injectable, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FirebaseService } from '../../firebase/firebase.service';
import { User } from '../user/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private firebaseService: FirebaseService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, name, profilePhoto } = registerDto;

    try {
      // Check if user already exists in MongoDB
      const existingUser = await this.userModel.findOne({ email });
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }

      // Create user in Firebase
      console.log('Creating Firebase user...');
      const firebaseUser = await this.firebaseService.createUser(email, password, name);
      console.log('Firebase user created:', firebaseUser.uid);

      // Create user in MongoDB
      console.log('Creating MongoDB user...');
      const newUser = new this.userModel({
        uid: firebaseUser.uid,
        email,
        name,
        profilePhoto: profilePhoto || null,
      });

      await newUser.save();
      console.log('MongoDB user created');

      // Get Access Token
      console.log('Getting access token...');
      const accessToken = await this.getIdToken(email, password);
      console.log('Access token obtained');

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || email,
        name: firebaseUser.displayName || name,
        userName: newUser.email.split('@')[0],
        accessToken,
        profilePhoto: newUser.profilePhoto,
        role: newUser.role,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      };
    } catch (error) {
      console.error('Registration error:', error);
      // If user created in Firebase but not in MongoDB, delete from Firebase
      if (error.code === 'auth/email-already-exists') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    try {
      const accessToken = await this.getIdToken(email, password);
      const decodedToken = await this.firebaseService.verifyToken(accessToken);

      // Update login timestamp
      const user = await this.userModel.findOneAndUpdate(
        { uid: decodedToken.uid },
        {},
        { new: true },
      );

      if (!user) {
        throw new BadRequestException('User not found');
      }

      return {
        uid: decodedToken.uid,
        email: decodedToken.email || user.email,
        name: decodedToken.name || user.name,
        userName: user.email.split('@')[0],
        accessToken,
        profilePhoto: user.profilePhoto,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new UnauthorizedException('Invalid email or password');
      }
      throw error;
    }
  }

  async getCurrentUser(uid: string) {
    const user = await this.userModel.findOne({ uid });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  async logout(uid: string) {
    try {
      // Revoke all tokens for this user via Firebase Admin SDK
      await this.firebaseService.revokeTokens(uid);

      // Update MongoDB record
      const user = await this.userModel.findOneAndUpdate(
        { uid },
        {},
        { new: true },
      );

      if (!user) {
        throw new BadRequestException('User not found');
      }

      return {
        message: 'Logout successful - all tokens revoked',
        email: user.email,
      };
    } catch (error) {
      throw new BadRequestException('Logout failed: ' + error.message);
    }
  }

  private async getIdToken(email: string, password: string): Promise<string> {
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Firebase Auth Error:', data);
        throw new UnauthorizedException('Invalid email or password');
      }

      return data.idToken;
    } catch (error) {
      console.error('GetIdToken Error:', error);
      throw new UnauthorizedException('Authentication failed: ' + error.message);
    }
  }
}
