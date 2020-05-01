import { Token } from "./lex.ts";

interface TokenTestOptions {
  token?: Token;
  type?: Token["type"];
  value?: string;
  msg?: string;
}

function assertToken(o: TokenTestOptions): Token {
  if (o.token === undefined) throw new ParserErrors.EndOfTokens();
  if (o.type !== undefined) {
    if (o.type !== o.token.type) throw new ParserErrors.UnexpectedToken(o.token, o.msg);
  }
  if (o.value !== undefined) {
    if (o.value !== o.token.value) throw new ParserErrors.ExpectedToken(o.value, o.token.line);
  }
  return o.token;
}

function testToken(o: Omit<TokenTestOptions, "errorMessage"> = {}): boolean {
  if (o.token === undefined) return false;
  if (o.type !== undefined) {
    if (o.type !== o.token.type) return false
    if (o.value !== undefined && o.value !== o.token.value) return false;
  }
  return true;
}

function endOfInstruction(t: Token[], assert = false) {
  try {
    assertToken({token: t[0], type: "special", value: ":"});
    t.shift();
  } catch {
    if (assert) throw new ParserErrors.ExpectedToken(":", t.shift()!.line);
  }
}

export namespace Syntax {
  export class ZedString extends String {}
  export class ZedNumber extends Number {}
  export class ZedVariable extends String {}
  export class Input {
    prompt: string;
    constructor(t: Token[]) {
      assertToken({token: t[0], type: "special", value: "["}); t.shift();
      this.prompt = assertToken({token: t[0], type: "string", msg: "Expected mandatory string"}).value; t.shift();
      assertToken({token: t[0], type: "special", value: "]"}); t.shift();
    }
  }
  export class Condition {
    operator: string;
    invert: boolean = false;
    left: ZedVariable | ZedString | ZedNumber | Condition;
    right: ZedVariable | ZedString | ZedNumber | Condition;
    constructor(t: Token[]) {
      if (testToken({token: t[0], type: "compare", value: "!"}) || testToken({token: t[0], type: "compare", value: "NOT"})) {
        this.invert = true; t.shift();
      }
      assertToken({token: t[0], type: "compare", msg: "Expected comparison operator"});
      this.operator = t.shift()!.value;
      if (testToken({token: t[0], type: "variable"})) this.left = new ZedVariable(t.shift()!.value);
      else if (testToken({token: t[0], type: "string"})) this.left = new ZedString(t.shift()!.value);
      else if (testToken({token: t[0], type: "number"})) this.left = new ZedNumber(t.shift()!.value);
      else this.left = new Condition(t);
      if (testToken({token: t[0], type: "variable"})) this.right = new ZedVariable(t.shift()!.value);
      else if (testToken({token: t[0], type: "string"})) this.right = new ZedString(t.shift()!.value);
      else if (testToken({token: t[0], type: "number"})) this.right = new ZedNumber(t.shift()!.value);
      else this.right = new Condition(t);
    }
  }
  export class Assign {
    variable: ZedVariable;
    value: ZedVariable | ZedString | ZedNumber | Input;
    operator?: string;
    constructor(t: Token[]) {
      this.variable = new ZedVariable(assertToken({token: t[0], type: "variable"}).value); t.shift();
      assertToken({token:t[0]});
      if (testToken({token: t[0], type: "variable"})){ this.value = new ZedVariable(t[0].value); t.shift(); }
      else if (testToken({token: t[0], type: "string"})){ this.value = new ZedString(t[0].value); t.shift(); }
      else if (testToken({token: t[0], type: "number"})){ this.value = new ZedNumber(t[0].value); t.shift(); }
      else if (testToken({token: t[0], type: "keyword", value: "IN"})){ t.shift(); this.value = new Input(t); }
      else throw new ParserErrors.UnexpectedToken(t[0], "Expected a value for assignment near line "+t[0].line);
      if (testToken({token: t[0], type: "math"})) this.operator = t.shift()!.value;
    }
  }
  export class Output {
    values: (ZedNumber|ZedString|ZedVariable)[] = [];
    constructor(t: Token[]) {
      assertToken({token: t[0], type: "special", value: "["}); t.shift();
      // test mandatory value
      if (testToken({token: t[0], type: "variable"})) this.values.push(new ZedVariable(t.shift()!.value));
      else if (testToken({token: t[0], type: "string"})) this.values.push(new ZedString(t.shift()!.value));
      else if (testToken({token: t[0], type: "number"})) this.values.push(new ZedNumber(t.shift()!.value));
      else throw new ParserErrors.UnexpectedToken(t[0], "Expected mandatory string or number or variable.");
      while (!testToken({token: t[0], type: "special", value: "]"})) {
        if (!testToken({token: t[0], type: "math", value: "+"})) throw new ParserErrors.UnexpectedToken(t[0], "Concatenate outputs with '+'");
        t.shift();
        if (testToken({token: t[0], type: "variable"})) this.values.push(new ZedVariable(t.shift()!.value));
        else if (testToken({token: t[0], type: "string"})) this.values.push(new ZedString(t.shift()!.value));
        else if (testToken({token: t[0], type: "number"})) this.values.push(new ZedNumber(t.shift()!.value));
        else throw new ParserErrors.UnexpectedToken(t[0], "Expected another output after the '+'");
      }
      t.shift();
    }
  }
  export class PreTest {
    condition: Condition;
    code: CodeBlock;
    constructor(t: Token[]) {
      this.condition = new Condition(t);
      assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
      this.code = new CodeBlock(t, "ENDDO");
      assertToken({token: t[0], type: "keyword", value: "ENDWHEN"}); t.shift();
    }
  }
  export class PostTest {
    condition: Condition;
    code: CodeBlock;
    constructor(t: Token[]) {
      assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
      this.code = new CodeBlock(t, "ENDDO");
      assertToken({token: t[0], type: "keyword", value: "UNTIL"}); t.shift();
      this.condition = new Condition(t);
    }
  }
  export class CountLoop {
    variable: ZedVariable;
    from: ZedNumber;
    to: ZedNumber;
    by: ZedNumber;
    code: CodeBlock;
    constructor(t: Token[]) {
      this.variable = new ZedVariable(assertToken({token: t[0], type: "variable"}).value); t.shift();
      assertToken({token: t[0], type: "keyword", value: "FROM"}); t.shift();
      this.from = new ZedNumber(assertToken({token: t[0], type: "number"}).value); t.shift();
      assertToken({token: t[0], type: "keyword", value: "TO"}); t.shift();
      this.to = new ZedNumber(assertToken({token: t[0], type: "number"}).value); t.shift();
      assertToken({token: t[0], type: "keyword", value: "BY"}); t.shift();
      this.by = new ZedNumber(assertToken({token: t[0], type: "number"}).value); t.shift();
      assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
      this.code = new CodeBlock(t, "ENDDO");
      assertToken({token: t[0], type: "keyword", value: "ENDFOR"}); t.shift();
    }
  }
  export class Select {
    condition: Condition;
    trueCode: Instruction[];
    falseCode?: Instruction[];
    constructor(t: Token[]) {
      this.condition = new Condition(t);
      assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
      this.trueCode = new CodeBlock(t, "ENDDO");
      if (testToken({token: t[0], type: "keyword", value: "OTHERWISE"})) {
        t.shift();
        assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
        this.falseCode = new CodeBlock(t, "ENDDO");
      }
      assertToken({token: t[0], type: "keyword", value: "ENDIF"}); t.shift();
    }
  }
  export class Switch {
    variable: ZedVariable;
    whenValueThenCode: [(ZedNumber|ZedString), Instruction[]][] = [];
    constructor(t: Token[]) {
      this.variable = new ZedVariable(assertToken({token: t[0], type: "variable"}).value); t.shift();
      while (true) {
        if (testToken({token: t[0], type: "keyword", value: "ENDSWITCH"})) break;
        assertToken({token: t[0], type: "keyword", value: "WHEN"}); t.shift();
        let value: (ZedNumber|ZedString);
        if (testToken({token: t[0], type: "string"})) value = new ZedString(t.shift()!.value);
        else if (testToken({token: t[0], type: "number"})) value = new ZedNumber(t.shift()!.value);
        else throw new ParserErrors.UnexpectedToken(t[0], "SWITCH expected a number or string.");
        assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
        const thenCode = new CodeBlock(t, "ENDDO");
        this.whenValueThenCode.push([value, thenCode]);
      }
      assertToken({token: t[0], type: "keyword", value: "ENDSWITCH"}); t.shift();
    }
  }
  export class CodeBlock extends Array<Instruction> {
    constructor(t: Token[], endOfScope: string) {
      super();
      while (true) {
        try {
          assertToken({token:t[0]});
          // test blank instruction
          endOfInstruction(t);
          // test end of scope
          const token = t.shift()!;
          if (token.value === endOfScope) break;
          switch (token.value) {
            case "=":
              this.push(new Assign(t)); endOfInstruction(t, true); break;
            case "OUT":
              this.push(new Output(t)); endOfInstruction(t, true); break;
            case "WHEN":
              this.push(new PreTest(t)); endOfInstruction(t, false); break;
            case "REPEAT":
              this.push(new PostTest(t)); endOfInstruction(t, false); break;
            case "FOR":
              this.push(new CountLoop(t)); endOfInstruction(t, false); break;
            case "IF":
              this.push(new Select(t)); endOfInstruction(t, false); break;
            case "SWITCH":
              this.push(new Switch(t)); endOfInstruction(t, false); break;
            default:
              throw new ParserErrors.UnhandledToken(token);
          }
        } catch (e) {
          console.log(e);
          // if unexpectedtokenerror, test if end of scope character, otherwise throw
        }
      }
    }
  }
  export class Program {
    name: string;
    code: CodeBlock;
    constructor(t: Token[]) {
      assertToken({token: t.shift(), type: "keyword", value: "PROG"});
      this.name = assertToken({token: t.shift(), type: "generic"}).value;
      this.code = new CodeBlock(t, "ENDPROG");
    }
  }
  export type Instruction = PreTest | PostTest | CountLoop | Select | Switch | Assign | Output;
  export type Structure = Instruction | Program | Condition | Input ;
}

namespace ParserErrors {
  export class UnexpectedToken extends Error {
    constructor(t: Token, message: string = ""){
      super(`Unexpected '${t.value}' on line ${t.line}.${message?" "+message+".":""}`);
    }
  }
  export class EndOfTokens extends Error {
    constructor(){
      super("Reached end of program too soon.");
    }
  }
  export class ExpectedToken extends Error {
    constructor(expected: string, line: number){
      super(`Expected '${expected}' near line ${line}.`);
    }
  }
  export class UnhandledToken extends Error {
    constructor(t: Token){
      super(`Unhandled '${t.value}' on line ${t.line}.`);
    }
  }
}


export function parse(t: Token[]): Syntax.Program {
  return new Syntax.Program(t);
}
