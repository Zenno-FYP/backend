# Zenno Backend API Documentation

## Overview
Zenno is a production-ready NestJS backend application that verifies Firebase authentication tokens and manages user profiles in MongoDB with Cloudinary for image storage.

**Base URL:** `http://localhost:3000`  
**API Version:** `v1`  
**Documentation:** `http://localhost:3000/api/docs` (Swagger UI)

---

## Authentication

All endpoints require a Firebase ID Token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

Firebase ID Tokens are obtained from Firebase Authentication on the frontend and are sent with each API request. The backend verifies the token validity with Firebase Admin SDK.

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

### User Module (`/api/v1/user`)

#### 1. Get User Profile

```
GET /api/v1/user/me
Authorization: Bearer <firebase-id-token>
```

Retrieves the authenticated user's profile information.

**Auto-Sync Feature:** If the user's email is verified on Firebase (`email_verified` = true) but the MongoDB record shows `isVerified` = false, the backend will automatically update the MongoDB record to set `isVerified` to true. This ensures that once Firebase verifies an email, the backend is always in sync without requiring a separate verification endpoint call.

**Headers:**
```
Authorization: Bearer <firebase-id-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User details retrieved",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "profilePhoto": "https://res.cloudinary.com/zenno/image/upload/v1/zenno/profile-photos/user@example.com.jpg",
    "isVerified": true,
    "role": "user",
    "createdAt": "2026-02-23T10:00:00Z",
    "updatedAt": "2026-02-23T10:00:00Z"
  }
}
```

**Status Codes:**
- `200` - User profile retrieved successfully
- `401` - Unauthorized / Invalid or expired Firebase token
- `404` - User not found

**Example cURL Request:**
```bash
curl -X GET http://localhost:3000/api/v1/user/me \
  -H "Authorization: Bearer <firebase-id-token>"
```

---

#### 2. Create User Profile

```
PUT /api/v1/user/me
Authorization: Bearer <firebase-id-token>
Content-Type: multipart/form-data
```

Creates a new user profile on first login. This endpoint is idempotent - if you call it multiple times with the same email, it will return the existing user data without making any changes. This means the endpoint is safe to call repeatedly.

**Auto-Sync Feature:** Similar to the GET endpoint, if the user's email is verified on Firebase (`email_verified` = true) but the MongoDB record shows `isVerified` = false, the backend will automatically update the MongoDB record to set `isVerified` to true.

**Headers:**
```
Authorization: Bearer <firebase-id-token>
```

**Request Body (Form Data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email address |
| `name` | string | Yes | User full name |
| `profilePhoto` | file | No | Profile photo image file (jpg, png, etc.) |

**Example cURL Request:**
```bash
curl -X PUT http://localhost:3000/api/v1/user/me \
  -H "Authorization: Bearer <firebase-id-token>" \
  -F "email=john@example.com" \
  -F "name=John Doe" \
  -F "profilePhoto=@photo.jpg"
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User profile created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "profilePhoto": "https://res.cloudinary.com/zenno/image/upload/v1/zenno/profile-photos/user@example.com.jpg",
    "isVerified": false,
    "role": "user",
    "createdAt": "2026-02-23T10:00:00Z",
    "updatedAt": "2026-02-23T10:00:00Z"
  }
}
```

**Status Codes:**
- `201` - User profile created successfully (new user)
- `200` - User profile already exists (returning existing user data)
- `400` - Invalid request data (validation error)
- `401` - Unauthorized / Invalid or expired Firebase token

**Notes:**
- On first login, this endpoint creates a user profile and returns it (201).
- On subsequent calls with the same email, it returns the existing user data (200) without any updates.
- **Auto-Sync Verification:** If Firebase shows the email as verified but MongoDB shows `isVerified` = false, the backend automatically updates MongoDB to sync the status.
- Profile photo is optional. If provided, it will be automatically uploaded to Cloudinary
- Photo filename uses the user's email as ID, so re-uploading a photo will overwrite the previous one
- Maximum file size depends on Cloudinary limits (typically 100MB)
- Supported formats: JPG, PNG, WebP, GIF, SVG, etc.
- Email must be a valid email format
- Name must be a non-empty string

---

## Data Models

### User Schema

```typescript
{
  _id: ObjectId;              // MongoDB ID
  email: string;              // User email (unique)
  name: string;               // Full name
  profilePhoto?: string;      // Profile picture URL (optional)
  isVerified: boolean;        // Verification status (default: false)
  role: string;               // User role (default: "user")
  createdAt: Date;            // Auto-managed creation timestamp
  updatedAt: Date;            // Auto-managed update timestamp
}
```

### User Response DTO

```typescript
{
  _id: ObjectId;
  email: string;
  name: string;
  profilePhoto?: string;
  isVerified: boolean;
  role: string;
  createdAt: Date;
  updatedAt: Date;
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
| 401 | Unauthorized | Missing, invalid, or expired Firebase token |
| 404 | Not Found | User not found |
| 500 | Internal Server Error | Server-side error |

### Validation Errors

When request data fails validation:

```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "name must be a string"
  ],
  "error": "Bad Request"
}
```

---

## Security Features

### Token Verification
- **Firebase ID Token**: Verified on every request with Firebase Admin SDK
- **Bearer Token Extraction**: Automatically extracts token from Authorization header
- **Token Validation**: Ensures token is valid, not expired, and issued by Firebase

### Authentication Guard
- All protected endpoints validated with `FirebaseAuthGuard`
- Automatic 401 response for invalid/revoked/expired tokens
- Token claims extracted and attached to request for authorization

### Field Validation
- Request data validated with `class-validator` decorators
- Email format validation
- Type checking for all fields
- Optional fields properly handled

## Usage Examples

### Example 1: Get Current User Profile

```bash
curl -X GET http://localhost:3000/api/v1/user/me \
  -H "Authorization: Bearer <firebase-id-token>"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User details retrieved",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "john@example.com",
    "name": "John Doe",
    "profilePhoto": null,
    "isVerified": false,
    "role": "user",
    "createdAt": "2026-02-23T10:00:00Z",
    "updatedAt": "2026-02-23T10:00:00Z"
  }
}
```

---

### Example 2: Create User Profile (Without Photo)

```bash
curl -X PUT http://localhost:3000/api/v1/user/me \
  -H "Authorization: Bearer <firebase-id-token>" \
  -d '{
    "email": "john@example.com",
    "name": "John Doe"
  }'
