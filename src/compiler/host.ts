// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0
/*
Script Host

Enables communications between the runtime environment and the editor.
*/


import { encode, decode, WebSocket, parsePath, isWebSocketCloseEvent } from "../deps.ts";
import { CompilationResult } from "./compile.ts";

const pythonExecutable = decodeURI(parsePath(import.meta.url).dir.replace("file:///",""))+"/../../lib/pythonw.exe";

/** Accepts a socket, and compiled script.
 * Acts as a host between the IDE terminal, 
 * and the currently executing script. */
export async function hostScript(sock: WebSocket, script: CompilationResult) {
  /** Launch a python instance to run the program. */
  const proc = Deno.run({
    cmd: [pythonExecutable, "-c", script.output],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  // Async to not block event loop
  (async()=>{
    // listen to incoming messages from the terminal
    for await (const msg of sock) {
      // if string, data was sent
      if (typeof msg === "string") {
        await proc.stdin.write(encode(msg+"\n"));
      }
      // a closed connection should gracefully close
      // the currently running program so as to not leak memory resources.
      else if (isWebSocketCloseEvent(msg)) {
        proc.stdin.close();
        proc.stdout.close();
        proc.stderr.close();
        proc.close();
        break;
      }
    }
  })();
  // Async to not block event loop
  (async()=>{
    try {
      // pipe the program to the IDE directly.
      for await (const out of Deno.iter(proc.stdout)) {
        await sock.send(decode(out));
      }
    }
    // catch (e) stops fatal crashes when the socket is closed.
    catch (e) {}
  })();
  try {
    // wait until the program finishes
    const status = await proc.status();
    // if it failed, write the output with a special prefix
    if (status.code !== 0) {
      // decode the error to a string
      const runtimeErr = decode(await proc.stderrOutput());
      // use a special prefix to ensure this is not user data.
      if (!sock.isClosed) await sock.send('\n\n\nFATAL'+runtimeErr);
      //console.log(runtimeErr);
    }
  } catch(e) {}
  // if the socket hasn't closed already, do so.
  if (!sock.isClosed) sock.close();
}
