import { Global, Module } from '@nestjs/common';
import { MinioStorageService } from './minio-storage.service';
import { UploadController } from './upload.controller';
import { UserUploadController } from './user-upload.controller';
import { STORAGE_SERVICE } from './storage.service';

/**
 * 存储模块：对外只暴露 STORAGE_SERVICE 抽象，调用方不关心底层是 MinIO 还是 OSS。
 * @Global：与 Prisma/Redis 一致，作为跨模块基础设施注入，避免各业务模块重复 import。
 */
@Global()
@Module({
  controllers: [UploadController, UserUploadController],
  providers: [MinioStorageService, { provide: STORAGE_SERVICE, useExisting: MinioStorageService }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
