// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

import { Sha1, decode, serve, Server, ServerRequest, parsePath, exists, acceptWebSocket } from "./deps.ts";
import { compileSource, CompilationResult } from "./compiler/compile.ts";
import { hostScript } from "./compiler/host.ts";

const wwwPath = decodeURI(parsePath(import.meta.url).dir.replace("file:///",""))+"/ide";

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".css": "text/css",
  ".txt": "text/plain",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".pdf": "application/pdf",
};

function sha1(data: string): string { return new Sha1().update(data).hex(); }

export class IDE {
  #server: Server;
  #compileCache = new Map<string, CompilationResult>();
  #port: number = 2020
  constructor(port = 2020) {
    this.#port = port;
    this.#server = serve({
      hostname: "0.0.0.0",
      port: this.#port
    });
  }
  async run(): Promise<void> {
    (async()=>{for await (const r of this.#server) this.handleRequest(r)})();
    this.launchWindow();
    //this.#server.close();
  }
  async launchWindow() {
    const proc = Deno.run({
      cmd: ["cmd", "/C", "start", "", `http://localhost:${this.#port}/zeditor.html`],
      stdin: "null", stdout: "null", stderr: "null",
    });
    await proc.status();
    proc.close();
  }
  private async handleRequest(r: ServerRequest): Promise<void> {
    //console.log(r.url);
    if (r.url === "/op/compile") {
      return this.opCompile(r);
    }
    else if (r.url.startsWith("/op/run")) {
      return this.opRun(r);
    }
    else {
      return this.httpServe(r);
    }
  }
  private async httpServe(r: ServerRequest): Promise<void> {
    r.url = r.url.split("?")[0];
    const fileExists = await exists(wwwPath+r.url);
    if (!fileExists) return r.respond({status:404});
    const fileInfo = await Deno.stat(wwwPath+r.url);
    if (!fileInfo.isFile) return r.respond({status:404});
    return r.respond({
      status: 200,
      headers: new Headers({
        "Content-Type": mimeTypes[parsePath(r.url).ext] ?? "text/plain"
      }),
      body: await Deno.readFile(wwwPath+r.url),
    });
  }
  /** Input (POST):
   *    r.body => string => Zed Source Code
   * 
   *  Output (application/json):
   *    CompilationResult
   */
  private async opCompile(r: ServerRequest): Promise<void> {
    const sourceCode = decode(await Deno.readAll(r.body));
    const hash = sha1(sourceCode);
    if (this.#compileCache.has(hash)) {
      return r.respond({
        status: 200,
        headers: new Headers({"Content-Type": mimeTypes[".json"]}),
        body: JSON.stringify(this.#compileCache.get(hash)),
      });
    } else {
      const result = compileSource(sourceCode);
      this.#compileCache.set(hash, result);
      return r.respond({
        status: 200,
        headers: new Headers({"Content-Type": mimeTypes[".json"]}),
        body: JSON.stringify(result),
      });
    }
  }
  private async opRun(r: ServerRequest): Promise<void> {
    const hash = new URL(r.url,"file:").searchParams.get("id")!;
    const sock = await acceptWebSocket({
      conn: r.conn,
      bufWriter: r.w,
      bufReader: r.r,
      headers: r.headers,
    });
    if (!this.#compileCache.has(hash)) {
      sock.send('"--FATAL"Please close this terminal window.');
      return sock.close();
    }
    else {
      return hostScript(sock, this.#compileCache.get(hash)!);
    }
  }
}

new IDE().run();
