import { serve, ServerRequest, parsePath, exists, acceptWebSocket } from "./deps.ts";
import { scriptHost, CompileErrors } from "./host.ts";

class IDE {
  #server: Ser;
  constructor(port: number) {

  }
  async run(): Promise<void> {

  }
}
c
// need to run a websocket daemon, for running scripts.

const wwwPath = decodeURI(parsePath(import.meta.url).dir.replace("file:///",""))+"/www";

export function startIde(port = 2654) {
  // begin web service
  const s = serve({port});
  // open browser
  Deno.run({ cmd: ["cmd", "/C", "start", "", `http://localhost:${port}/edit`], stdout: "null", stdin: "null", stderr: "null" });
  // handle requests
  (async function httpThread(){
    for await (const r of s) {
      if (r.url === "/") r.respond({status:308,headers:new Headers({"Location":"/edit"})});
      else if (r.url === "/edit") pg_edit(r);
      else if (r.url === "/execute" && r.method === "POST") pg_execute(r);
      else if (r.url === "/op/compile" && r.method === "POST") op_compile(r);
      else handleWwwDefault(r);
    }
  })();
}

async function pg_edit(r: ServerRequest): Promise<void> {
  r.respond({
    body: await Deno.readFile(wwwPath+"/edit.html")
  });
}

/** POST: Body=CacheID */
async function pg_execute(r: ServerRequest): Promise<void> {
  r.respond({
    body: await Deno.readFile(wwwPath+"/execute.html")
  });
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

/** POST: Body=ZedSource. Return: CacheID */
async function op_compile(r: ServerRequest): Promise<void> {
  const sourceCode = await readBody(r);
  const registeredCode = await scriptHost.register(sourceCode);
  let responseBody: string;
  let responseCode: number;
  if (registeredCode instanceof CompileErrors) {
    responseBody = JSON.stringify([/*CompilerErrors*/]);
    responseCode = 418;
  } else {
    responseBody = registeredCode;
    responseCode = 200;
  }
  return r.respond({
    status: responseCode,
    body: responseBody
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

async function handleWwwDefault(r: ServerRequest): Promise<void> {
  const fileExists = await exists(wwwPath+r.url);
  if (!fileExists) return r.respond({status:404});
  const fileInfo = await Deno.stat(wwwPath+r.url);
  if (!fileInfo.isFile) return r.respond({status:403});
  r.respond({
    body: await Deno.readFile(wwwPath+r.url)
  });
}
