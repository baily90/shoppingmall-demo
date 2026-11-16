/**
 * 图片类型嗅探：按文件魔数（magic bytes）识别真实图片格式。
 *
 * 背景：上传时不能信任客户端上报的 mimetype（部分浏览器/系统对 .avif
 * 等格式会报成 application/octet-stream），否则 MinIO 存错 Content-Type，
 * 浏览器 <img> 就无法回显。这里从 buffer 头部字节直接判定。
 */
export function detectImageMimeType(buf: Buffer): string | undefined {
  if (!buf || buf.length < 12) return undefined;

  // JPEG：FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';

  // PNG：89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }

  // GIF：47 49 46 38（GIF8）
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return 'image/gif';
  }

  // WebP：52 49 46 46（RIFF）... 57 45 42 50（WEBP）
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }

  // AVIF：... 66 74 79 70（ftyp）61 76 69 66/73（avif / avis）
  if (
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70 &&
    buf[8] === 0x61 &&
    buf[9] === 0x76 &&
    buf[10] === 0x69 &&
    (buf[11] === 0x66 || buf[11] === 0x73)
  ) {
    return 'image/avif';
  }

  return undefined;
}
