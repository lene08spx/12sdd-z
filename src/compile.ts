import { encode } from "./deps.ts";
import { Syntax } from "./parse.ts";

class PythonTarget {
  private indentLevel = 0;
  compile(p: Syntax.Program): string {
    this.indentLevel = 0;
    let output = "";
    output +=
`def zedInput(prompt):
 _in=input(prompt)
 try:
  return int(_in)
 except:
  try:
   return float(_in)
  except:
   return _in

def zedAssign(var,val):
 if type(var) == int:
  return int(val)
 elif type(var) == float:
  return float(val)
 elif type(var) == str:
  return str(val)
 raise "OOPS"\n\n`;
    output += `def ${p.name}():\n`;
    this.indentLevel++;
    output += this.compileCodeLines(p.code);
    this.indentLevel--;
    output += `${p.name}()\n`;
    return output;
  }
  private indent(s: string): string {
    return "".padStart(this.indentLevel, " ")+s;
  }
  private compileCodeLines(code: Syntax.Instruction[]): string {
    if (code.length === 0) return this.indent("pass");
    let output = "";
    for (let c of code) {
      output += this.compileStructure(c);
    }
    return output;
  }
  private compileStructure(s: Syntax.Structure): string {
    if (s instanceof Syntax.Input) return this.compileInput(s);
    if (s instanceof Syntax.Condition) return this.compileCondition(s);
    if (s instanceof Syntax.Assign) return this.compileAssign(s);
    if (s instanceof Syntax.Output) return this.compileOutput(s);
    if (s instanceof Syntax.PreTest) return this.compilePreTest(s);
    if (s instanceof Syntax.PostTest) return this.compilePostTest(s);
    if (s instanceof Syntax.CountLoop) return this.compileCountLoop(s);
    if (s instanceof Syntax.Select) return this.compileSelect(s);
    if (s instanceof Syntax.Switch) return this.compileSwitch(s);
    return '';
  }
  private compileCondition(s: Syntax.Condition): string {
    s.operator = s.operator.replace("&&", "and");
    s.operator = s.operator.replace("||", "or");
    s.operator = s.operator.replace("AND", "and");
    s.operator = s.operator.replace("OR", "or");
    let left: any;
    let right: any;
    if (s.left instanceof Syntax.Condition) left = this.compileCondition(s.left);
    else left = (s.left as any)["identifier"] ?? s.left;
    if (s.right instanceof Syntax.Condition) right = this.compileCondition(s.right);
    else right = (s.right as any)["identifier"] ?? s.right;
    return `${s.invert?"not":""}(${left}${s.operator}${right})`;
  }
  private compileInput(s: Syntax.Input): string {
    return `zedInput(${s.prompt})`;
  }
  private compilePreTest(s: Syntax.PreTest): string {
    let output = "";
    output += this.indent(`while ${this.compileCondition(s.condition)}:\n`);
    this.indentLevel++;
    output += this.compileCodeLines(s.code);
    this.indentLevel--;
    return output+"\n";
  }
  private compilePostTest(s: Syntax.PostTest): string {
    let output = "";
    output += this.indent(`while True:\n`);
    this.indentLevel++;
    output += this.compileCodeLines(s.code);
    output += this.indent(`if ${this.compileCondition(s.condition)}: break\n`);
    this.indentLevel--;
    return output+"\n";
  }
  private compileCountLoop(s: Syntax.CountLoop): string {
    let output = "";
    output += this.indent(`for ${s.variable} in range(${s.from},${s.to},${s.by}):\n`);
    this.indentLevel++;
    output += this.compileCodeLines(s.code);
    this.indentLevel--;
    return output+"\n";
  }
  private compileSelect(s: Syntax.Select): string {
    let output = "";
    output += this.indent(`if ${this.compileCondition(s.condition)}:\n`);
    this.indentLevel++;
    output += this.compileCodeLines(s.trueCode);
    this.indentLevel--;
    if (s.falseCode !== undefined && s.falseCode.length > 0 ) {
      output += this.indent(`else:\n`);
      this.indentLevel++;
      output += this.compileCodeLines(s.falseCode);
      this.indentLevel--;
    }
    return output;
  }
  private compileSwitch(s: Syntax.Switch): string {
    let output = "";
    for (let valCode of s.whenValueThenCode) {
      output += this.indent(`if ${s.variable}==${valCode[0]}:\n`);
      this.indentLevel++;
      output += this.compileCodeLines(valCode[1]);
      this.indentLevel--;
    }
    return output+"\n";
  }
  private compileAssign(s: Syntax.Assign): string {
    let value = "";
    if (s.value instanceof Syntax.ZedVariable) value = s.value as string;
    else if (s.value instanceof Syntax.Input) value = this.compileInput(s.value);
    else value = String(s.value);
    if (s.operator !== undefined) {
      return this.indent(`${s.variable}${s.operator?s.operator:""}=zedAssign(${s.variable},${value})\n`);
    } else {
      return this.indent(`${s.variable}${s.operator?s.operator:""}=${value}\n`);
    }
  }
  private compileOutput(s: Syntax.Output): string {
    let output = this.indent("print(");
    for (let val of s.values) {
      if (val instanceof Syntax.ZedVariable) output += val+",";
      else output += `${val},`;
    }
    return output+")\n";
  }
}

const compileTargets = {
  "python3": new PythonTarget()
}

//returns number of bytes written
export async function compile(p: Syntax.Program, w: Deno.Writer, target: keyof typeof compileTargets) {
  return out.write(encode(compileTargets[target].compile(p)));
}
