/** 后端统一响应结构（见 docs/03 技术选型与接口清单） */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}
