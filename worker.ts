// Serves the static site, and answers `Accept: text/markdown` on the page with the
// README Markdown so coding agents get docs instead of an app shell.
interface Env { ASSETS: { fetch(request: Request): Promise<Response> } }

const markdownPath = "/index.md";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const page = url.pathname === "/" || url.pathname === "/index.html";
    const accept = request.headers.get("accept") ?? "";
    const wantsMarkdown = accept.includes("text/markdown") && !accept.includes("text/html");
    if (page && wantsMarkdown) {
      const markdown = await env.ASSETS.fetch(new Request(new URL(markdownPath, url), request));
      const headers = new Headers(markdown.headers);
      headers.set("content-type", "text/markdown; charset=utf-8");
      headers.set("vary", "Accept");
      return new Response(markdown.body, { status: markdown.status, headers });
    }
    const response = await env.ASSETS.fetch(request);
    if (!page) return response;
    const headers = new Headers(response.headers);
    headers.set("vary", "Accept");
    headers.append("link", `<${markdownPath}>; rel="alternate"; type="text/markdown"`);
    return new Response(response.body, { status: response.status, headers });
  },
};
