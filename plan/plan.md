# NestJS Backend with Local MongoDB - Development Plan

## Overview
This plan outlines the best approach to build a production-ready NestJS backend API server with local MongoDB database.

---

## 1. Architecture Approach

### Recommended Stack
- **Server Framework**: NestJS (TypeScript-based, enterprise-grade)
- **Database**: MongoDB (NoSQL, flexible schema)
- **ODM**: Mongoose (schema validation, easier data manipulation)
- **Runtime**: Node.js with TypeScript
- **Environment Management**: @nestjs/config (configuration management)
- **Testing**: Postman or VS Code REST Client

### NestJS Architecture Pattern
```
HTTP Request
    ↓
Controllers (handle incoming requests)
    ↓
Services (business logic & data operations)
    ↓
Models/Schemas (MongoDB schemas)
    ↓
MongoDB Database
```

**NestJS Benefits:**
- Built-in TypeScript support (type safety)
- Modular architecture (scalable)
- Dependency injection out of the box
- Built-in pipes, guards, interceptors for validation & security
- Easy testing with Jest
- CLI for scaffolding modules, controllers, services
- Built-in documentation support

---

## 2. Prerequisites

### System Requirements
- **Node.js**: v14+ (v18+ recommended)
- **npm**: v6+ or yarn
- **MongoDB**: Docker

### MongoDB Installation Options

Docker (Recommended)
1. Install Docker Desktop
2. Use `docker-compose.yml` for easy setup:
```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: password
    volumes:
      - mongo_data:/data/db
volumes:
  mongo_data:
```
3. Run: `docker-compose up -d`

---

## 3. Project Setup Steps

### Step 1: Create NestJS Project
```bash
npx @nestjs/cli@latest new zenno-backend --package-manager npm --strict
```

### Step 2: Install MongoDB Dependencies
```bash
npm install mongoose @nestjs/mongoose
```

### Step 3: Project Structure (NestJS Auto-Generated)
```
zenno-backend/
├── src/
│   ├── modules/                 # Feature modules
│   │   ├── users/               # Users module
│   │   │   ├── dto/             # Data Transfer Objects
│   │   │   │   └── create-user.dto.ts
│   │   │   ├── schemas/         # Mongoose schemas
│   │   │   │   └── user.schema.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   ├── common/                  # Shared resources
│   │   ├── filters/             # Exception filters
│   │   ├── guards/              # Authentication guards
│   │   ├── pipes/               # Validation pipes
│   │   └── interceptors/        # Response interceptors
│   ├── config/                  # Configuration
│   │   └── database.config.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   ├── app.module.ts            # Root module
│   └── main.ts                  # App entry point
├── test/                        # Tests
├── .env                         # Environment variables
├── .gitignore
├── package.json
├── tsconfig.json               # TypeScript config
├── nest-cli.json              # NestJS CLI config
├── docker-compose.yml
└── README.md
```

### Step 4: Create .env File
```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://root:password@localhost:27017/zenno_db?authSource=admin
MONGODB_USERNAME=root
MONGODB_PASSWORD=password

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000
```

### Step 5: Current package.json Scripts (Already configured)
```json
{
  "scripts": {
    "start": "nest start",
    "dev": "nest start --watch",
    "debug": "nest start --debug --watch",
    "prod": "node dist/main.js"
  }
}
```

---

## 4. Core Implementation Files

### 4.1 Database Configuration (src/config/database.config.ts)
```typescript
import { MongooseModule } from '@nestjs/mongoose';

export const mongooseConfig = MongooseModule.forRoot(
  process.env.MONGODB_URI || 'mongodb://root:password@localhost:27017/zenno_db?authSource=admin',
);
```

### 4.2 User Schema (src/modules/users/schemas/user.schema.ts)
```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ min: 0 })
  age?: number;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
```

### 4.3 Create User DTO (src/modules/users/dto/create-user.dto.ts)
```typescript
import { IsString, IsEmail, IsNumber, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsNumber()
  @IsOptional()
  age?: number;
}
```

### 4.4 Users Service (src/modules/users/users.service.ts)
```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const newUser = new this.userModel(createUserDto);
    return newUser.save();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findOne(id: string): Promise<User> {
    return this.userModel.findById(id).exec();
  }

  async update(id: string, updateUserDto: CreateUserDto): Promise<User> {
    return this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true }).exec();
  }

  async delete(id: string): Promise<User> {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}
```

### 4.5 Users Controller (src/modules/users/users.controller.ts)
```typescript
import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('api/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() createUserDto: CreateUserDto) {
    return this.usersService.update(id, createUserDto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
```

