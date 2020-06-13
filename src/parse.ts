import { Token } from "./lex.ts";

// TODO->Assert minimum required tokens to help alleviate unexpected encountering of EndOfTokens Parser errors.

const zedDictionary = {
  mathematicalOperator: {
    "+": "add",
    "-": "sub",
    "*": "mul",
    "/": "div",
  },
  logicalOperator: {
    "&&": "and",
    "||": "or",
  },
  relationalOperator: {
    ">=": "ge",
    "<=": "le",
    ">":  "gt",
    "<":  "lt",
    "==": "eq",
  },
  endOfScope: [
    "ENDPROG",
    "ENDIF",
    "ENDDO",
    "ENDWHEN",
    "ENDREPEAT",
    "ENDFOR",
    "ENDSWITCH"
  ],
  endOfStatementTest: {type: "operator", value: ":"} as TokenTestOptions
} as const;

type Keys<T> = keyof T;
type Values<T> = T[keyof T]
type MathematicalOperator = Values<typeof zedDictionary.mathematicalOperator>;
type LogicalOperator = Values<typeof zedDictionary.logicalOperator>;
type RelationalOperator = Values<typeof zedDictionary.relationalOperator>;
type DataType = "string" | "integer" | "float" | "unknown";
type EndOfScope = typeof zedDictionary.endOfScope[number];

interface TokenTestOptions {
  type?: Token["type"] | readonly Token["type"][];
  value?: string | readonly string[];
}

function testToken(t?: Token, o: TokenTestOptions = {}): boolean {
  let valid = true;
  if (t === undefined)
    valid = false;
  else {
    if (o.type !== undefined && typeof o.type === "string" && t?.type !== o.type)
      valid = false;
    else if (o.type !== undefined && typeof o.type !== "string" && !o.type.includes(t!.type))
      valid = false;
    if (o.value !== undefined && typeof o.value === "string" && t!.value !== o.value)
      valid = false;
    else if (o.value !== undefined && typeof o.value !== "string" && !o.value.includes(t!.value))
      valid = false;
  }
  return valid;
}

/** This error should never naturally occur, and instead represents an error in the parser itself */
class IncorrectTokenError extends Error {
  constructor(t: Token){
    super(`Incorrect '${t.value}' at line ${t.line+1}, char ${t.position+1}.`);
  }
}
class UnexpectedTokenError extends Error {
  constructor(t: Token){
    super(`Unexpected '${t.value}' at line ${t.line+1}, char ${t.position+1}.`);
  }
}
class EndOfTokensError extends Error {
  constructor(){
    super("Reached end of program too soon.");
  }
}
class MissingTokenError extends Error {
  constructor(expected: string, line: number, position: number){
    super(`Missing token '${expected}' at line ${line+1}, char ${position+1}.`);
  }
}
class UndefinedVariableError extends Error {
  constructor(t: Token, v: ZedVariable) {
    super(`Undefined variable ${v.identifier} at line ${t.line+1}, char ${t.position+1}`);
  }
}
// TODO->Add message param to constructor.
class SyntaxError extends Error {
  constructor(structureName: string, atToken: Token) {
    super(`Invalid or missing '${structureName}' at line ${atToken.line+1}, char ${atToken.position+1}`);
  }
}

/** Advances the token list. Typically called after a peek is handled. */
function advanceTokens(t: Token[]): void {
  t.shift();
}

/** Asserts the next token exists, and returns it. */
function peekNextToken(t: Token[]): Token {
  const tok = t[0];
  if (tok === undefined) throw new EndOfTokensError();
  return tok;
}

/** Pops the next token, asserts that it exists, and returns it. */
function readNextToken(t: Token[]): Token {
  const tok = t.shift();
  if (tok === undefined) throw new EndOfTokensError();
  return tok;
}

/** Pops the next token, asserts that it exists and that it passes the test, and returns it */
function assertNextToken(t: Token[], o: TokenTestOptions = {}): Token {
  const tok = readNextToken(t);
  if (!testToken(tok, o))
    throw new IncorrectTokenError(tok);
  return tok;
}

