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
  endOfStatementTest: {type: ["operator"], value: [":"]} as TokenTest
} as const;

type Keys<T> = keyof T;
type Values<T> = T[keyof T]
type MathematicalOperator = Values<typeof zedDictionary.mathematicalOperator>;
type LogicalOperator = Values<typeof zedDictionary.logicalOperator>;
type RelationalOperator = Values<typeof zedDictionary.relationalOperator>;
type DataType = "string" | "integer" | "float" | "unknown";
type EndOfScope = typeof zedDictionary.endOfScope[number];

interface TokenTest {
  type?: readonly Token["type"][];
  value?: readonly string[];
}
interface ParserTest {
  test: TokenTest;
  errorMsg: (t: Token)=>string;
}
const parserTests = {
  expectedVariable: {
    test: {type:["variable"]},
    errorMsg: t=>`Expected variable at line ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedValue: {
    test: {type:["string","number"]},
    errorMsg: t=>`Expected value at line ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedVariableOrValue: {
    test: {type:["variable","string","number"]},
    errorMsg: t=>`Expected variable or value at line ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedParameterOpen: {
    test: {type: ["operator"], value: ["["]},
    errorMsg: t=>`Expected '[' at line ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedParameterClose: {
    test: {type: ["operator"], value: ["]"]},
    errorMsg: t=>`Expected ']' at line ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedParameterSeparator: {
    test: {type: ["operator"], value: ["+"]},
    errorMsg: t=>`Expected '+' at line ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedOperatorCondition: {
    test: {
      type: ["operator"],
      value: [
        ...Object.keys(zedDictionary.logicalOperator),
        ...Object.keys(zedDictionary.relationalOperator),
        "!"
      ]
    },
    errorMsg: t=>`Expected conditional operator at line ${t.line} char ${t.position}.`
  } as ParserTest,
  
  internalKeywordIN: {
    test: {type: ["keyword"], value: ["IN"]},
    errorMsg: t=>`1`,
  } as ParserTest,
  internalKeywordOUT: {
    test: {type: ["keyword"], value: ["OUT"]},
    errorMsg: t=>`2`,
  } as ParserTest,
  internalSequenceAssign: {
    test: {type: ["operator"], value: ["="]},
    errorMsg: t=>`3`
  } as ParserTest,
  internalOperatorMathematical: {
    test: {type: ["operator"], value: Object.keys(zedDictionary.mathematicalOperator)},
    errorMsg: t=>`4`
  } as ParserTest,
  internalOperatorLogical: {
    test: {type: ["operator"], value: Object.keys(zedDictionary.logicalOperator)},
    errorMsg: t=>`5`
  } as ParserTest,
  internalOperatorRelational: {
    test: {type: ["operator"], value: Object.keys(zedDictionary.relationalOperator)},
    errorMsg: t=>`6`
  } as ParserTest,
  internalOperatorInvert: {
    test: {type: ["operator"], value: ["!"]},
    errorMsg: t=>`7`,
  } as ParserTest,
  
} as const;
type ParserTestKey = keyof typeof parserTests;

function testToken(t: Token | undefined, o: TokenTest = {}): boolean {
  let valid = true;
  if (t === undefined)
    valid = false;
  else if (o.type !== undefined && !o.type.includes(t.type))
    valid = false;
  else if (o.value !== undefined && !o.value.includes(t.value))
    valid = false;
  return valid;
}

export class ParserError extends Error {
  constructor(public key: ParserTestKey, tok: Token) {
    super(parserTests[key].errorMsg(tok));
  }
}
export class UnexpectedEndOfProgram extends Error {}

export class TokenArray {
  #data: (Token|undefined)[];
  #index: number = 0;
  constructor(init: Token[]){this.#data = init;}
  advance(){this.#index++;}
  peek(){ return this.#data[this.#index]; }
  assertPeek(){
    const tok = this.peek();
    if (tok === undefined)
      throw new UnexpectedEndOfProgram();
    else
      return tok as Token;
  }
  read(testKey: ParserTestKey): Token {
    const nextToken = this.peek();
    if (nextToken === undefined)
      throw new UnexpectedEndOfProgram();
    else if (!testToken(nextToken, parserTests[testKey].test))
      throw new ParserError(testKey, nextToken);
    else {
      this.advance();
      return nextToken;
    }
  }
  test(testKey: ParserTestKey): boolean {
    return testToken(this.peek(), parserTests[testKey].test);
  }
  readVariable(): ZedVariable {
    const varToken = this.read("expectedVariable");
    return new ZedVariable(varToken.value);
  }
  readValue(): ZedString | ZedNumber {
    const valToken = this.read("expectedValue");
    if (valToken.type === "string")
      return new ZedString(valToken.value);
    else 
      return new ZedNumber(Number(valToken.value));
  }
  readVariableOrValue(): ZedVariable | ZedString | ZedNumber {
    const tok = this.read("expectedVariableOrValue");
    if (tok.type === "variable")
      return new ZedVariable(tok.value);
    else if (tok.type === "string")
      return new ZedString(tok.value);
    else
      return new ZedNumber(Number(tok.value));
  }
}

export class ZedVariable { constructor(public identifier: string){} }
export class ZedString { constructor(public content: string){} }
export class ZedNumber { constructor(public value: number){} }

export class ZedInOutParams extends Array<ZedVariable | ZedString | ZedNumber> {
  constructor (t: TokenArray) {
    super();
    t.read("expectedParameterOpen");
    // test for '+' separated parameters
    while (true) {
      // if the next token is ']' then break the loop
      if (t.test("expectedParameterClose"))
        break;
      const param = t.readVariableOrValue();
      this.push(param);
      // if the next character is not ']'
      // then assert there is a '+' separator
      if (!t.test("expectedParameterClose"))
        t.read("expectedParameterSeparator");
    }
    t.read("expectedParameterClose");
  }
}

export class ZedInput {
  promptParams: ZedInOutParams;
  constructor(t: TokenArray) {
    t.read("internalKeywordIN");
    this.promptParams = new ZedInOutParams(t);
  }
}

export class ZedAssignment {
  target: ZedVariable;
  operand: ZedVariable | ZedString | ZedNumber | ZedInput;
  operator: MathematicalOperator | null = null;
  constructor(t: TokenArray) {
    t.read("internalSequenceAssign");
    // get target variable
    this.target = t.readVariable();
    // get operand
    if (t.test("internalKeywordIN"))
      this.operand = new ZedInput(t);
    else
      this.operand = t.readVariableOrValue();
    // get optional operator
    if (t.test("internalOperatorMathematical"))
      this.operator = (zedDictionary.mathematicalOperator as any)[t.read("internalOperatorMathematical").value];
  }
}

export class ZedOutput {
  promptParams: ZedInOutParams;
  constructor(t: TokenArray) {
    t.read("internalKeywordOUT");
    this.promptParams = new ZedInOutParams(t);
  }
}

export class ZedCondition {
  operator: LogicalOperator | RelationalOperator;
  left: ZedCondition | ZedVariable | ZedString | ZedNumber;
  right: ZedCondition | ZedVariable | ZedString | ZedNumber;
  invert: boolean = false;
  constructor(t: TokenArray) {
    // test for an invert operator
    if (t.test("internalOperatorInvert")) {
      t.read("internalOperatorInvert");
      this.invert = true;
    }
    // enfore that there is a conditional operator
    if (t.test("internalOperatorLogical"))
      this.operator = (zedDictionary.logicalOperator as any)[t.read("internalOperatorLogical").value];
    else if (t.test("internalOperatorRelational"))
      this.operator = (zedDictionary.relationalOperator as any)[t.read("internalOperatorRelational").value];
    else
      throw new ParserError("expectedOperatorCondition", t.assertPeek());
    // parse left hand side
    if (t.test("expectedOperatorCondition"))
      this.left = new ZedCondition(t);
    else
      this.left = t.readVariableOrValue();
    // parse right hand side
    if (t.test("expectedOperatorCondition"))
      this.right = new ZedCondition(t);
    else
      this.right = t.readVariableOrValue();
  }
}
/*
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