### 4.6 Users Module (src/modules/users/users.module.ts)
```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

### 4.7 App Module (src/app.module.ts)
```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 4.8 Main Entry Point (src/main.ts)
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

  // Enable CORS
  app.enableCors();

  await app.listen(process.env.PORT || 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
```

---

## 5. Implementation Steps

### Phase 1: Setup & Configuration ✅ (COMPLETED)
- [x] Install Node.js and npm
- [x] Set up MongoDB with Docker
- [x] Create NestJS project
- [x] Install dependencies
- [x] Create .env file

### Phase 2: Create Users Module (Next)
- [ ] Create users module using NestJS CLI: `nest generate module modules/users`
- [ ] Generate users controller: `nest generate controller modules/users`
- [ ] Generate users service: `nest generate service modules/users`
- [ ] Create user schema (user.schema.ts)
- [ ] Create create-user DTO (create-user.dto.ts)
- [ ] Implement CRUD operations
- [ ] Import @nestjs/mongoose in UsersModule
- [ ] Register UserSchema in UsersModule

### Phase 3: Update App Module (Day 2)
- [ ] Import ConfigModule for environment variables
- [ ] Connect MongoDB using MongooseModule.forRoot()
- [ ] Import UsersModule
- [ ] Enable global validation pipes
- [ ] Enable CORS

### Phase 4: Test API Endpoints (Day 2)
- [ ] Start MongoDB: `docker-compose up -d`
- [ ] Start NestJS app: `npm run dev`
- [ ] Test POST /api/users (Create)
- [ ] Test GET /api/users (Read All)
- [ ] Test GET /api/users/:id (Read One)
- [ ] Test PUT /api/users/:id (Update)
- [ ] Test DELETE /api/users/:id (Delete)

### Phase 5: Add Validation & Error Handling (Day 3)
- [ ] Add class-validator decorators to DTOs
- [ ] Add exception filters for custom error responses
- [ ] Add input sanitization
- [ ] Add logging

### Phase 6: Enhancements (Day 3+)
- [ ] Add pagination
- [ ] Add filtering and sorting
- [ ] Add JWT authentication
- [ ] Add API documentation with Swagger
- [ ] Add unit tests

---

## 6. Best Practices for NestJS

### Project Structure
- Use modules to organize features by domain
- Keep controllers thin (routing only)
- Put business logic in services
- Use DTOs for request/response validation
- Use schemas for MongoDB data validation

### TypeScript & Code Quality
- Use strict TypeScript settings
- Add proper type hints to all functions
- Use enums for constants
- Use interfaces for data contracts

### NestJS-Specific
- Use dependency injection for all services
- Use decorators for route handlers (@Get, @Post, etc.)
- Use pipes for validation (@nestjs/common)
- Use guards for authorization
- Use interceptors for response transformation
- Use exception filters for centralized error handling

### Database
- Use Mongoose with @nestjs/mongoose
- Create separate schema files
- Add indexes to frequently queried fields
- Use lean() for read-only queries to improve performance
- Validate data with class-validator

### API Design
- Use REST conventions (GET, POST, PUT, DELETE)
- Use semantic HTTP status codes
- Return consistent response format
- Version your API (`/api/v1/users`)
- Document endpoints with Swagger

### Security
- Validate all inputs using DTOs
- Sanitize data before storing in database
- Use environment variables for secrets
- Implement CORS properly
- Add rate limiting for production
- Use helmet for HTTP headers security

---

## 7. Testing & Verification

### Test Endpoints in REST Client (VSCode Extension)

Install the **REST Client** extension in VS Code, then create a file `test.http`:

**Create User**
```http
POST http://localhost:3000/api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "age": 25
}
```

**Get All Users**
```http
GET http://localhost:3000/api/users
```

**Get Single User** (Replace with actual MongoDB ID)
```http
GET http://localhost:3000/api/users/[user_id]
```

**Update User**
```http
PUT http://localhost:3000/api/users/[user_id]
Content-Type: application/json

{
  "name": "Jane Doe",
  "age": 26
}
```

**Delete User**
```http
DELETE http://localhost:3000/api/users/[user_id]
```

---

## 8. Running the Application

### Start MongoDB
```bash
docker-compose up -d
```

Verify MongoDB is running:
```bash
docker-compose ps
```

### Development Mode
```bash
npm run dev
```

or with debugging:
```bash
npm run debug
```

### Production Mode
First build the project:
```bash
npm run build
```

Then run:
```bash
npm run prod
```

### Expected Output
```
[Nest] 12345  - 02/04/2026, 1:30:45 PM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 02/04/2026, 1:30:46 PM     LOG [InstanceLoader] MongooseModule dependencies initialized +123ms
[Nest] 12345  - 02/04/2026, 1:30:46 PM     LOG [InstanceLoader] UsersModule dependencies initialized +45ms
[Nest] 12345  - 02/04/2026, 1:30:46 PM     LOG [RoutesResolver] UsersController {/api/users}:...
[Nest] 12345  - 02/04/2026, 1:30:46 PM     LOG [NestApplication] Nest application successfully started
Application is running on: http://localhost:3000
```

### Useful NestJS CLI Commands

**Generate a new module:**
```bash
nest generate module modules/[module_name]
```

**Generate a controller:**
```bash
nest generate controller modules/[module_name]
```

**Generate a service:**
```bash
nest generate service modules/[module_name]
```

**Build for production:**
```bash
npm run build
```

---

## 9. Next Steps & Enhancements

1. **Authentication**: Add JWT token-based authentication with `@nestjs/jwt`
2. **Validation**: Use `class-validator` and `class-transformer` for robust DTOs
3. **Pagination**: Add pagination queries with limit/skip
4. **Sorting & Filtering**: Add query parameters for advanced filtering
5. **Logging**: Implement logging with Winston or Pino
6. **API Documentation**: Add Swagger documentation with `@nestjs/swagger`
7. **Testing**: Add unit tests and e2e tests with Jest
8. **Deployment**: Deploy to cloud platforms (Heroku, AWS, Digital Ocean, Render)
9. **Error Handling**: Create custom exception filters and HTTP exception responses
10. **Security**: Add helmet, rate limiting, input validation, CORS configuration

---

## 10. Useful Resources

- **Express.js**: https://expressjs.com/
- **Mongoose**: https://mongoosejs.com/
- **MongoDB**: https://www.mongodb.com/
- **Docker**: https://www.docker.com/
- **Node.js**: https://nodejs.org/

---

## Summary

This plan provides a solid foundation for building production-ready Node.js APIs with local MongoDB. Follow the phases sequentially, test thoroughly at each step, and gradually add enhancements as your project grows.

**Key Takeaways:**
- Use layered architecture for maintainability
- Leverage Mongoose for schema validation
- Follow REST conventions for API design
- Test thoroughly with REST Client tools
- Start simple, add complexity as needed
