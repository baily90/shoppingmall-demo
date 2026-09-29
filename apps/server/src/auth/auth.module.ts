import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PermissionModule } from '../permission/permission.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthController } from './admin-auth.controller';
import { UserAuthService } from './user-auth.service';
import { UserAuthController } from './user-auth.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
    PermissionModule,
  ],
  controllers: [AdminAuthController, UserAuthController],
  providers: [JwtStrategy, TokenService, AdminAuthService, UserAuthService],
})
export class AuthModule {}
