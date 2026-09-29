/** 分 → 元字符串，如 599900 → "5999.00" */
export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

/** 价格显示：¥xx.xx；空值显示 '—' */
export function formatPrice(fen: number | null | undefined): string {
  if (fen == null) return '—';
  return `¥${fenToYuan(fen)}`;
}
