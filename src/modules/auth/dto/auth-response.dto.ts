export class AuthResponseDto {
  uid: string;
  email?: string;
  name?: string;
  userName?: string;
  accessToken: string;
  profilePhoto?: string;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
