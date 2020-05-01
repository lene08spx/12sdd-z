import { lex } from "./lex.ts";
import { parse } from "./parse.ts";
import { compile } from "./compile.ts";


const ZedConfig = {
  name: "zed",
  version: "0.0.1",
  description: "A compiler for the Z Programming Language"
};

// returns number of bytes written.
export async function zedCompile(src: Deno.Reader, out: Deno.Writer): Promise<number> {
  return await compile(parse(await lex(src)), out, "python3");
}

if (import.meta.main) {
  let filename = Deno.args[0];
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
    console.log("Please specify a filename.");
  }
}
