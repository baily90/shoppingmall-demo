import { Module } from '@nestjs/common';
import { SessionStore } from './session-store.js';
import { UserProfileStore } from './user-profile-store.js';

@Module({
  providers: [SessionStore, UserProfileStore],
  exports: [SessionStore, UserProfileStore],
})
export class SessionModule {}