export class ZedVariable { constructor(public identifier: string){} }
export class ZedString { constructor(public content: string){} }
export class ZedNumber { constructor(public value: number){} }

export class ZedInOutParams extends Array<ZedVariable | ZedString | ZedNumber> {
  constructor (t: Token[]) {
    super();
    // test '['
    const openBracketToken = peekNextToken(t);
    if (!testToken(openBracketToken, {type: "operator", value: "["}))
      throw new SyntaxError("parameter list opening [", openBracketToken);
    advanceTokens(t);
    // test for '+' separated parameters
    while (true) {
      if (testToken(peekNextToken(t), {type: "operator", value: "]"}))
        break;
      const paramToken = peekNextToken(t);
      if (paramToken.type === "variable")
        this.push(new ZedVariable(paramToken.value));
      else if (paramToken.type === "string")
        this.push(new ZedString(paramToken.value));
      else if (paramToken.type === "number")
        this.push(new ZedNumber(Number(paramToken.value)));
      else
        throw new SyntaxError("variable/string/number parameter", paramToken);
      advanceTokens(t);
      if (!testToken(peekNextToken(t), {type: "operator", value: "]"})) {
        const separatorToken = readNextToken(t);
        if (!testToken(separatorToken, {type: "operator", value: "+"}))
          throw new SyntaxError("paramter list separator", separatorToken);
      }
    }
    // test for ']'
    const closeBracketToken = peekNextToken(t);
    if (!testToken(closeBracketToken, {type: "operator", value: "]"}))
      throw new SyntaxError("parameter list closing ]", closeBracketToken);
    advanceTokens(t);
  }
}

export class ZedInput {
  promptParams: ZedInOutParams;
  constructor(t: Token[]) {
    assertNextToken(t, ZedInput.tokenTest);
    this.promptParams = new ZedInOutParams(t);
  }
  static tokenTest: TokenTestOptions = {type: "keyword", value: "IN"};
}

export class ZedAssignment {
  target: ZedVariable;
  operand: ZedVariable | ZedString | ZedNumber | ZedInput | null = null;
  operator: MathematicalOperator | null = null;
  constructor(t: Token[]) {
    // TODO->Create a function that accepts all classes with beginsWith() method and assert using that
    assertNextToken(t, ZedAssignment.tokenTest);
    // get target variable token
    const targetToken = peekNextToken(t);
    if (!testToken(targetToken, {type: "variable"}))
      throw new SyntaxError("assignment", targetToken);
    advanceTokens(t);
    // get value token
    const operandToken = peekNextToken(t);
    if (testToken(operandToken, {type: "variable"}))
      this.operand = new ZedVariable(readNextToken(t).value);
    else if (testToken(operandToken, {type: "string"}))
      this.operand = new ZedString(readNextToken(t).value);
    else if (testToken(operandToken, {type: "number"}))
      this.operand = new ZedNumber(Number(readNextToken(t).value));
    else if (testToken(operandToken, ZedInput.tokenTest))
      this.operand = new ZedInput(t);
    else
      throw new SyntaxError("assignment", operandToken);

    // get optional operator token
    let operatorToken: Token | null = null;
    if (testToken(t[0], {type: "operator", value: Object.keys(zedDictionary.mathematicalOperator)}))
      operatorToken = readNextToken(t);

    this.target = new ZedVariable(targetToken.value);
    if (operatorToken !== null)
      this.operator = zedDictionary.mathematicalOperator[operatorToken.value as Keys<typeof zedDictionary.mathematicalOperator>];
  }
  static tokenTest: TokenTestOptions = {type: "operator", value: "="};
}

export class ZedOutput {
  promptParams: ZedInOutParams;
  constructor(t: Token[]) {
    assertNextToken(t, ZedOutput.tokenTest);
    this.promptParams = new ZedInOutParams(t);
  }
  static tokenTest: TokenTestOptions = {type: "keyword", value: "OUT"};
}

