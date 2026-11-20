import { Module } from '@nestjs/common';
import { SessionStore } from './session-store.js';
import { UserProfileStore } from './user-profile-store.js';
import { QaCacheStore } from './qa-cache-store.js';
import { UsageStore } from './usage-store.js';

@Module({
  providers: [SessionStore, UserProfileStore, QaCacheStore, UsageStore],
  exports: [SessionStore, UserProfileStore, QaCacheStore, UsageStore],
})
export class SessionModule {}
