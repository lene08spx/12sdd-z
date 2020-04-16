// log: first kinda working lexer/parser.
// when parsing list of instructions. if malformed, consider gibberish until ":" OR end-of-scope keyword that's valid (not without opener)
// LOG :: Stack was breaking scope each time, added stackcanbreak to keep track of uses of parseInstructions (a new scope)
import { decode, encode } from "https://deno.land/std@v0.40.0/encoding/utf8.ts";
import { BufReader } from "https://deno.land/std@v0.40.0/io/mod.ts";

const TOKEN_RULES: Record<Token["type"],string> = {
  "keyword": "(PROG|ENDPROG|SWITCH|WHEN|DO|ENDDO|ENDSWITCH|IF|OTHERWISE|ENDIF|FOR|FROM|TO|BY|ENDFOR|UNTIL|ENDWHEN|OUT|IN)\\b",
  "number": "([0-9]+)(\\.[0-9]+)?",
  "math": "\\+|\\-|\\*|\\/",
  "compare": "<=|>=|<|>|==|&&|\\|\\||!|(AND|NOT|OR)\\b",
  "special": ":|\\[|\\]|=",
  "string": "\"([\x20\x21\x23-\x7E])*\"",
  "variable": "([A-Z]([0-9])*)\\b",
  "generic": "([A-Z]+)\\b",
  "invalid": "[^\\s]+"
};
/*
window.onload = async()=>{
  const sourceFile = await Deno.open("test1.z");
  const lexer = new Lexer(TOKEN_RULES);
  const tokens = await lexer.lex(sourceFile);
  console.log(tokens);
  console.log("--------");
  const parser = new ZedParser();
  const parseResult = parser.parse(tokens);
  console.log(parseResult.program);
  if (parseResult.errors.length) console.log("Compiler Errors:");
  for (let e of parseResult.errors) {
    console.log(" -", e.name.padEnd(20, " "), e.message);
  }
  console.log("--------");
  const compiler = new PythonCompiler();
  const pythonObjectFile = compiler.compile(parseResult.program);
  console.log(pythonObjectFile);
}*/

export async function zedCompiler(o: {
  src: string;
  dst: string;
}): Promise<void> {
  const sourceFile = await Deno.open(o.src);
  const lexer = new Lexer(TOKEN_RULES);
  const tokens = await lexer.lex(sourceFile);
  //console.log(tokens);
  //console.log("--------");
  const parser = new ZedParser();
  const parseResult = parser.parse(tokens);
  //console.log(parseResult.program);
  if (parseResult.errors.length) console.log("Compiler Errors:");
  for (let e of parseResult.errors) {
    console.log(" -", e.name.padEnd(20, " "), e.message);
  }
  //console.log("--------");
  const compiler = new PythonCompiler();
  const pythonObjectFile = compiler.compile(parseResult.program);
  //console.log(pythonObjectFile);
  await Deno.writeFile(o.dst, encode(pythonObjectFile));
}

interface Token {
  type: "keyword" | "number" | "math" | "compare" | "special" | "string" | "variable" | "generic" | "invalid";
  value: string;
  line: number;
}

class Lexer {
  tokenRegex: RegExp;
  constructor(rules: Record<string, string>) {
    const zedRegexItems: string[] = [];
    for (let [k, v] of Object.entries(rules)) zedRegexItems.push(`(?<${k}>${v})`);
    this.tokenRegex = new RegExp(`(${zedRegexItems.join("|")})`,"g");
  }
  /** Get the Token-Type by the available RegEx groups. */
  private getToken(regexGroups: Record<string,string>): Token {
    for (let [k,v] of Object.entries(regexGroups)) {
      // The only available group is not undefined.
      if (v !== undefined) return {type: k, value: v, line: 0} as Token;
    }
    // All items should be captured in groups, otherwise throw error.
    throw new Error("Ungrouped Token");
  }
  /** Analyse a file, and output a list of tokens. */
  async lex(r: Deno.Reader): Promise<Token[]> {
    const bufReader = new BufReader(r);
    const tokenList: Token[] = [];
    let currLineNumber = 0;
    let lineResult = await bufReader.readLine();
    while (lineResult !== Deno.EOF) {
      currLineNumber++;
      /* perform regex test */
      const testResult = decode(lineResult.line).matchAll(this.tokenRegex);
      for (const match of testResult) {
        const tok = this.getToken(match.groups!);
        tok.line = currLineNumber;
        tokenList.push(tok);
      }
      /* prep new line */
      lineResult = await bufReader.readLine();
    }
    return tokenList;
  }
}

