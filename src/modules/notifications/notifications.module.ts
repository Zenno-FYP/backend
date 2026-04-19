import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FirebaseModule } from '../../firebase/firebase.module';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import {
  NotificationDevice,
  NotificationDeviceSchema,
} from './schemas/notification-device.schema';
import {
  NotificationPreferences,
  NotificationPreferencesSchema,
} from './schemas/notification-preferences.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Activity, ActivitySchema } from '../activity/schemas/activity.schema';
import { Project, ProjectSchema } from '../activity/schemas/project.schema';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { DigestSchedulerService } from './digest-scheduler.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationDevice.name, schema: NotificationDeviceSchema },
      { name: NotificationPreferences.name, schema: NotificationPreferencesSchema },
      { name: User.name, schema: UserSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
    FirebaseModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, DigestSchedulerService],
  exports: [NotificationService],
})
export class NotificationsModule {}
