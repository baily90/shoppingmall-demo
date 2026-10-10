/** 首页装修位类型（HomeSlot.type） */
export const HomeSlotType = {
  BANNER: 1, // 轮播图
  NAV_ICON: 2, // 金刚区图标
} as const;

/** 跳转类型（HomeSlot.linkType） */
export const HomeLinkType = {
  NONE: 0, // 无跳转
  PRODUCT: 1, // 商品（linkValue = productId）
  CATEGORY: 2, // 分类（linkValue = categoryId）
  SECKILL: 3, // 秒杀专区
  URL: 4, // 外链（linkValue = url）
} as const;

export const HOME_LINK_TYPE_VALUES = Object.values(HomeLinkType);
export const HOME_SLOT_TYPE_VALUES = Object.values(HomeSlotType);
