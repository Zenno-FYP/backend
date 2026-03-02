import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { ToolUsageService } from './tool-usage.service';
import { DashboardController } from './dashboard.controller';
import { Activity, ActivitySchema } from '../activity/schemas/activity.schema';
import { Project, ProjectSchema } from '../activity/schemas/project.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { FirebaseModule } from '../../firebase/firebase.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
    ]),
    FirebaseModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, ToolUsageService],
  exports: [DashboardService, ToolUsageService],
})
export class DashboardModule {}