namespace Syntax {
  export interface Program {
    type: "program";
    name: string;
    code: Instruction[];
  }
  export interface Condition {
    type: "condition";
    operator: string;
    invert: boolean;
    left: Condition | Value | Variable;
    right: Condition | Value | Variable;
  }
  export interface Input {
    type: "input";
    prompt: string;
  }
  export interface PreTest {
    type: "preTest";
    condition: Condition;
    code: Instruction[];
  }
  export interface PostTest {
    type: "postTest";
    condition: Condition;
    code: Instruction[];
  }
  export interface CountLoop {
    type: "countLoop";
    variable: Variable;
    from: number;
    to: number;
    by: number;
    code: Instruction[];
  }
  export interface Select {
    type: "select";
    condition: Condition;
    trueCode: Instruction[];
    falseCode?: Instruction[];
  }
  export interface Switch {
    type: "switch";
    variable: Variable;
    whenValueThenCode: [Value, Instruction[]][];
  }
  export interface Assign {
    type: "assign";
    variable: Variable;
    value: Variable | Value | Input;
    operator?: string;
  }
  export interface Output {
    type: "output";
    values: (Value|Variable)[];
  }
  export type Value = string | number;
  export interface Variable { identifier: string };
  export type Instruction = PreTest | PostTest | CountLoop | Select | Switch | Assign | Output;
  export type Structure = Instruction | Program | Condition | Input ;
}

// Two Classes of Syntax Errors
// ParserError: Unhandled or Invalid Structure or Token
// TokenError: Invalid User Input / Wrong Order

class TokenError extends Error {
  name = "TokenError";
  constructor(t: Token, message: string = ""){
    super(`Unexpected '${t.value}' on line ${t.line}.${message?" "+message+".":""}`);
  }
}
class ParserError extends Error {
  name = "ParserError";
  constructor(message?: string){
    super(message);
  }
}
class UnhandledTokenError extends Error {
  name = "UnhandledTokenError";
  constructor(t: Token, message?: string){
    super(`Unhandled '${t.value}' on line ${t.line}.${message?" "+message+".":""}`);
  }
}
class UnclosedScopeError extends Error {
  name = "UnclosedScopeError";
  constructor(message?: string){
    super(message);
  }
}
class EndOfTokensError extends Error {
  name = "EndOfTokensError";
  constructor(){
    super("Reached end of program unexpectedly.");
  }
}
/*
class FatalError extends Error {
  name = "FatalError";
  constructor(message?: string){
    super(message);
  }
}*/

interface ParserResult {
  program: Syntax.Program;
  errors: Error[];
}

class ZedParser {
  private scopeStack: string[] = [];
  private scopeCanBreakStack: boolean[] = [];// boolean whether it can break the instruction parsing
  private errorsCache: Error[] = [];
  public parse(tokenList: Token[]): ParserResult {
    this.scopeStack = [];
    this.scopeCanBreakStack = [];
    this.errorsCache = [];
    if (!this.testToken(tokenList[0], "keyword", "PROG")) throw new TokenError(tokenList[0], "A Z program must start with 'PROG'");
    tokenList.shift();
    const name = this.getAssertedToken(tokenList.shift()!, "generic");
    this.scopeStack.push("ENDPROG");
    this.scopeCanBreakStack.push(true);
    let code = this.parseInstructions(tokenList);
    return {
      program: {
        type: "program",
        name: name,
        code
      },
      errors: Object.create(this.errorsCache)
    }
  }