```

---

### Example 3: Create User Profile (With Photo)

```bash
curl -X PUT http://localhost:3000/api/v1/user/me \
  -H "Authorization: Bearer <firebase-id-token>" \
  -F "email=john@example.com" \
  -F "name=John Doe" \
  -F "profilePhoto=@/path/to/profile.jpg"
```

When a profile photo is uploaded, it will be automatically uploaded to Cloudinary and the HTTPS URL will be stored in the user's profilePhoto field.

---

### Example 4: Invalid Firebase Token

```bash
curl -X GET http://localhost:3000/api/v1/user/me \
  -H "Authorization: Bearer invalid-token"
```

**Response (401 Unauthorized):**
```json
{
  "statusCode": 401,
  "message": "Invalid or expired firebase token",
  "error": "Unauthorized"
}
```

---

## Authentication Flow

```
1. Frontend: User authenticates with Firebase (email, Google, GitHub, etc.)
                           ↓
2. Firebase: Returns Firebase ID Token
                           ↓
3. Frontend: Sends Firebase ID Token in Authorization header
                           ↓
4. Backend: Verifies token with Firebase Admin SDK
                           ↓
5. Backend: Extracts email from token claims
                           ↓
6. Backend: Finds/creates user in MongoDB
                           ↓
7. Backend: Returns user data
                           ↓
8. Frontend: Uses user data in application
```

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

# MongoDB Configuration
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/database

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@project-id.iam.gserviceaccount.com

# Cloudinary (Image Upload)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

---

## Important Notes

- **Firebase Authentication**: All authentication is handled by Firebase on the frontend. The backend only verifies tokens.
- **Email Verification Sync**: When calling GET /user/me, if Firebase shows the email as verified (`email_verified` = true) but MongoDB shows `isVerified` = false, the backend automatically updates the MongoDB record to sync the states.
- **Token Expiration**: Firebase ID Tokens typically expire after 1 hour. Frontend must refresh and get a new token.
- **Email-Based IDs**: Profile photos are stored in Cloudinary using email as the public ID, so re-uploading automatically overwrites the old photo.
- **Create-Only User Profile**: Users are created via PUT /user/me only on first login. Subsequent PUT calls to the same endpoint will return a 409 Conflict error. This ensures profile integrity.
- **Timestamps**: All timestamps are in ISO 8601 format (UTC).
- **No Password Storage**: Passwords are managed entirely by Firebase. Backend never stores passwords.

---

## Support & Maintenance

For API issues or feature requests, please refer to the project repository or contact the development team.

**Last Updated**: February 23, 2026  
**Version**: 2.0.0
