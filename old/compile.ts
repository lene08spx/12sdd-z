import { Structure, Variable } from "./language.ts";

export interface Compiler {
  compile(s: Structure): string;
}

export class PythonCompiler implements Compiler {
  compile(s: Structure): string {
    if (s.type === "assign") {
      return `${s.variable}=${s.value}`
    }
    return "pass";
  }
}

const c = new PythonCompiler();
const pythonObjectFile = c.compile({
  type: "assign",
  variable: "A1" as Variable,
  value: 213
});

console.log(pythonObjectFile);