  private testToken(t: Token, expectedType: Token["type"], expectedValue?: string): boolean {
    if (t === undefined) throw new EndOfTokensError();
    if (expectedValue !== undefined && t.value === expectedValue) return true;
    else if (expectedValue !== undefined) return false;
    if (t.type === expectedType) return true;
    return false;
  }
  
  private getAssertedToken(t: Token, expectedType: Token["type"]): string {
    if (!this.testToken(t, expectedType)) throw new TokenError(t);
    return t.value;
  }

  private assertEndOfInstruction(t: Token[], doThrow = true): void {
    if (!this.testToken(t[0], "special", ":")) {
      if (doThrow) throw new TokenError(t[0], "An INSTRUCTION must be terminated with ':'. Check the previous line.");
    }
    else t.shift();
  }

  /** Magic Function... Detects what the structure is coming up. */
  private parseInstructions(t: Token[]): Syntax.Instruction[] {
    const code: Syntax.Instruction[] = [];
    while (true) {
      try {
        if (t.length === 0) {
          this.errorsCache.push(new UnclosedScopeError("Missing Keywords: "+this.scopeStack.join(", ")))
          this.errorsCache.push(new EndOfTokensError());
          return code;
        }
        // Test for empty instruction
        this.assertEndOfInstruction(t, false);
        // test for end-of-scope
        if (this.scopeStack.includes(t[0].value)) {
          const scopeIndex = this.scopeStack.lastIndexOf(t[0].value);
          const unclosedScopes = this.scopeStack.slice(scopeIndex+1);
          // if unclosed scopes, error and say they must be closed
          if (unclosedScopes.length > 0) {
            this.errorsCache.push(new UnclosedScopeError("Expected "+this.scopeStack.pop()+" before '"+this.scopeStack[scopeIndex]+"' on line "+String(t[0].line)+"."));
            if (this.scopeCanBreakStack.pop()) break;
          } else {
            t.shift();
            this.scopeStack.pop();
            if (this.scopeCanBreakStack.pop()) break;
          }
        } else {
          // attempt to parse instruction
          // if token error, try again until successful structure and if not preceeded by end of instruction then syntax error.
          let instruction: Syntax.Instruction | null = null;
          if (instruction === null) try { instruction = this.parseAssign(t); this.assertEndOfInstruction(t); } catch (e) { if (!(e instanceof ParserError)) throw e; };
          if (instruction === null) try { instruction = this.parseOutput(t); this.assertEndOfInstruction(t); } catch (e) { if (!(e instanceof ParserError)) throw e; };
          if (instruction === null) try { instruction = this.parsePreTest(t); this.assertEndOfInstruction(t, false); } catch (e) { if (!(e instanceof ParserError)) throw e; };
          if (instruction === null) try { instruction = this.parsePostTest(t); this.assertEndOfInstruction(t, false); } catch (e) { if (!(e instanceof ParserError)) throw e; };
          if (instruction === null) try { instruction = this.parseCountLoop(t); this.assertEndOfInstruction(t, false); } catch (e) { if (!(e instanceof ParserError)) throw e; };
          if (instruction === null) try { instruction = this.parseSelect(t); this.assertEndOfInstruction(t, false); } catch (e) { if (!(e instanceof ParserError)) throw e; };
          if (instruction === null) try { instruction = this.parseSwitch(t); this.assertEndOfInstruction(t, false); } catch (e) { if (!(e instanceof ParserError)) throw e; };
          if (instruction !== null) code.push(instruction);
          else throw new UnhandledTokenError(t.shift()!);
        }
      } catch (e) {
        //console.log(e.stack)
        this.errorsCache.push(e);
      }
    }
    return code;
  }

