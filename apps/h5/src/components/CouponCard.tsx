import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Coupon } from '../api/coupon';
import { couponFaceValue, couponThreshold, formatDate } from '../api/coupon';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface Props {
  coupon: Coupon;
  /** 置灰（已使用/已过期/不可用） */
  disabled?: boolean;
  /** 右侧动作区（领取按钮 / 状态标签等） */
  children?: ReactNode;
}

/** 通用券卡片：左侧面值+门槛，右侧名称+有效期，最右放动作 */
export default function CouponCard({ coupon, disabled, children }: Props) {
  return (
    <motion.div
      className={`coupon-card${disabled ? ' disabled' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-16px' }}
      transition={{ duration: 0.4, ease: EASE }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="coupon-left">
        <div className="coupon-face">{couponFaceValue(coupon)}</div>
        <div className="coupon-threshold">{couponThreshold(coupon)}</div>
      </div>
      <div className="coupon-main">
        <div className="coupon-name">{coupon.name}</div>
        <div className="coupon-valid">有效期至 {formatDate(coupon.endTime)}</div>
        {coupon.description && <div className="coupon-desc">{coupon.description}</div>}
      </div>
      {children && <div className="coupon-action">{children}</div>}
    </motion.div>
  );
}
