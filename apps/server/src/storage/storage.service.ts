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

  /**
   * 写侧：把客户端回传的完整 URL 归一化成 key。
   * 已是 key 或外部 http 链接则原样返回（幂等），DB 只存 key。
   */
  urlToKey(value: string | null | undefined): string | null | undefined;

  /**
   * 读侧：幂等拼 URL。已是绝对地址（旧数据 / 外部链接）直接透传，否则拼 publicUrl。
   * 存量未迁移的行、外部图片地址都能正常显示。
   */
  toPublicUrl(value: string | null | undefined): string | null | undefined;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
