import { Module } from '@nestjs/common';
import { PermissionModule } from '../permission/permission.module';
import { AuthModule } from '../auth/auth.module';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';

@Module({
  imports: [PermissionModule, AuthModule],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
