import { lex } from "./lex.ts";
import { parse } from "./parse.ts";
import { compile } from "./compile.ts";

const zedConfig = {
  name: "zed",
  version: "v0.0.1",
  description: "A compiler for the Z Programming Language"
};

// returns number of bytes written.
export async function zedCompile(src: Deno.Reader, out: Deno.Writer): Promise<number> {
  return await compile(parse(await lex(src)), out, "python3");
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
        console.log("Compiling...", filename)
        const sourceFile = await Deno.open(filename);
        const tempFile = await Deno.makeTempFile();
        await zedCompile(
          sourceFile,
          await Deno.create(tempFile)
        );
        console.log("Running...");
        const proc = Deno.run({
          cmd: ["python", tempFile]
        });
        await proc.status();
        await Deno.remove(tempFile);
        console.log("Done!");
      } else {
        console.log("Nothing to run.");
      }
    }
    else {
      printHelp();
    }
  }
}
