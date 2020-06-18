import { WebView } from "https://deno.land/x/webview/mod.ts";

const html = `
  <html>
  <body>
    <h1>Hello from deno</h1>
  </body>
  </html>
`;

await new WebView({
  title: "Local deno_webview example",
  url: `https://github.com/`,
  height: 600,
  resizable: true,
}).run();