import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { PLACEHOLDER_IMG } from '../utils/placeholder';

/**
 * 图片组件（行业最佳实践）：
 * - 懒加载（loading="lazy"）：首屏外图片不阻塞渲染，弱网下更快出内容
 * - 失败/空图回退：onError 或 src 为空时换成缺省占位图，避免破图
 * - 父容器用 aspect-ratio / 固定高度预留空间，防止加载中的布局抖动（CLS）
 */
export default function Img({
  src,
  alt = '',
  className,
  style,
  lazy = true,
  placeholder = PLACEHOLDER_IMG,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  lazy?: boolean;
  placeholder?: string;
}) {
  const [failed, setFailed] = useState(false);

  // src 变化（如详情页切换商品）时重置失败态
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const finalSrc = src && !failed ? src : placeholder;

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      style={style}
      loading={lazy ? 'lazy' : undefined}
      onError={() => setFailed(true)}
    />
  );
}
