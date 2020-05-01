import { Token } from "./lex.ts";

export namespace Syntax {
  interface Report {
    errors: Error[];
    stack: [];
  }
  export class Program {
    name: string;
    code: Instruction[];
    constructor(t: Token[]) {
      // assert TOK:keyword:PROG
      // NAME->TOK:generic
      // CODE->while(parseInstruction)
      // assert TOK:keyword:ENDPROG
    }
  }
  export class Condition {
    operator: string;
    invert: boolean;
    left: Condition | Value | Variable;
    right: Condition | Value | Variable;
    constructor(t: Token[]) {
      // check for invert

    }
  }
  export interface Input {
    prompt: string;
  }
  export interface PreTest {
    condition: Condition;
    code: Instruction[];
  }
  export interface PostTest {
    condition: Condition;
    code: Instruction[];
  }
  export interface CountLoop {
    variable: Variable;
    from: number;
    to: number;
    by: number;
    code: Instruction[];
  }
  export interface Select {
    condition: Condition;
    trueCode: Instruction[];
    falseCode?: Instruction[];
  }
  export interface Switch {
    variable: Variable;
    whenValueThenCode: [Value, Instruction[]][];
  }
  export interface Assign {
    variable: Variable;
    value: Variable | Value | Input;
    operator?: string;
  }
  export interface Output {
    values: (Value|Variable)[];
  }
  export type Value = string | number;
  export interface Variable { identifier: string };
  export type Instruction = PreTest | PostTest | CountLoop | Select | Switch | Assign | Output;
  export type Structure = Instruction | Program | Condition | Input ;
}

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

function testToken(t: Token, type: Token["type"], value?: string): boolean {
  if (type === t.type && value?value===t.value:true) return true;
  return false;
}

export function parse(t: Token[]): Syntax.Program {
  return new Syntax.Program(t);
}
