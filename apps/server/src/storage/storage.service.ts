/**
 * 存储适配层接口：本地用 MinIO，生产可换阿里云 OSS（均兼容 S3）
 * 具体实现（MinioStorageService）在阶段 2 商品图片上传时落地。
 */
export interface StorageService {
  /** 上传文件，返回可访问的 URL */
  upload(file: Buffer, key: string, contentType?: string): Promise<string>;

  /** 根据 key 生成访问地址 */
  getUrl(key: string): string;

  /** 删除对象 */
  delete(key: string): Promise<void>;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