  private parseAssign(t: Token[]): Syntax.Assign {
    if (!this.testToken(t[0], "special", "=")) throw new ParserError("Not an Assign"); t.shift();
    const varIdentifer = this.getAssertedToken(t[0], "variable");
    t.shift();
    let assignValue: Syntax.Assign["value"];
    if (this.testToken(t[0], "variable")) {
      assignValue = {
        identifier: t.shift()!.value
      } as Syntax.Variable;
    }
    else if (this.testToken(t[0], "string")) {
      assignValue = t.shift()!.value;
    }
    else if (this.testToken(t[0], "number")) {
      assignValue = Number(t.shift()!.value);
    }
    else if (this.testToken(t[0], "keyword", "IN")) {
      assignValue = this.parseInput(t);
    }
    else {
      throw new TokenError(t[0], "Missing Assignment Value");
    }
    let operator: string | undefined = undefined;
    if (this.testToken(t[0], "math")) {
      operator = t.shift()!.value!;
    }
    return {
      type: "assign",
      variable: { identifier: varIdentifer },
      value: assignValue,
      operator: operator
    };
  }

  private parseInput(t: Token[]): Syntax.Input {
    if (!this.testToken(t[0], "keyword", "IN")) throw new ParserError("Not an Input");
    t.shift();
    if (this.getAssertedToken(t[0], "special") !== "[") throw new TokenError(t[0]);
    t.shift();
    const inputPrompt = this.getAssertedToken(t[0], "string");
    t.shift();
    if (this.getAssertedToken(t[0], "special") !== "]") throw new TokenError(t[0]);
    t.shift();
    return {
      type: "input",
      prompt: inputPrompt
    };
  }

  private parseCondition(t: Token[]): Syntax.Condition {
    let invert = false;
    if (this.testToken(t[0], "compare", "!") || this.testToken(t[0], "compare", "NOT")) {
      t.shift();
      invert = true;
      if (!this.testToken(t[0], "compare")) throw new TokenError(t[0], "NOT or ! must be followed by a comparison operator.");
    }
    if (!this.testToken(t[0], "compare")) throw new ParserError("Not a Condition");
    let operator = t.shift()!.value;
    let leftTerm: Syntax.Condition["left"];
    if (this.testToken(t[0], "variable")) leftTerm = { identifier: t.shift()!.value } as Syntax.Variable;
    else if (this.testToken(t[0], "string")) leftTerm = t.shift()!.value;
    else if (this.testToken(t[0], "number")) leftTerm = Number(t.shift()!.value);
    else {
      try {
        leftTerm = this.parseCondition(t);
      } catch (e) {
        if (!(e instanceof ParserError)) throw e;
        else throw new TokenError(t[0])
      };
    }
    let rightTerm: Syntax.Condition["right"];
    if (this.testToken(t[0], "variable")) rightTerm = { identifier: t.shift()!.value } as Syntax.Variable;
    else if (this.testToken(t[0], "string")) rightTerm = t.shift()!.value;
    else if (this.testToken(t[0], "number")) rightTerm = Number(t.shift()!.value);
    else {
      try {
        rightTerm = this.parseCondition(t);
      } catch (e) {
        if (!(e instanceof ParserError)) throw e;
        else throw new TokenError(t[0])
      };
    }
    return {
      type: "condition",
      invert: invert,
      left: leftTerm,
      right: rightTerm,
      operator: operator
    }
  }

  private parseDo(t: Token[]): Syntax.Instruction[] {
    if (!this.testToken(t[0], "keyword", "DO")) throw new TokenError(t[0], "Expected DO clause.");
    t.shift();
    this.scopeStack.push("ENDDO");
    this.scopeCanBreakStack.push(true);
    const code = this.parseInstructions(t);
    return code;
  }

  private parsePreTest(t: Token[]): Syntax.PreTest {
    if (!this.testToken(t[0], "keyword", "WHEN")) throw new ParserError("Not a PreTest");
    t.shift();
    const condition = this.parseCondition(t);
    this.scopeStack.push("ENDWHEN");
    this.scopeCanBreakStack.push(false);
    const code = this.parseDo(t);
    //if (!testToken(t[0], "keyword", "ENDWHEN")) throw new TokenError(t[0], "Expected ENDWHEN");
    //t.shift();
    return {
      type: "preTest",
      condition: condition,
      code: code
    };
  }
  
