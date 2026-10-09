/** 秒杀落单队列名（BullMQ） */
export const SECKILL_QUEUE = 'seckill-queue';

/** 秒杀落单任务名 */
export const SECKILL_CREATE_ORDER_JOB = 'seckill-create-order';

/** 结果/请求映射的 TTL（秒）：超过则视为处理中兜底 */
export const SECKILL_RESULT_TTL_SECONDS = 30 * 60;

/** 秒杀库存/限购 key 在活动结束后额外保留的时长（秒），留缓冲防止边界误判，之后自动过期清理 */
export const SECKILL_KEY_TTL_BUFFER_SECONDS = 24 * 3600;

/** 秒杀库存/限购 key 的 TTL（秒）：活动剩余时长 + 缓冲（活动已结束则只剩缓冲） */
export const seckillKeyTtlSeconds = (endTime: Date): number =>
  Math.max(0, Math.ceil((endTime.getTime() - Date.now()) / 1000)) + SECKILL_KEY_TTL_BUFFER_SECONDS;

// ---------- Redis key 构造 ----------
// 库存、限购集合按「活动 + 商品」维度，实现每商品每用户限购 1 件
export const seckillStockKey = (activityId: number, skuId: number) =>
  `seckill:stock:${activityId}:${skuId}`;
export const seckillUsersKey = (activityId: number, skuId: number) =>
  `seckill:users:${activityId}:${skuId}`;
export const seckillReqKey = (activityId: number, skuId: number, userId: number) =>
  `seckill:req:${activityId}:${skuId}:${userId}`;
export const seckillResultKey = (requestId: string) => `seckill:result:${requestId}`;

/**
 * 惰性初始化秒杀库存 key（原子，替换 SETNX）：
 *   新建 → SET EX 带 TTL；已存在 → 若为升级前旧 key（无 TTL）则补过期时间，
 *   绝不覆盖已扣减的库存值、不缩短已有 TTL。
 *   KEYS[1] = 库存 key，ARGV[1] = TTL（秒），ARGV[2] = 初始配额
 *   返回值：1 新建 / 0 已存在
 */
export const SECKILL_INIT_STOCK_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[1])
  return 1
end
if redis.call('TTL', KEYS[1]) == -1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return 0
`;

/**
 * 抢购 Lua 脚本（原子，Redis 单线程内一次跑完，天然并发安全）：
 *   KEYS[1] = 库存 key，KEYS[2] = 已抢用户集合 key，ARGV[1] = userId，ARGV[2] = 限购集合 TTL（秒）
 *   返回值：-1 已抢过 / 0 无库存 / 1 抢到（扣库存 + 记用户 + 给集合设 TTL）
 */
export const SECKILL_GRAB_LUA = `
if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then
  return -1
end
local stock = tonumber(redis.call('GET', KEYS[1]) or '-1')
if stock <= 0 then
  return 0
end
redis.call('DECR', KEYS[1])
redis.call('SADD', KEYS[2], ARGV[1])
redis.call('EXPIRE', KEYS[2], ARGV[2])
return 1
`;