export class ZedCondition {
  operator: LogicalOperator | RelationalOperator;
  left: ZedCondition | ZedVariable | ZedString | ZedNumber;
  right: ZedCondition | ZedVariable | ZedString | ZedNumber;
  invert: boolean = false;
  constructor(t: Token[]) {
    const invertToken = peekNextToken(t);
    if (testToken(invertToken, {type: "operator", value: "!"})) {
      this.invert = true;
      advanceTokens(t);
    }

    const operatorToken = peekNextToken(t);
    if (testToken(operatorToken, {type: "operator", value: Object.keys(zedDictionary.logicalOperator)}))
      this.operator = zedDictionary.logicalOperator[operatorToken.value as Keys<typeof zedDictionary.logicalOperator>];
    else if (testToken(operatorToken, {type: "operator", value: Object.keys(zedDictionary.relationalOperator)}))
      this.operator = zedDictionary.relationalOperator[operatorToken.value as Keys<typeof zedDictionary.relationalOperator>];
    else
      throw new SyntaxError("condition operator", operatorToken);
    advanceTokens(t);
    
    const leftTermToken = peekNextToken(t);
    if (testToken(leftTermToken, ZedCondition.tokenTest)) 
      this.left = new ZedCondition(t);
    else if (testToken(leftTermToken, {type: "variable"}))
      this.left = new ZedVariable(readNextToken(t).value);
    else if (testToken(leftTermToken, {type: "string"}))
      this.left = new ZedString(readNextToken(t).value);
    else if (testToken(leftTermToken, {type: "number"}))
      this.left = new ZedNumber(Number(readNextToken(t).value));
    else
      throw new SyntaxError("condition left-term", leftTermToken);
    
    const rightTermToken = peekNextToken(t);
    if (testToken(rightTermToken, ZedCondition.tokenTest)) 
      this.right = new ZedCondition(t);
    else if (testToken(rightTermToken, {type: "variable"}))
      this.right = new ZedVariable(readNextToken(t).value);
    else if (testToken(rightTermToken, {type: "string"}))
      this.right = new ZedString(readNextToken(t).value);
    else if (testToken(rightTermToken, {type: "number"}))
      this.right = new ZedNumber(Number(readNextToken(t).value));
    else
      throw new SyntaxError("condition right-term", rightTermToken);
  }
  static tokenTest: TokenTestOptions = {type: "operator", value: [
    ...Object.keys(zedDictionary.logicalOperator),
    ...Object.keys(zedDictionary.relationalOperator),
    "!"
  ]}
}

class ZedStatement {
  structure: ZedAssignment | ZedOutput;
  endOfStatementSatisfied: boolean = true;
  constructor(t: Token[]) {
    const keyToken = peekNextToken(t);
    if (testToken(keyToken, ZedAssignment.tokenTest)) {
      this.structure = new ZedAssignment(t);
      if (!testToken(peekNextToken(t), zedDictionary.endOfStatementTest))
        this.endOfStatementSatisfied = false;
    }
    else if (testToken(keyToken, ZedOutput.tokenTest)) {
      this.structure = new ZedOutput(t);
      if (!testToken(peekNextToken(t), zedDictionary.endOfStatementTest))
        this.endOfStatementSatisfied = false;
    }
    else if (false) {
    }
    else
      throw new UnexpectedTokenError(readNextToken(t));
  }
}

class ZedCodeBlock {
  statements: Array<ZedAssignment | ZedOutput> = [];
  errors: Error[];
  // parse statement by statement, catching errors as it goes...
  constructor(t: Token[], end: EndOfScope) {
    let eosSatisfied = false;
    while (true) {
      if (testToken(peekNextToken(t), zedDictionary.endOfStatementTest)) {
        eosSatisfied = true;
        advanceTokens(t);
      }
      else if (testToken(peekNextToken(t), {type: "keyword", value: zedDictionary.endOfScope})) {
        const endOfScopeToken = readNextToken(t);
        
      }
      else {
        try {
          const stmt = new ZedStatement(t);
          if (!eosSatisfied) // add Missing EOS error
          this.statements.push(stmt.structure);
          eosSatisfied = stmt.endOfStatementSatisfied
        } catch (e) {
          console.log(e);
        }
      }
    }
    // finished parsing statements
  }
}


