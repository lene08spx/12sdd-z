// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

import { Sha1, decode, serve, Server, ServerRequest, parsePath, exists, acceptWebSocket } from "./deps.ts";
import { compileSource, CompilationResult } from "./compiler/compile.ts";
import { hostScript } from "./compiler/host.ts";

/** The root folder of the ide. */
const wwwPath = decodeURI(parsePath(import.meta.url).dir.replace("file:///",""))+"/ide";

/** Any mime-types used in tranferring data. */
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

/** Generate a sha1 hash from the input data. */
function sha1(data: string): string { return new Sha1().update(data).hex(); }

/** Singleton class for the IDE */
export class IDE {
  /** Private reference to the web-server */
  #server: Server;
  /** Private reference to the compiler cache. */
  #compileCache = new Map<string, CompilationResult>();
  /** Private reference to the server port number. */
  #port: number = 2020
  constructor(port = 2020) {
    this.#port = port;
    this.#server = serve({
      hostname: "0.0.0.0",
      port: this.#port
    });
  }
  /** Start the ide. */
  async run(): Promise<void> {
    (async()=>{for await (const r of this.#server) this.handleRequest(r)})();
    try {
      this.launchWindow();
    }
    // catch the error so that even if cmd.exe doesnt want to start for some reason,
    // the user can still open up the editor in their browser.
    catch(e){}
    //this.#server.close();
  }
  /** launch the editor window */
  async launchWindow() {
    const proc = Deno.run({
      cmd: ["cmd", "/C", "start", "", `http://localhost:${this.#port}/zeditor.html`],
      stdin: "null", stdout: "null", stderr: "null",
    });
    await proc.status();
    proc.close();
  }
  /** handle incoming http requests */
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
  /** serve up as a file-server */
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
    // if the file has already been compiled, return that
    if (this.#compileCache.has(hash)) {
      return r.respond({
        status: 200,
        headers: new Headers({"Content-Type": mimeTypes[".json"]}),
        body: JSON.stringify(this.#compileCache.get(hash)),
      });
    // if its a new file, recompile it
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
  /** upgrade to Websocket, and keep a pipe open between IDE terminal and Script Host */
  private async opRun(r: ServerRequest): Promise<void> {
    const hash = new URL(r.url,"file:").searchParams.get("id")!;
    const sock = await acceptWebSocket({
      conn: r.conn,
      bufWriter: r.w,
      bufReader: r.r,
      headers: r.headers,
    });
    // if the hash isnt in the cache, tell the IDE terminal user to close and reopen
    if (!this.#compileCache.has(hash)) {
      sock.send('\n\n\nFATALPlease close this terminal window.');
      return sock.close();
    }
    else {
      return hostScript(sock, this.#compileCache.get(hash)!);
    }
  }
}

// Start the IDE
console.log("+==============================+")
console.log("|                              |");
console.log("| The Zed Programming Language |");
console.log("|                              |");
console.log("|    SDD Major Project 2020    |");
console.log("|        Oliver Lenehan        |");
console.log("|                              |");
console.log("+==============================+");
console.log("|     Close this window to     |");
console.log("|       exit the program.      |");
console.log("+------------------------------+");
new IDE().run();
