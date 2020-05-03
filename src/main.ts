import { lex } from "./lex.ts";
import { parse } from "./parse.ts";
import { compile } from "./compile.ts";
import { parsePath } from "./deps.ts";

export const zedConfig = {
  name: "zed",
  version: "v0.0.1",
  description: "A compiler for the Z Programming Language"
};

interface CompilationResult {
  buffer: Deno.Buffer;
  time: number;
}

// returns number of bytes written.
export async function zedCompile(filename: string): Promise<CompilationResult> {
  const startTime = Date.now();
  const source = await Deno.open(filename);
  const lexResult = await lex(source);
  const syntaxTree = parse(lexResult);
  const compileBuffer = compile(syntaxTree, "python3");
  const endTime = Date.now();
  return {
    buffer: compileBuffer,
    time: endTime-startTime
  };
}

function printHelp() {
  console.log(zedConfig.name, zedConfig.version);
  console.log(zedConfig.description);
  console.log();
  console.log("To compile and run a program:");
  console.log("  zed run ./program.z");
  console.log("To open the IDE:");
  console.log("  zed dev");
  console.log();
}

if (import.meta.main) {
  if (Deno.args.length === 0) {
    printHelp();
  }
  else {
    if (Deno.args[0] === "run") {
      let filename = Deno.args[1];
      if (filename && filename.endsWith(".z")) {
        // compile source
        console.log("Compile", parsePath(filename).base);
        const compileResult = await zedCompile(filename);
        console.log(`Took ${compileResult.time}ms.`);
        // hold output in temp-file
        const tempPath = await Deno.makeTempFile({prefix:"zed-obj-"});
        const tempFile = await Deno.copy(compileResult.buffer, await Deno.create(tempPath));
        const proc = Deno.run({
          cmd: ["python", tempPath]
        });
        await proc.status();
        await Deno.remove(tempPath);
      } else {
        console.log("Nothing to run.");
      }
    }
    else {
      printHelp();
    }
  }
}
