/** 券类型（Coupon.type） */
export const CouponType = {
  FULL_REDUCTION: 1, // 满减：满 thresholdAmount 减 discountAmount
  DISCOUNT: 2, // 折扣：打 discountRate 折（如 85 = 85 折）
} as const;

/** 用户券状态（UserCoupon.status） */
export const UserCouponStatus = {
  UNUSED: 1, // 未使用
  USED: 2, // 已使用
} as const;
