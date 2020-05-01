import { lex } from "./lex.ts";
import { parse } from "./parse.ts";
//import { compileToPython } from "./compile.ts";


const ZedConfig = {
  name: "zed",
  version: "0.0.1",
  description: "A compiler for the Z Programming Language"
};


async function zedCompile(src: Deno.Reader, out: Deno.Writer) {
  const tokens = await lex(src);
  const parseResult = parse(tokens);
  //compileToPython(parseResult, out);
}

const tokens = await lex(await Deno.open("fizzbuzz.z"));
const parseResult = parse(tokens);
console.log(parseResult["code"]);
