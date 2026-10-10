/** 评价展示状态（ProductReview.status）：先发后审，提交即展示，后台可屏蔽/恢复 */
export const ReviewStatus = {
  VISIBLE: 1, // 正常展示
  BLOCKED: 0, // 已屏蔽
} as const;

/** 评分范围：1~5 星 */
export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;

/** 单条评价最多可附图数 */
export const MAX_REVIEW_IMAGES = 9;

/** 商家回复最长字数 */
export const MAX_REPLY_LENGTH = 500;
