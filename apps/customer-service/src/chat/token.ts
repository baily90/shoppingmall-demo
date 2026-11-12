// token 估算：判断"窗口是否超预算"（事前，决定何时触发滚动摘要）
//
// 精确 token 只有模型调用完才返回（result.usage），所以这里用近似估算兜底。
// 估算口径：中文字符 ÷1.5、其余字符 ÷4（近似 DeepSeek 的 BPE 分词），
// 预算需留大余量（64K 模型只当 40K 用）吸收误差。
//
// 后续若要更准，可换成 tiktoken（cl100k_base），保持本文件导出的函数签名不变即可。

// 单段文本估算 token 数
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let chinese = 0;
  let other = 0;
  for (const ch of text) {
    // CJK 统一表意文字（含扩展），按中文字符计
    if (ch >= '一' && ch <= '鿿') chinese++;
    else other++;
  }
  return Math.ceil(chinese / 1.5 + other / 4);
}

// 估算任意 JSON 结构（parts / slots 等）的 token 数
export function estimateJsonTokens(value: unknown): number {
  return estimateTokens(JSON.stringify(value ?? ''));
}
