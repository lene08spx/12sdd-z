import { Sha1, StringReader } from "./deps.ts";
import { lex } from "./lex.ts";
import { parse } from "./parse.ts";
import { compile } from "./compile.ts";


/** An array of Compilation errors. */
export class CompileErrors extends Array<Error> {};

class ScriptHost {
  #scriptCache = new Map<string,string>();
  #hashGenerator = new Sha1();
  /** Compile and cache the result, returns the scriptID (a hash of the source).
   * If the script already exists, */
  async register(source: string): Promise<string | CompileErrors> {
    // Generate new SHA-1 hash from Zed source-code
    this.#hashGenerator.update(source);
    // Retrieve the hash, in a hex string
    const hash = this.#hashGenerator.hex();
    // Compile the source-code
    if (!this.#scriptCache.has(hash)) {
      // TODO->Lex should have a variant for lexing strings, so async not needed
      const tokens = await lex(new StringReader(source));
      const parseResult = parse(tokens);
      if (parseResult.errors.length > 0) return [/*Compilation Errors*/];
      const compileResult = compile(parseResult.program);
      // Update the cache with the compiled-code, mapped to the hash of the source code.
      this.#scriptCache.set(hash, new TextDecoder().decode(compileResult.bytes()));
    }
    return hash;
  }
  retrieve(hash: string) {
    return this.#scriptCache.get(hash);
  }
  
}

export const scriptHost = new ScriptHost();
