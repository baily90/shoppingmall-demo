// 环境变量读取与启动校验
//
// 目的：
//   1. 关键配置缺失时启动即报错（而不是运行时 undefined 才崩）
//   2. 所有可调参数集中从环境变量读取，方便压测/线上调优
const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'DEEPSEEK_API_KEY',
  'SILICONFLOW_API_KEY',
] as const;

/** 启动期校验：返回缺失的变量列表，缺了就抛错 */
export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `缺少必需环境变量：${missing.join(', ')}（可参考 apps/customer-service/.env.example）`,
    );
  }
}

/** 正整数环境变量（非法值回退默认值） */
export function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/** 浮点环境变量（非法值回退默认值） */
export function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

/** 逗号分隔的字符串列表（空值回退 undefined） */
export function listEnv(name: string): string[] | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const list = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}
