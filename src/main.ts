import { lex } from "./lex.ts";
import { parse } from "./parse.ts";
import { compileToPython } from "./compile.ts";


const ZedConfig = {
  name: "zed",
  version: "0.0.1",
  description: "A compiler for the Z Programming Language"
};


function zedCompile(src: Deno.Reader, out: Deno.Writer) {
  const tokens = lex(src);
  const parseResult = parse(tokens);
  compileToPython(parseResult.tree, out);
}

