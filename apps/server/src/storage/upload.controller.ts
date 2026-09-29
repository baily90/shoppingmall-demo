import { Controller, Inject, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { ErrorCode } from '@mall/shared';
import { BusinessException } from '../common/exceptions/business.exception';
import { AdminJwtAuthGuard } from '../common/guards/admin-jwt-auth.guard';
import { STORAGE_SERVICE, StorageService } from './storage.service';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * 图片上传：登录管理员均可上传（具体业务权限在创建/编辑商品时校验）。
 * 返回 { url, key }，url 可直接用于 <img src>。
 */
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/uploads')
export class UploadController {
  constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) {
          return cb(
            new BusinessException(ErrorCode.PARAM_INVALID, '仅支持 jpg/jpeg/png/gif/webp 图片'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BusinessException(ErrorCode.PARAM_INVALID, '请选择要上传的图片');
    }
    const now = new Date();
    const dir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const key = `products/${dir}/${randomUUID()}${extname(file.originalname).toLowerCase()}`;
    const url = await this.storage.upload(file.buffer, key, file.mimetype);
    return { url, key };
  }
}
