import { encode } from "./deps.ts";
import { Syntax } from "./parse.ts";

class PythonTarget {
  private indentLevel = 0;
  public readonly buffer = new Deno.Buffer();
  constructor(p: Syntax.Program) {
    this.indentLevel = 0;
    // special runtime functions for Zed-Language features.
    this.buffer.writeSync(encode("def zedInput(prompt):\n _in=input(prompt)\n try:\n  return int(_in)\n except:\n  try:\n    return float(_in)\n  except:\n   return _in\n"));
    this.buffer.writeSync(encode("def zedCast(var,val):\n if type(var) == int:\n  return int(val)\n elif type(var) == float:\n  return float(val)\n elif type(var) == str:\n  return str(val)\n raise 'OOPS'\n"));
    // definition of function
    this.buffer.writeSync(encode(`def ${p.name}():\n`));
    this.indentLevel++;
    // mainline
    this.compileCodeLines(p.code);
    this.indentLevel--;
    // call the main function
    this.buffer.writeSync(encode(`${p.name}()\n`));
  }
  private indent(s: string): Uint8Array {
    return encode("".padStart(this.indentLevel, " ")+s);
  }
  private compileCodeLines(code: Syntax.Instruction[]): void {
    if (code.length === 0) this.buffer.writeSync(this.indent("pass"));
    for (let c of code) {
      this.compileStructure(c);
    }
  }
  private compileStructure(s: Syntax.Structure): void {
    if (s instanceof Syntax.Input) this.compileInput(s);
    if (s instanceof Syntax.Condition) this.compileCondition(s);
    if (s instanceof Syntax.Assign) this.compileAssign(s);
    if (s instanceof Syntax.Output) this.compileOutput(s);
    if (s instanceof Syntax.PreTest) this.compilePreTest(s);
    if (s instanceof Syntax.PostTest) this.compilePostTest(s);
    if (s instanceof Syntax.CountLoop) this.compileCountLoop(s);
    if (s instanceof Syntax.Select) this.compileSelect(s);
    if (s instanceof Syntax.Switch) this.compileSwitch(s);
  }
  private compileCondition(s: Syntax.Condition): void {
    s.operator = s.operator
      .replace("&&", "and")
      .replace("||", "or")
      .replace("AND", "and")
      .replace("OR", "or");
    // invert and condition grouping open
    this.buffer.writeSync(encode(`${s.invert?" not":""}(`));
    // left condition
    if (s.left instanceof Syntax.Condition) this.compileCondition(s.left);
    else this.buffer.writeSync(encode(s.left.toString()));
    // operator
    this.buffer.writeSync(encode(s.operator));
    // right condition
    if (s.right instanceof Syntax.Condition) this.compileCondition(s.right);
    else this.buffer.writeSync(encode(s.right.toString()));
    // close condition
    this.buffer.writeSync(encode(")"));
  }
  private compileInput(s: Syntax.Input): string {
    return `zedInput(${s.prompt})`;
  }
  private compilePreTest(s: Syntax.PreTest): void {
    this.buffer.writeSync(this.indent(`while`));
    this.compileCondition(s.condition);
    this.buffer.writeSync(encode(`:\n`));
    this.indentLevel++;
    this.compileCodeLines(s.code);
    this.indentLevel--;
  }
  private compilePostTest(s: Syntax.PostTest): void {
    this.buffer.writeSync(this.indent(`while True:\n`));
    this.indentLevel++;
    this.compileCodeLines(s.code);
    this.buffer.writeSync(this.indent(`if`));
    this.compileCondition(s.condition);
    this.buffer.writeSync(encode(`:break\n`));
    this.indentLevel--;
  }
  private compileCountLoop(s: Syntax.CountLoop): void {
    this.buffer.writeSync(this.indent(`for ${s.variable} in range(${s.from},${s.to},${s.by}):\n`));
    this.indentLevel++;
    this.compileCodeLines(s.code);
    this.indentLevel--;
  }
  private compileSelect(s: Syntax.Select): void {
    this.buffer.writeSync(this.indent(`if`));
    this.compileCondition(s.condition);
    this.buffer.writeSync(encode(`:\n`));
    this.indentLevel++;
    this.compileCodeLines(s.trueCode);
    this.indentLevel--;
    if (s.falseCode !== undefined && s.falseCode.length > 0 ) {
      this.buffer.writeSync(this.indent(`else:\n`));
      this.indentLevel++;
      this.compileCodeLines(s.falseCode);
      this.indentLevel--;
    }
  }
  private compileSwitch(s: Syntax.Switch): void {
    for (let valCode of s.whenValueThenCode) {
      this.buffer.writeSync(this.indent(`if ${s.variable}==${valCode[0]}:\n`));
      this.indentLevel++;
      this.compileCodeLines(valCode[1]);
      this.indentLevel--;
    }
  }
  private compileAssign(s: Syntax.Assign): void {
    let value = "";
    if (s.value instanceof Syntax.ZedVariable) value = s.value as string;
    else if (s.value instanceof Syntax.Input) value = this.compileInput(s.value);
    else value = String(s.value);
    if (s.operator !== undefined) {
      this.buffer.writeSync(this.indent(`${s.variable}${s.operator?s.operator:""}=zedCast(${s.variable},${value})\n`));
    } else {
      this.buffer.writeSync(this.indent(`${s.variable}=${value}\n`));
    }
  }
  private compileOutput(s: Syntax.Output): void {
    this.buffer.writeSync(this.indent("print("));
    for (let val of s.values) {
      this.buffer.writeSync(encode(`${val},`));
    }
    this.buffer.writeSync(encode("sep='')\n"));
  }
}

const compileTargets = {
  "python3": PythonTarget
};

//returns number of bytes written
export function compile(p: Syntax.Program, target: keyof typeof compileTargets = "python3"): Deno.Buffer {
  return new compileTargets[target](p).buffer;
}
