// Langfuse 观测集成（复用 18-observability 的接入方式）
// 在 main.ts 最先 import 本文件，注册后 AI SDK 所有调用自动上报 trace
import { registerTelemetry } from 'ai';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk';
import { NodeSDK } from '@opentelemetry/sdk-node';

// LangfuseSpanProcessor 自动读取环境变量：
//   LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASEURL
const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

registerTelemetry(new LangfuseVercelAiSdkIntegration());

// 供离线脚本（如 eval）在进程退出前调用：sdk.start() 只注册 SIGINT/SIGTERM 的
// 刷新钩子，不处理正常退出；脚本跑完就 exit 的话，BatchSpanProcessor 里最后一批
// span（挂着 experiment_name/dataset_id 的评测 span）会丢，实验记录就不会出现在
// Langfuse 的 Experiments 页。常驻服务（main.ts）不需要，定时器会持续刷。
export async function shutdownLangfuse() {
  await sdk.shutdown();
}
