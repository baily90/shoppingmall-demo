import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// 聊天文本的 Markdown 渲染：支持加粗/列表/表格/链接/代码，单换行按 <br> 处理（更适合对话）
export default function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // 链接新窗口打开，防跳出当前 SPA
          a: (props) => (
            <a href={props.href} target="_blank" rel="noopener noreferrer">
              {props.children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
