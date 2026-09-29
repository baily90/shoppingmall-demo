import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { StorageService } from './storage.service';

/**
 * MinIO 存储实现（S3 兼容）。
 * 通过 StorageModule 以 STORAGE_SERVICE token 注册，未来换阿里云 OSS 只需另写一个实现类替换。
 */
@Injectable()
export class MinioStorageService implements StorageService, OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private readonly client: Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    const endPoint = config.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = Number(config.get<string>('MINIO_PORT', '9000'));
    this.client = new Client({
      endPoint,
      port,
      useSSL: config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
    this.bucket = config.get<string>('MINIO_BUCKET', 'mall');
    this.publicUrl = config.get<string>('MINIO_PUBLIC_URL', `http://${endPoint}:${port}`);
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`已创建存储桶 ${this.bucket}`);
      }
      // 公开读：让浏览器 <img> 能直接访问，免去预签名 URL 的复杂度
      await this.client.setBucketPolicy(
        this.bucket,
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        }),
      );
    } catch (e) {
      // MinIO 未启动时不让后端崩溃，上传请求时再报错
      this.logger.warn(`MinIO 初始化失败（${(e as Error).message}），图片上传暂不可用`);
    }
  }

  async upload(file: Buffer, key: string, contentType?: string): Promise<string> {
    await this.client.putObject(
      this.bucket,
      key,
      file,
      file.length,
      contentType ? { 'Content-Type': contentType } : undefined,
    );
    return this.getUrl(key);
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${this.bucket}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}
