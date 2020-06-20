// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

import { encode, decode, WebSocket, parsePath, isWebSocketCloseEvent } from "../deps.ts";
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
        proc.stdin.close();
        proc.stdout.close();
        proc.stderr.close();
        proc.close();
        break;
      }
    }
  })();
  (async()=>{
    try {
      for await (const out of Deno.iter(proc.stdout)) {
        await sock.send(decode(out));
      }
    } catch (e) {}
  })();
  try {
    const status = await proc.status();
    if (status.code !== 0) {
      const runtimeErr = decode(await proc.stderrOutput());
      if (!sock.isClosed) await sock.send('"--FATAL"'+runtimeErr);
      console.log(runtimeErr);
    }
  } catch(e) {}
  if (!sock.isClosed) sock.close();
}