  private parseOutput(t: Token[]): Syntax.Output {
    if (!this.testToken(t[0], "keyword", "OUT")) throw new ParserError("Not an Output");
    t.shift();
    if (this.getAssertedToken(t[0], "special") !== "[") throw new TokenError(t[0]);
    t.shift();
    const outputItems: (Syntax.Value|Syntax.Variable)[] = [];
    // test for mandatory value
    if (this.testToken(t[0], "variable")) outputItems.push({ identifier: t.shift()!.value });
    else if (this.testToken(t[0], "number")) outputItems.push(Number(t.shift()!.value));
    else if (this.testToken(t[0], "string")) outputItems.push(t.shift()!.value);
    else throw new TokenError(t[0], "Missing mandatory Output value.");
    // test for optional extra values
    while (!this.testToken(t[0], "special", "]")) {
      if (!this.testToken(t[0], "math", "+")) throw new TokenError(t[0], "Concatenate items in Output with '+'");
      t.shift();
      // test for mandatory value
      if (this.testToken(t[0], "variable")) outputItems.push({ identifier: t.shift()!.value });
      else if (this.testToken(t[0], "number")) outputItems.push(Number(t.shift()!.value));
      else if (this.testToken(t[0], "string")) outputItems.push(t.shift()!.value);
      else throw new TokenError(t[0], "Missing another Output value after '+");
    }
    t.shift();
    return {
      type: "output",
      values: outputItems
    };
  }
  
  private parsePostTest(t: Token[]): Syntax.PostTest {
    if (!this.testToken(t[0], "keyword", "DO")) throw new ParserError("Not a PostTest");
    t.shift();
    this.scopeStack.push("UNTIL");
    this.scopeCanBreakStack.push(true);
    const code = this.parseInstructions(t);
    const condition = this.parseCondition(t);
    return {
      type: "postTest",
      code,
      condition
    };
  }

  /** LOG:: FORGOT TO CHECK FOR FROM, TO, BY, KEYWORDS */
  private parseCountLoop(t: Token[]): Syntax.CountLoop {
    if (!this.testToken(t[0], "keyword", "FOR")) throw new ParserError("Not a CountLoop");
    t.shift();
    const variable = { identifier: this.getAssertedToken(t[0], "variable") };
    t.shift();
    if (!this.testToken(t[0], "keyword", "FROM")) throw new TokenError(t[0], "Expected 'FROM'");
    t.shift();
    const from = Number(this.getAssertedToken(t[0], "number"));
    t.shift();
    if (!this.testToken(t[0], "keyword", "TO")) throw new TokenError(t[0], "Expected 'TO'");
    t.shift();
    const to = Number(this.getAssertedToken(t[0], "number"));
    t.shift();
    if (!this.testToken(t[0], "keyword", "BY")) throw new TokenError(t[0], "Expected 'BY'");
    t.shift();
    const by = Number(this.getAssertedToken(t[0], "number"));
    t.shift();
    this.scopeStack.push("ENDFOR");
    this.scopeCanBreakStack.push(false);
    const code = this.parseDo(t);
    return {
      type: "countLoop",
      variable,
      from,
      to,
      by,
      code
    };
  }

  private parseSelect(t: Token[]): Syntax.Select {
    if (!this.testToken(t[0], "keyword", "IF")) throw new ParserError("Not a Select");
    t.shift();
    this.scopeStack.push("ENDIF");
    this.scopeCanBreakStack.push(false);
    const condition = this.parseCondition(t);
    const trueCode = this.parseDo(t);
    let falseCode: Syntax.Instruction[] | undefined = undefined;
    if (this.testToken(t[0], "keyword", "OTHERWISE")) {
      t.shift();
      falseCode = this.parseDo(t);
    }
    return {
      type: "select",
      condition,
      trueCode,
      falseCode
    };
  }

