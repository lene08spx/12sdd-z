import { Syntax } from "./parse.ts";

const compileTargets = {
  "python3": 2;
}

export async function compile(p: Syntax.Program, out: Deno.Writer, target: keyof typeof compileTargets) {

}