import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotificationsModule } from './notifications.module';
import { ActivityModule } from '../activity/activity.module';
import { ChatModule } from '../chat/chat.module';
import { Notification } from './schemas/notification.schema';
import { NotificationDevice } from './schemas/notification-device.schema';
import { NotificationPreferences } from './schemas/notification-preferences.schema';
import { Activity } from '../activity/schemas/activity.schema';
import { Project } from '../activity/schemas/project.schema';
import { User } from '../user/schemas/user.schema';
import { ChatMessage } from '../chat/schemas/chat-message.schema';
import { Conversation } from '../chat/schemas/conversation.schema';
import { FirebaseService } from '../../firebase/firebase.service';
import { NotificationService } from './notification.service';
import { ActivityService } from '../activity/activity.service';
import { ChatService } from '../chat/chat.service';

/**
 * Sanity test that the `forwardRef(() => NotificationsModule)` wiring inside
 * `ActivityModule` and `ChatModule` actually resolves at compile time. If a
 * future refactor introduces a real circular import (or removes one side of
 * the forwardRef), Nest's DI graph will fail to compile here instead of at
 * production startup.
 *
 * We only stub out the per-model providers (and Firebase) so the full
 * NestJS module graph still walks every controller/provider — that's where
 * forwardRef issues surface.
 */
describe('NotificationsModule + ActivityModule + ChatModule (DI bootstrap)', () => {
  const fakeModel = {} as Record<string, jest.Mock>;
  const firebaseStub = {
    verifyToken: jest.fn(),
    sendMulticastPush: jest
      .fn()
      .mockResolvedValue({ successCount: 0, failedTokens: [] }),
  };

  it('compiles every module that participates in the forwardRef cycle', async () => {
    const builder = Test.createTestingModule({
      imports: [NotificationsModule, ActivityModule, ChatModule],
    });

    // Override every Mongo model so we don't need a real connection.
    for (const cls of [
      Notification,
      NotificationDevice,
      NotificationPreferences,
      Activity,
      Project,
      User,
      ChatMessage,
      Conversation,
    ]) {
      builder.overrideProvider(getModelToken(cls.name)).useValue(fakeModel);
    }

    builder.overrideProvider(FirebaseService).useValue(firebaseStub);

    const moduleRef = await builder.compile();

    expect(moduleRef.get(NotificationService)).toBeDefined();
    expect(moduleRef.get(ActivityService)).toBeDefined();
    expect(moduleRef.get(ChatService)).toBeDefined();

    await moduleRef.close();
  });
});