  private parseSwitch(t: Token[]): Syntax.Switch {
    if (!this.testToken(t[0], "keyword", "SWITCH")) throw new ParserError("Not a Select");
    t.shift();
    this.scopeStack.push("ENDSWITCH");
    this.scopeCanBreakStack.push(false);
    const variable = { identifier: this.getAssertedToken(t[0], "variable") };
    t.shift();
    if (this.testToken(t[0], "keyword", "ENDSWITCH")) return {type:"switch",variable,whenValueThenCode:[]};
    const whenValueThenCode: [string|number, Syntax.Instruction[]][] = [];
    while (true) {
      if (this.testToken(t[0], "keyword", "ENDSWITCH")) break; 
      if (!this.testToken(t[0], "keyword", "WHEN")) throw new TokenError(t[0], "Expected 'WHEN'");
      t.shift();
      let value: string | number;
      if (this.testToken(t[0], "string")) {
        value = t.shift()!.value;
      } else if (this.testToken(t[0], "number")) {
        value = Number(t.shift()!.value);
      } else throw new TokenError(t[0], "SWITCHes only on a String or Number");
      const thenCode = this.parseDo(t);
      whenValueThenCode.push([value, thenCode]);
    }
    return {
      type: "switch",
      variable,
      whenValueThenCode
    };
  }
}

let a: Syntax.Structure;

class PythonCompiler {
  private indentLevel = 0;

  compile(p: Syntax.Program): string {
    this.indentLevel = 0;
    let output = "";
    output += `def zedInput(prompt):\n`;
    output += ` _in=input(prompt)\n`;
    output += ` try: return int(_in)\n`;
    output += ` except: return _in\n\n`;
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
    let output = "";
    for (let c of code) {
      output += this.compileStructure(c);
    }
    return output;
  }
  private compileStructure(s: Syntax.Structure): string {
    switch (s.type) {
      case "preTest": return this.compilePreTest(s);
      case "postTest": return this.compilePostTest(s);
      case "countLoop": return this.compileCountLoop(s);
      case "select": return this.compileSelect(s);
      case "switch": return this.compileSwitch(s);
      case "assign": return this.compileAssign(s);
      case "output": return this.compileOutput(s);
      case "condition": return this.compileCondition(s);
      case "input": return this.compileInput(s);
    }
    return '';
  }
  private compileCondition(s: Syntax.Condition): string {
    s.operator = s.operator.replace("&&", "and");
    s.operator = s.operator.replace("||", "or");
    s.operator = s.operator.replace("AND", "and");
    s.operator = s.operator.replace("OR", "or");
    let left: any;
    let right: any;
    if ((s.left as Syntax.Condition).type === "condition") left = this.compileCondition(s.left as Syntax.Condition);
    else left = (s.left as any)["identifier"] ?? s.left;
    if ((s.right as Syntax.Condition).type === "condition") right = this.compileCondition(s.right as Syntax.Condition);
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
    output += this.indent(`for ${s.variable.identifier} in range(${s.from},${s.to},${s.by}):\n`);
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
      output += this.indent(`if ${s.variable.identifier}==${valCode[0]}:\n`);
      this.indentLevel++;
      output += this.compileCodeLines(valCode[1]);
      this.indentLevel--;
    }
    return output+"\n";
  }
  private compileAssign(s: Syntax.Assign): string {
    let value = "";
    if ((s.value as Syntax.Variable).identifier !== undefined) value = (s.value as Syntax.Variable).identifier;
    else if ((s.value as Syntax.Input).prompt !== undefined) value = this.compileInput(s.value as Syntax.Input);
    else value = String(s.value);
    return this.indent(`${s.variable.identifier}${s.operator?s.operator:""}=${value}\n`);
  }
  private compileOutput(s: Syntax.Output): string {
    let output = this.indent("print(");
    for (let val of s.values) {
      if ((val as Syntax.Variable).identifier !== undefined) output += (val as Syntax.Variable).identifier+",";
      else output += `str(${val}),`;
    }
    return output+")\n";
  }
}