// export class Program {
//   identifier: string;
//   body: [];
//   constructor(t: Token[], e: Error[]) {

//   }
// }

// export interface ParseResult {
//   program: Syntax.Program;
//   errors: Error[];
// }
// export function parse(tokens: Token[]): ParseResult {
//   const errors: Error[] = [];
//   const program = new Syntax.Program()
// }


// function endOfInstruction(t: Token[], assert = false) {
//   try {
//     assertToken({token: t[0], type: "special", value: ":"});
//     t.shift();
//     //console.log(t);
//   } catch {
//     if (assert) throw new ParserErrors.ExpectedToken(":", t[0].line);
//   }
// }

// export namespace Syntax {
//   export class ZedString extends String {}
//   export class ZedNumber extends Number {}
//   export class ZedVariable extends String {}
//   export class Input {
//     prompt: string;
//     constructor(t: Token[], e: Error[]) {
//       assertToken({token: t[0], type: "special", value: "["}); t.shift();
//       this.prompt = assertToken({token: t[0], type: "string", msg: "Expected mandatory string"}).value; t.shift();
//       assertToken({token: t[0], type: "special", value: "]"}); t.shift();
//     }
//   }
//   export class Condition {
//     operator: string;
//     invert: boolean = false;
//     left: ZedVariable | ZedString | ZedNumber | Condition;
//     right: ZedVariable | ZedString | ZedNumber | Condition;
//     constructor(t: Token[], e: Error[]) {
//       if (testToken({token: t[0], type: "compare", value: "!"}) || testToken({token: t[0], type: "compare", value: "NOT"})) {
//         this.invert = true; t.shift();
//       }
//       assertToken({token: t[0], type: "compare", msg: "Expected comparison operator"});
//       this.operator = t.shift()!.value;
//       if (testToken({token: t[0], type: "variable"})) this.left = new ZedVariable(t.shift()!.value);
//       else if (testToken({token: t[0], type: "string"})) this.left = new ZedString(t.shift()!.value);
//       else if (testToken({token: t[0], type: "number"})) this.left = new ZedNumber(t.shift()!.value);
//       else this.left = new Condition(t, e);
//       if (testToken({token: t[0], type: "variable"})) this.right = new ZedVariable(t.shift()!.value);
//       else if (testToken({token: t[0], type: "string"})) this.right = new ZedString(t.shift()!.value);
//       else if (testToken({token: t[0], type: "number"})) this.right = new ZedNumber(t.shift()!.value);
//       else this.right = new Condition(t, e);
//     }
//   }
//   export class Assign {
//     variable: ZedVariable;
//     value: ZedVariable | ZedString | ZedNumber | Input;
//     operator?: string;
//     constructor(t: Token[], e: Error[]) {
//       this.variable = new ZedVariable(assertToken({token: t[0], type: "variable"}).value); t.shift();
//       assertToken({token:t[0]});
//       if (testToken({token: t[0], type: "variable"})){ this.value = new ZedVariable(t[0].value); t.shift(); }
//       else if (testToken({token: t[0], type: "string"})){ this.value = new ZedString(t[0].value); t.shift(); }
//       else if (testToken({token: t[0], type: "number"})){ this.value = new ZedNumber(t[0].value); t.shift(); }
//       else if (testToken({token: t[0], type: "keyword", value: "IN"})){ t.shift(); this.value = new Input(t, e); }
//       else throw new ParserErrors.UnexpectedToken(t[0], "Expected a value for assignment near line "+t[0].line);
//       if (testToken({token: t[0], type: "math"})) this.operator = t.shift()!.value;
//     }
//   }
//   export class Output {
//     values: (ZedNumber|ZedString|ZedVariable)[] = [];
//     constructor(t: Token[], e: Error[]) {
//       assertToken({token: t[0], type: "special", value: "["}); t.shift();
//       // test mandatory value
//       if (testToken({token: t[0], type: "variable"})) this.values.push(new ZedVariable(t.shift()!.value));
//       else if (testToken({token: t[0], type: "string"})) this.values.push(new ZedString(t.shift()!.value));
//       else if (testToken({token: t[0], type: "number"})) this.values.push(new ZedNumber(t.shift()!.value));
//       else throw new ParserErrors.UnexpectedToken(t[0], "Expected mandatory string or number or variable.");
//       while (!testToken({token: t[0], type: "special", value: "]"})) {
//         if (!testToken({token: t[0], type: "math", value: "+"})) throw new ParserErrors.UnexpectedToken(t[0], "Concatenate outputs with '+'");
//         t.shift();
//         if (testToken({token: t[0], type: "variable"})) this.values.push(new ZedVariable(t.shift()!.value));
//         else if (testToken({token: t[0], type: "string"})) this.values.push(new ZedString(t.shift()!.value));
//         else if (testToken({token: t[0], type: "number"})) this.values.push(new ZedNumber(t.shift()!.value));
//         else throw new ParserErrors.UnexpectedToken(t[0], "Expected another output after the '+'");
//       }
//       // shift the closing "]"
//       t.shift();
//     }
//   }
//   export class PreTest {
//     condition: Condition;
//     code: CodeBlock;
//     constructor(t: Token[], e: Error[]) {
//       this.condition = new Condition(t, e);
//       assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
//       this.code = new CodeBlock(t, e, "ENDDO");
//       assertToken({token: t[0], type: "keyword", value: "ENDWHEN"}); t.shift();
//     }
//   }
//   export class PostTest {
//     condition: Condition;
//     code: CodeBlock;
//     constructor(t: Token[], e: Error[]) {
//       assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
//       this.code = new CodeBlock(t, e, "ENDDO");
//       assertToken({token: t[0], type: "keyword", value: "UNTIL"}); t.shift();
//       this.condition = new Condition(t, e);
//       assertToken({token: t[0], type: "keyword", value: "ENDREPEAT"}); t.shift();
//     }
//   }
//   export class CountLoop {
//     variable: ZedVariable;
//     from: ZedNumber;
//     to: ZedNumber;
//     by: ZedNumber;
//     code: CodeBlock;
//     constructor(t: Token[], e: Error[]) {
//       this.variable = new ZedVariable(assertToken({token: t[0], type: "variable"}).value); t.shift();
//       assertToken({token: t[0], type: "keyword", value: "FROM"}); t.shift();
//       this.from = new ZedNumber(assertToken({token: t[0], type: "number"}).value); t.shift();
//       assertToken({token: t[0], type: "keyword", value: "TO"}); t.shift();
//       this.to = new ZedNumber(assertToken({token: t[0], type: "number"}).value); t.shift();
//       assertToken({token: t[0], type: "keyword", value: "BY"}); t.shift();
//       this.by = new ZedNumber(assertToken({token: t[0], type: "number"}).value); t.shift();
//       assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
//       this.code = new CodeBlock(t, e, "ENDDO");
//       assertToken({token: t[0], type: "keyword", value: "ENDFOR"}); t.shift();
//     }
//   }
//   export class Select {
//     condition: Condition;
//     trueCode: Instruction[];
//     falseCode?: Instruction[];
//     constructor(t: Token[], e: Error[]) {
//       this.condition = new Condition(t, e);
//       assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
//       this.trueCode = new CodeBlock(t, e, "ENDDO");
//       if (testToken({token: t[0], type: "keyword", value: "OTHERWISE"})) {
//         t.shift();
//         assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
//         this.falseCode = new CodeBlock(t, e, "ENDDO");
//       }
//       assertToken({token: t[0], type: "keyword", value: "ENDIF"}); t.shift();
//     }
//   }
//   export class Switch {
//     variable: ZedVariable;
//     whenValueThenCode: [(ZedNumber|ZedString), Instruction[]][] = [];
//     constructor(t: Token[], e: Error[]) {
//       this.variable = new ZedVariable(assertToken({token: t[0], type: "variable"}).value); t.shift();
//       while (true) {
//         if (testToken({token: t[0], type: "keyword", value: "ENDSWITCH"})) break;
//         assertToken({token: t[0], type: "keyword", value: "WHEN"}); t.shift();
//         let value: (ZedNumber|ZedString);
//         if (testToken({token: t[0], type: "string"})) value = new ZedString(t.shift()!.value);
//         else if (testToken({token: t[0], type: "number"})) value = new ZedNumber(t.shift()!.value);
//         else throw new ParserErrors.UnexpectedToken(t[0], "SWITCH expected a number or string.");
//         assertToken({token: t[0], type: "keyword", value: "DO"}); t.shift();
//         const thenCode = new CodeBlock(t, e, "ENDDO");
//         this.whenValueThenCode.push([value, thenCode]);
//       }
//       assertToken({token: t[0], type: "keyword", value: "ENDSWITCH"}); t.shift();
//     }
//   }
//   export class CodeBlock extends Array<Instruction> {
//     constructor(t: Token[], e: Error[], endOfScope: string) {
//       super();
//       while (true) {
//         try {
//           assertToken({token:t[0]});
//           // test blank instruction
//           endOfInstruction(t);
//           // test end of scope
//           const token = t.shift()!;
//           //console.log("@",token);
//           if (token.value === endOfScope) break;
//           switch (token.value) {
//             case "=":
//               this.push(new Assign(t, e)); endOfInstruction(t, true); break;
//             case "OUT":
//               this.push(new Output(t, e)); endOfInstruction(t, true); break;
//             case "WHEN":
//               this.push(new PreTest(t, e)); endOfInstruction(t, false); break;
//             case "REPEAT":
//               this.push(new PostTest(t, e)); endOfInstruction(t, false); break;
//             case "FOR":
//               this.push(new CountLoop(t, e)); endOfInstruction(t, false); break;
//             case "IF":
//               this.push(new Select(t, e)); endOfInstruction(t, false); break;
//             case "SWITCH":
//               this.push(new Switch(t, e)); endOfInstruction(t, false); break;
//             default:
//               throw new ParserErrors.UnhandledToken(token);
//           }
//         } catch (err) {
//           if (err instanceof ParserErrors.EndOfTokens) break;
//           e.push(err);
//         }
//       }
//     }
//   }
//   export class Program {
//     name: string;
//     code: CodeBlock;
//     constructor(t: Token[], e: Error[]) {
//       assertToken({token: t.shift(), type: "keyword", value: "PROG"});
//       this.name = assertToken({token: t.shift(), type: "generic"}).value;
//       this.code = new CodeBlock(t, e, "ENDPROG");
//     }
//   }
//   export type Instruction = PreTest | PostTest | CountLoop | Select | Switch | Assign | Output;
//   export type Structure = Instruction | Program | Condition | Input ;
// }

// namespace ParserErrors {
//   export class UnexpectedToken extends Error {
//     constructor(t: Token, message: string = ""){
//       super(`Unexpected '${t.value}' on line ${t.line}.${message?" "+message+".":""}`);
//     }
//   }
//   export class EndOfTokens extends Error {
//     constructor(){
//       super("Reached end of program too soon.");
//     }
//   }
//   export class ExpectedToken extends Error {
//     constructor(expected: string, line: number){
//       super(`Expected '${expected}' near line ${line}.`);
//     }
//   }
//   export class UnhandledToken extends Error {
//     constructor(t: Token){
//       super(`Unhandled '${t.value}' on line ${t.line}.`);
//     }
//   }
// }


// export function parse(t: Token[]) {
//   const errors: Error[] = [];
//   const program = new Syntax.Program(t, errors);
//   return {
//     program, errors
//   };
// }

/*

PROG counter
  FOR I1 FROM 1 TO 10 BY 1
    

  

ENDPROG

*/
