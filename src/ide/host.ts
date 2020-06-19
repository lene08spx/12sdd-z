// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

import { Sha1, StringReader, WebSocket } from "./deps.ts";
import { lex } from "./lex.ts";
import { parse } from "./parse.ts";
import { compile } from "./compile.ts";

/** An array of Compilation errors. */
export class CompileErrors extends Array<Error> {};

interface Script {
  errors: Error[];
  source: string;
  compiled: string;
}

/** Stores a `key:value` of `srcHash:objCode` */
export class ScriptHost {
  #scriptCache = new Map<string, Script>();
  #hashGenerator = new Sha1();
  /** Generate a SHA-1 hash of the source code. */
  hash(source: string): string {
    this.#hashGenerator.update(source);
    const hash = this.#hashGenerator.hex();
    return hash;
  }
  /** Compile and cache the result, returning a reference the result. */
  async compile(source: string): Promise<string> {
    const hash = this.hash(source);
    if (!this.#scriptCache.has(hash)) {
      // TODO->Lex should have a variant for lexing strings, so async not needed
      const tokens = await lex(new StringReader(source));
      const parseResult = parse(tokens);
      let compileErrors: Error[] = [];
      if (parseResult.errors.length > 0) compileErrors = parseResult.errors;
      const compileResult = compile(parseResult.program);
      // Update the cache with the compiled-code, mapped to the hash of the source code.
      this.#scriptCache.set(hash, {
        errors: compileErrors,
        source: source,
        compiled: new TextDecoder().decode(compileResult.bytes())
      });
    }
    return hash;
  }
  retrieve(hash: string): Script | undefined {
    return this.#scriptCache.get(hash);
  }
  async run(sock: WebSocket, hash: string) {
    if (!this.#scriptCache.has(hash)) throw new ReferenceError();
    const objectCode = this.retrieve(hash)!.compiled;
    const proc = Deno.run({
      cmd: ["python", "-c", objectCode],
      stdin: "piped", stdout: "piped", stderr: "null"
    });
    // Listen for User Input
    (async()=>{
      for await (const input of sock) {
        if (typeof(input) === "string") {
          console.log("INP:", input);
          await proc.stdin!.write(new TextEncoder().encode(input+"\n"));
        }
      }
    })();
    // Listen for Program Output
    (async()=>{
      for await (const output of Deno.iter(proc.stdout!)) {
        await sock.send(output);
      }
    })();
    const status = await proc.status();
    console.log(status);
    console.log("done");
    sock.close();
    proc.close();
  }
}
