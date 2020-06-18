import { serve, Server, ServerRequest, parsePath, exists, acceptWebSocket } from "../deps.ts";
import { ScriptHost, CompileErrors } from "./host.ts";

const wwwPath = decodeURI(parsePath(import.meta.url).dir.replace("file:///",""))+"/www";

/*
const win = new WebView({
  title: "Local deno_webview example",
  url: `https://github.com/`,
  height: 600,
  resizable: true,
});
await win.run();
*/

export class IDE {
  #server: Server;
  #scriptHost = new ScriptHost();
  constructor(port = 2020) {
    this.#server = serve({ port });
  }
  async open(): Promise<void> {
    const port = (this.#server.listener.addr as Deno.NetAddr).port;
    const proc = Deno.run({
      cmd: ["cmd", "/C", "start", "", `http://localhost:${port}/edit`]
    });
    await proc.status();
    proc.close();
  }
  close() {
    this.#server.close();
  }
  async start(): Promise<void> {
    for await (const r of this.#server) this.handleRequest(r);
  }
  private async handleRequest(r: ServerRequest): Promise<void> {
    if (r.url === "/") r.respond({status:308,headers:new Headers({"Location":"/edit"})});
    else if (r.url === "/edit") this.httpServe(r, "/edit.html");
    else if (r.url.startsWith("/execute")) this.httpServe(r, "/execute.html");
    else if (r.url === "/op/compile" && r.method === "POST") this.opCompile(r);
    else if (r.url.startsWith("/op/run")) this.opRun(r);
    else this.httpServe(r);
  }
  private async httpServe(r: ServerRequest, filename?: string): Promise<void> {
    if (filename === undefined) filename = r.url;
    const fileExists = await exists(wwwPath+filename);
    if (!fileExists) return r.respond({status:404});
    const fileInfo = await Deno.stat(wwwPath+filename);
    if (!fileInfo.isFile) return r.respond({status:403});
    r.respond({
      body: await Deno.readFile(wwwPath+filename)
    });
  }
  /** Input (POST):
   *    r.body => string => Zed Source Code
   * 
   *  Output (application/json):
   *    hash => string => Unique identifier of source code
   *    errors => Error[] => Generated during compilation
   */
  private async opCompile(r: ServerRequest): Promise<void> {
    const sourceCode = await readBody(r);
    const hash = await this.#scriptHost.compile(sourceCode);
    return r.respond({
      status: 200,
      body: hash,
      headers: new Headers({"Content-Type": "text/plain"})
    });
    /*
    const pythonObjectCode = scriptHost.retrieve(registerResult);
    console.log(pythonObjectCode);
    const proc = Deno.run({
      cmd: ["python", "-c", pythonObjectCode]
    });
    await proc.status();
    Deno.close(proc.rid);
    return r.respond({
      status: 200,
      body: registerResult
    });
    */
  }
  private async opRun(r: ServerRequest): Promise<void> {
    const sock = await acceptWebSocket({
      conn: r.conn,
      bufWriter: r.w,
      bufReader: r.r,
      headers: r.headers
    });
    const hash = new URLSearchParams(r.url.split("?")[1]).get("id") ?? "";
    this.#scriptHost.run(sock, hash);
  }
}

async function readBody(r: ServerRequest): Promise<string> {
  const buf = new Uint8Array(r.contentLength||0);
  let totalRead = 0;
  while (totalRead < (r.contentLength||0)) {
    const n = await r.body.read(buf.subarray(totalRead));
    if (n === null) break;
    totalRead += n;
  }
  return new TextDecoder().decode(buf);
}

