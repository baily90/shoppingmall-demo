import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ChatModule } from './chat/chat.module.js';
import { SessionModule } from './session/session.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, ChatModule, SessionModule],
  controllers: [AppController],
})
export class AppModule {}
