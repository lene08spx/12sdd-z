// log: first kinda working lexer/parser.
// when parsing list of instructions. if malformed, consider gibberish until ":" OR end-of-scope keyword that's valid (not without opener)

import { decode } from "https://deno.land/std@v0.40.0/encoding/utf8.ts";
import { BufReader } from "https://deno.land/std@v0.40.0/io/mod.ts";

export const TOKEN_RULES: Record<Token["type"],string> = {
  "keyword": "(PROG|ENDPROG|SWITCH|WHEN|DO|ENDDO|ENDSWITCH|IF|OTHERWISE|ENDIF|FOR|FROM|TO|BY|ENDFOR|UNTIL|ENDWHEN|OUT|IN)\\b",
  "number": "([0-9]+)(\\.[0-9]+)?",
  "math": "\\+|\\-|\\*|\\/",
  "compare": "<|>|<=|>=|==|&&|\\|\\||!|(AND|NOT|OR)\\b",
  "special": ":|\\[|\\]|=",
  "string": "\"([0-9A-Z. ])*\"",
  "variable": "([A-Z]([0-9])*)\\b",
  "generic": "([A-Z]+)\\b",
  "invalid": "[^\\s]+"
};

window.onload = async()=>{
  const sourceFile = await Deno.open("test.z");
  const lexer = new Lexer(TOKEN_RULES);
  const tokens = await lexer.lex(sourceFile);
  console.log(tokens);
  console.log("--------");
  const parser = new ZedParser();
  const program = parser.parse(tokens);
  console.log(program);
}

export interface Token {
  type: "keyword" | "number" | "math" | "compare" | "special" | "string" | "variable" | "generic" | "invalid";
  value: string;
  line: number;
}

export class Lexer {
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
  /** Analyse a file, and outpput a list of tokens. */
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
    whenValueThenCode: [Value, Instruction[]];
  }
  export interface Assign {
    type: "assign";
    variable: Variable;
    value: Variable | Value | Input;
    operator?: string;
  }
  export interface Output {
    type: "output";
    values: Value[];
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
    super(`Unexpected ${t.type} ${t.value} on line ${t.line}. ${message}.`);
  }
}
class ParserError extends Error {
  name = "ParserError";
  constructor(message?: string){
    super(message);
  }
}
/*
class FatalError extends Error {
  name = "FatalError";
  constructor(message?: string){
    super(message);
  }
}*/

function testToken(t: Token, expectedType: Token["type"], expectedValue?: string): boolean {
  if (expectedValue !== undefined && t.value === expectedValue) return true;
  else if (expectedValue !== undefined) return false;
  if (t.type === expectedType) return true;
  return false;
}

function getAssertedToken(t: Token, expectedType: Token["type"]): string {
  if (!testToken(t, expectedType)) throw new TokenError(t);
  return t.value;
}

class ZedParser {
  private contextStack: string[] = [];
  /** function that checks for instruction lists, waits for end of context stack */
  public parse(tokenList: Token[]): Syntax.Program {
    if (!testToken(tokenList[0], "keyword", "PROG")) throw new TokenError(tokenList[0], "A Z program must start with 'PROG'");
    tokenList.shift();
    const name = getAssertedToken(tokenList.shift()!, "generic");
    const code: Syntax.Instruction[] = [];
    while (true) {
      if (tokenList[0].value === "ENDPROG") break;
      try { code.push(this.parseInstruction(tokenList)); }
      catch (e) {
        // Represents issue with an unhandled token or structure.
        if (e instanceof ParserError) {
          const problem = tokenList.shift();
          console.log(e.name, e.message, problem?.type, problem?.value, problem?.line);
          //if (tokenList[0].value === "ENDPROG") break;
        }
        // represents an issue with user input in a handled structure.
        else if (e instanceof TokenError) {
          //catalog list of token errors.
          console.log(e.name, e.message);
        } else break;
      }
    }
    if (!testToken(tokenList[0], "keyword", "ENDPROG")) throw new TokenError(tokenList[0], "A Z program must end with 'ENDPROG'");
    return {
      type: "program",
      name: name,
      code
    } as Syntax.Program;
  }

  private assertEndOfInstruction(t: Token[], doThrow = true): void {
    if (!testToken(t[0], "special", ":")) {
      if (doThrow) throw new TokenError(t[0], "An INSTRUCTION must be terminated with ':'");
    }
    else t.shift();
  }

