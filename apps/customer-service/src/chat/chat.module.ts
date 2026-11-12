import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ContextService } from './context.service.js';
import { ToolsService } from '../tools/tools.service.js';
import { RagService } from '../rag/rag.service.js';
import { SessionModule } from '../session/session.module.js';

@Module({
  imports: [SessionModule],
  controllers: [ChatController],
  providers: [ChatService, ContextService, ToolsService, RagService],
})
export class ChatModule {}
