/**
 * 缓存统一 TTL（秒）：5 分钟。
 * Cache Aside 兜底：管理端改数据主动删缓存（秒级生效），万一漏删/删失败，
 * 最多 5 分钟自动过期；同时自然回收内存，避免缓存无限膨胀。
 */
export const CACHE_TTL_SECONDS = 5 * 60;

/** 商品详情缓存 key */
export const productDetailKey = (id: number) => `product:detail:${id}`;

/** 分类树缓存 key（管理端全量 / 商城端仅启用，各一份） */
export const categoryTreeAllKey = 'category:tree:all';
export const categoryTreeEnabledKey = 'category:tree:enabled';