  /** Magic Function... Detects what the structure is coming up. */
  private parseInstruction(t: Token[]): Syntax.Instruction {
    let returnValue: Syntax.Instruction | null = null;

    // attempt to parse the token
    if (returnValue === null) try { returnValue = this.parseAssign(t); this.assertEndOfInstruction(t); } catch (e) { if (!(e instanceof ParserError)) throw e; };
    if (returnValue === null) try { returnValue = this.parseOutput(t); this.assertEndOfInstruction(t); } catch (e) { if (!(e instanceof ParserError)) throw e; };
    if (returnValue === null) try { returnValue = this.parsePreTest(t); this.assertEndOfInstruction(t, false); } catch (e) { if (!(e instanceof ParserError)) throw e; };

    // deal with any unhandled tokens
    if (returnValue !== null) return returnValue;
    else throw new ParserError("Unhandled Token");
    //else if (returnValue === null && t[0].value === "ENDPROG") throw new ParserError("End of Instructions");
    //else if (returnValue === null) throw new TokenError(t.shift()!, "Unhandled Token");
    //else throw new FatalError("Something Really Went Wrong :(");
  }

  private parseAssign(t: Token[]): Syntax.Assign {
    if (!testToken(t[0], "special", "=")) throw new ParserError("Not an Assign"); t.shift();
    const varIdentifer = getAssertedToken(t.shift()!, "variable");
    let assignValue: Syntax.Assign["value"];
    if (testToken(t[0], "variable")) {
      assignValue = {
        identifier: t.shift()!.value
      } as Syntax.Variable;
    }
    else if (testToken(t[0], "string")) {
      assignValue = t.shift()!.value;
    }
    else if (testToken(t[0], "number")) {
      assignValue = Number(t.shift()!.value);
    }
    else if (testToken(t[0], "keyword", "IN")) {
      assignValue = this.parseInput(t);
    }
    else {
      throw new TokenError(t[0]);
    }
    let operator: string | undefined = undefined;
    if (testToken(t[0], "math")) {
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
    if (!testToken(t[0], "keyword", "IN")) throw new ParserError("Not an Input");
    t.shift();
    if (getAssertedToken(t[0], "special") !== "[") throw new TokenError(t[0]);
    t.shift();
    const inputPrompt = getAssertedToken(t.shift()!, "string");
    if (getAssertedToken(t[0], "special") !== "]") throw new TokenError(t[0]);
    t.shift();
    return {
      type: "input",
      prompt: inputPrompt
    };
  }

  private parseCondition(t: Token[]): Syntax.Condition {
    let invert = false;
    if (testToken(t[0], "compare", "!") || testToken(t[0], "compare", "NOT")) {
      t.shift();
      invert = true;
      if (!testToken(t[0], "compare")) throw new TokenError(t[0], "NOT or ! must be followed by a comparison operator.");
    }
    if (!testToken(t[0], "compare")) throw new ParserError("Not a Condition");
    let operator = t.shift()!.value;
    let leftTerm: Syntax.Condition["left"];
    if (testToken(t[0], "variable")) leftTerm = { identifier: t.shift()!.value } as Syntax.Variable;
    else if (testToken(t[0], "string")) leftTerm = t.shift()!.value;
    else if (testToken(t[0], "number")) leftTerm = Number(t.shift()!.value);
    else {
      try {
        leftTerm = this.parseCondition(t);
      } catch (e) {
        if (!(e instanceof ParserError)) throw e;
        else throw new TokenError(t[0])
      };
    }
    let rightTerm: Syntax.Condition["right"];
    if (testToken(t[0], "variable")) rightTerm = { identifier: t.shift()!.value } as Syntax.Variable;
    else if (testToken(t[0], "string")) rightTerm = t.shift()!.value;
    else if (testToken(t[0], "number")) rightTerm = Number(t.shift()!.value);
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
    const code: Syntax.Instruction[] = [];
    if (!testToken(t[0], "keyword", "DO")) throw new TokenError(t[0], "Expected DO clause.");
    t.shift();
    while (true) {
      if (t[0].value === "ENDDO") { t.shift(); break; }
      code.push(this.parseInstruction(t));
    }
    return code;
  }

  private parsePreTest(t: Token[]): Syntax.PreTest {
    if (!testToken(t[0], "keyword", "WHEN")) throw new ParserError("Not a PreTest");
    t.shift();
    const condition = this.parseCondition(t);
    const code = this.parseDo(t);
    if (!testToken(t[0], "keyword", "ENDWHEN")) throw new TokenError(t[0], "Expected ENDWHEN");
    t.shift();
    return {
      type: "preTest",
      condition: condition,
      code: code
    };
  }
  
  private parseOutput(t: Token[]): Syntax.Output {
    if (!testToken(t[0], "keyword", "OUT")) throw new ParserError("Not an Output");
    t.shift();
    if (getAssertedToken(t[0], "special") !== "[") throw new TokenError(t[0]);
    t.shift();
    const outputValueA = getAssertedToken(t.shift()!, "variable");
    if (getAssertedToken(t[0], "special") !== "]") throw new TokenError(t[0]);
    t.shift();
    return {
      type: "output",
      values: [outputValueA]
    };
  }
}
