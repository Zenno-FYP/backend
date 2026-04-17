import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import {
  AgentPreferences,
  AgentPreferencesSchema,
} from './schemas/agent-preferences.schema';
import { NudgeRecord, NudgeRecordSchema } from './schemas/nudge-record.schema';
import { FirebaseModule } from '../../firebase/firebase.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentPreferences.name, schema: AgentPreferencesSchema },
      { name: NudgeRecord.name, schema: NudgeRecordSchema },
    ]),
    FirebaseModule,
  ],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
