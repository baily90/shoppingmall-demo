import { Module } from '@nestjs/common';
import { SessionStore } from './session-store.js';
import { UserProfileStore } from './user-profile-store.js';
import { QaCacheStore } from './qa-cache-store.js';

@Module({
  providers: [SessionStore, UserProfileStore, QaCacheStore],
  exports: [SessionStore, UserProfileStore, QaCacheStore],
})
export class SessionModule {}
