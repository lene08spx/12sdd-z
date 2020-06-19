// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

import { encode, WebSocket, parsePath, isWebSocketCloseEvent } from "../deps.ts";
import { CompilationResult } from "./compile.ts";

const pythonExecutable = decodeURI(parsePath(import.meta.url).dir.replace("file:///",""))+"/../../lib/pythonw.exe";

export async function hostScript(sock: WebSocket, script: CompilationResult) {
  const proc = Deno.run({
    cmd: [pythonExecutable, "-c", script.output],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  (async()=>{
    for await (const msg of sock) {
      if (typeof msg === "string") {
        await proc.stdin.write(encode(msg+"\n"));
      }
      else if (isWebSocketCloseEvent(msg)) {
        proc.close();
        break;
      }
    }
  })();
  (async()=>{
    for await (const out of Deno.iter(proc.stdout)) {
      await sock.send(out);
    }
  })();
  const status = await proc.status();
  if (status.code !== 0) {
    console.log(proc.stderrOutput());
  }
  sock.close();
  proc.close();
}
