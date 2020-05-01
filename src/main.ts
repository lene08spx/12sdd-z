import { lex } from "./lex.ts";
import { parse } from "./parse.ts";
import { compile } from "./compile.ts";


const ZedConfig = {
  name: "zed",
  version: "0.0.1",
  description: "A compiler for the Z Programming Language"
};


async function zedCompile(src: Deno.Reader, out: Deno.Writer) {
  await compile(parse(await lex(src)), out, "python3");
}

zedCompile(await Deno.open("fizzbuzz.z"), await Deno.create("fizz_redone.py"));