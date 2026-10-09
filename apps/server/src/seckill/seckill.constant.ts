/** 秒杀落单队列名（BullMQ） */
export const SECKILL_QUEUE = 'seckill-queue';

/** 秒杀落单任务名 */
export const SECKILL_CREATE_ORDER_JOB = 'seckill-create-order';

/** 结果/请求映射的 TTL（秒）：超过则视为处理中兜底 */
export const SECKILL_RESULT_TTL_SECONDS = 30 * 60;

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
 * 抢购 Lua 脚本（原子，Redis 单线程内一次跑完，天然并发安全）：
 *   KEYS[1] = 库存 key，KEYS[2] = 已抢用户集合 key，ARGV[1] = userId
 *   返回值：-1 已抢过 / 0 无库存 / 1 抢到（扣库存 + 记用户）
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
return 1
`;
