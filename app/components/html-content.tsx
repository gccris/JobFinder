type HtmlContentProps = {
  content?: string | null;
  style?: React.CSSProperties;
  className?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "");
}

export default function HtmlContent({ content, style, className }: HtmlContentProps) {
  const value = content || "";
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  const html = hasHtml ? sanitizeHtml(value) : escapeHtml(value).replace(/\n/g, "<br />");

  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
