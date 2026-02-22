# Zenno Backend API Documentation

## Overview
Zenno is a production-ready NestJS backend application providing email/password authentication with Firebase and MongoDB for user management.

**Base URL:** `http://localhost:3000`  
**API Version:** `v1`  
**Documentation:** `http://localhost:3000/api/docs` (Swagger UI)

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

Tokens are obtained through the login endpoint and are valid for approximately 1 hour. After logout, tokens are immediately invalidated via a blacklist mechanism.

---

## Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Operation description",
  "data": { /* response data */ }
}
```

---

## Endpoints

### Authentication Module (`/api/v1/auth`)

#### 1. Register User

```
POST /api/v1/auth/register
Content-Type: multipart/form-data
```

Creates a new user account with email, password, and optional profile photo. Profile photos are automatically uploaded to Cloudinary and stored by email address for easy management.

**Request Body (Form Data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email address (must be unique) |
| `password` | string | Yes | Password (minimum 6 characters) |
| `name` | string | Yes | User full name |
| `profilePhoto` | file | No | Profile photo image file (jpg, png, etc.) |

**Example cURL Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -F "email=john@example.com" \
  -F "password=SecurePassword123!" \
  -F "name=John Doe" \
  -F "profilePhoto=@photo.jpg"
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "uid": "firebase-uid-12345",
    "email": "user@example.com",
    "name": "John Doe",
    "userName": "user",
    "accessToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMyJ9...",
    "profilePhoto": "https://res.cloudinary.com/drnnuwpmz/image/upload/v1/zenno/profile-photos/user@example.com",
    "role": "user",
    "createdAt": "2026-02-04T19:06:10.000Z",
    "updatedAt": "2026-02-04T19:06:10.000Z"
  }
}
```

**Status Codes:**
- `201` - User registered successfully
- `400` - Invalid credentials format
- `409` - Email already in use

**Notes:**
- Profile photo is optional. If provided, it will be uploaded to Cloudinary
- Photo filename uses the user's email as ID, so re-uploading a photo will overwrite the previous one
- Maximum file size depends on Cloudinary limits (typically 100MB)
- Supported formats: JPG, PNG, WebP, GIF, SVG, etc.

---

#### 2. Login User

```
POST /api/v1/auth/login
```

Authenticates a user and returns an access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "uid": "firebase-uid-12345",
    "email": "user@example.com",
    "name": "John Doe",
    "userName": "user",
    "accessToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMyJ9...",
    "profilePhoto": "https://example.com/photo.jpg",
    "role": "user",
    "createdAt": "2026-02-04T19:06:10.000Z",
    "updatedAt": "2026-02-04T19:06:10.000Z"
  }
}
```

**Status Codes:**
- `200` - Login successful
- `401` - Invalid email or password

---

#### 3. Logout User

```
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

Logs out the authenticated user and immediately invalidates their token. The token is added to a blacklist, preventing any further use of that token. All refresh tokens are also revoked via Firebase.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout successful",
  "data": {
    "message": "Logout successful - all tokens revoked",
    "email": "user@example.com"
  }
}
```

**Status Codes:**
- `200` - Logout successful, token revoked
- `401` - Unauthorized / Invalid or already revoked token
- `400` - User not found

**Notes:**
- Token is immediately added to a blacklist on logout
- Subsequent requests with the loggedout token will be rejected with 401 Unauthorized
- This prevents token misuse even if the token hasn't expired yet
- Firebase refresh tokens are also revoked to prevent token refresh

---

### User Module (`/api/v1/user`)

#### 4. Get User Profile

```
GET /api/v1/user/profile
Authorization: Bearer <access_token>
```

Retrieves the authenticated user's profile information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User profile retrieved",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "uid": "firebase-uid-12345",
    "name": "John Doe",
    "userName": "user",
    "email": "user@example.com",
    "profilePhoto": "https://example.com/photo.jpg",
    "role": "user",
    "createdAt": "2026-02-04T19:06:10.000Z",
    "updatedAt": "2026-02-04T19:06:10.000Z"
  }
}
```

**Status Codes:**
- `200` - Profile retrieved successfully
- `401` - Unauthorized / Invalid or revoked token
- `400` - User not found

---

## Data Models

### User Schema

```typescript
{
  _id: ObjectId;              // MongoDB ID
  uid: string;                // Firebase UID (unique)
  email: string;              // User email (unique)
  name: string;               // Full name
  userName: string;           // Username derived from email
  profilePhoto: string;       // Profile picture URL (optional)
  role: "user" | "admin";     // User role (default: "user")
  createdAt: Date;            // Auto-managed creation timestamp
  updatedAt: Date;            // Auto-managed update timestamp
}
```

### Authentication Response DTO

```typescript
{
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
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "BadRequest"
}
```

### Common Error Codes

| Code | Message | Reason |
|------|---------|--------|
| 400 | Bad Request | Invalid request format or missing required fields |
| 401 | Unauthorized | Missing, invalid, or revoked authentication token |
| 409 | Conflict | Email already registered |
| 500 | Internal Server Error | Server-side error |

---

## Security Features

### Token Management
- **Access Token**: JWT valid for ~1 hour
- **Token Blacklist**: Immediate invalidation on logout
- **Firebase Integration**: Server-side token verification and revocation

### Password Security
- Managed by Firebase Authentication
- Passwords never stored in application database
- Server-side password validation

### Authentication Guard
- All protected endpoints validated with `FirebaseAuthGuard`
- Token blacklist checked on every request
- Automatic 401 response for invalid/revoked tokens

---

## Usage Examples

### Register a New User (Without Profile Photo)

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -F "email=john@example.com" \
  -F "password=SecurePass123!" \
  -F "name=John Doe"
```

### Register a New User (With Profile Photo)

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -F "email=john@example.com" \
  -F "password=SecurePass123!" \
  -F "name=John Doe" \
  -F "profilePhoto=@/path/to/photo.jpg"
```

**Note:** When uploading a profile photo, the file will be automatically uploaded to Cloudinary and stored using the email address as the identifier. If the same email uploads a new photo later, it will automatically overwrite the previous one.

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### Get Profile (Protected)

```bash
curl -X GET http://localhost:3000/api/v1/user/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Logout

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Technology Stack

- **Framework**: NestJS v11
- **Language**: TypeScript
- **Database**: MongoDB Atlas
- **Authentication**: Firebase Admin SDK
- **Image Storage**: Cloudinary
- **File Upload**: Multer
- **Validation**: NestJS Validation Pipe with class-validator
- **Documentation**: Swagger/OpenAPI

---

## Environment Configuration

Required environment variables (see `.env`):

```
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration (Atlas)
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/database

# Firebase Admin SDK (Auth)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-auth-domain.firebaseapp.com

# Cloudinary (Image Upload)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Usernames are automatically derived from email address (part before @)
- Default user role is "user" on registration
- **Token Invalidation**: Tokens are immediately added to a blacklist on logout, preventing further use
- **Profile Photos**: Stored in Cloudinary with email-based identifiers for easy management and automatic overwrite
- Profile photo upload is optional during registration
- Profile photos are efficiently stored and served via Cloudinary's CDN
- If a user re-uploads a profile photo, it automatically overwrites the previous one

---

## Support & Maintenance

For API issues or feature requests, please refer to the project repository or contact the development team.

**Last Updated**: February 22, 2026  
**Version**: 1.1.0
