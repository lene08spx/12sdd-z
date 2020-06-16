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
  expectedNumber: {
    test: {type:["number"]},
    errorMsg: t=>`Expected number at line ${t.line} char ${t.position}.`,
  } as ParserTest,
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
  expectedKeywordDO: {
    test: {type: ["keyword"], value: ["DO"]},
    errorMsg: t=>`Expected keyword 'DO' at ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedKeywordENDWHEN: {
    test: {type: ["keyword"], value: ["ENDWHEN"]},
    errorMsg: t=>`Expected keyword 'ENDWHEN' at ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedKeywordENDFOR: {
    test: {type: ["keyword"], value: ["ENDFOR"]},
    errorMsg: t=>`8`,
  } as ParserTest,
  expectedKeywordENDREPEAT: {
    test: {type: ["keyword"], value: ["ENDREPEAT"]},
    errorMsg: t=>`8`,
  } as ParserTest,
  expectedKeywordUNTIL: {
    test: {type: ["keyword"], value: ["UNTIL"]},
    errorMsg: t=>`8`,
  } as ParserTest,
  expectedKeywordFROM: {
    test: {type: ["keyword"], value: ["FROM"]},
    errorMsg: t=>`Expected keyword 'FROM' at ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedKeywordTO: {
    test: {type: ["keyword"], value: ["TO"]},
    errorMsg: t=>`Expected keyword 'TO' at ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedKeywordBY: {
    test: {type: ["keyword"], value: ["BY"]},
    errorMsg: t=>`Expected keyword 'BY' at ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedKeywordOTHERWISE: {
    test: {type: ["keyword"], value: ["OTHERWISE"]},
    errorMsg: t=>`Expected keyword 'OTHERWISE' at ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedKeywordENDIF: {
    test: {type: ["keyword"], value: ["ENDIF"]},
    errorMsg: t=>`Expected keyword 'ENDIF' at ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedKeywordENDSWITCH: {
    test: {type: ["keyword"], value: ["ENDSWITCH"]},
    errorMsg: t=>`Expected keyword 'ENDSWITCH' at ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedEndOfStatement: {
    test: {type: ["operator"], value: [":"]},
    errorMsg: t=>`Expected end of statement ':' at ${t.line} char ${t.position}.`,
  } as ParserTest,
  expectedAssignOutputOrControl: {
    test: {},
    errorMsg: t=>`Expect an assignment, output or control structure at line ${t.line} char ${t.position}.`
  } as ParserTest,
  
  internalKeywordIN: {
    test: {type: ["keyword"], value: ["IN"]},
    errorMsg: t=>`1`,
  } as ParserTest,
  internalKeywordOUT: {
    test: {type: ["keyword"], value: ["OUT"]},
    errorMsg: t=>`2`,
  } as ParserTest,
  internalKeywordWHEN: {
    test: {type: ["keyword"], value: ["WHEN"]},
    errorMsg: t=>`2`,
  } as ParserTest,
  internalKeywordIF: {
    test: {type: ["keyword"], value: ["IF"]},
    errorMsg: t=>`2`,
  } as ParserTest,
  internalKeywordSWITCH: {
    test: {type: ["keyword"], value: ["SWITCH"]},
    errorMsg: t=>`2`,
  } as ParserTest,
  internalKeywordFOR: {
    test: {type: ["keyword"], value: ["FOR"]},
    errorMsg: t=>`2`,
  } as ParserTest,
  internalKeywordREPEAT: {
    test: {type: ["keyword"], value: ["REPEAT"]},
    errorMsg: t=>`2`,
  } as ParserTest,
  internalKeywordENDDO: {
    test: {type: ["keyword"], value: ["ENDDO"]},
    errorMsg: t=>`8`,
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
      throw new UnexpectedEndOfProgram("UNEXPECTED_END_OF_PROGRAM");
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

// needs to carry errors instead of throwing them, except for unexpected end of file
export class ZedDoBlock {
  statements: (ZedAssignment | ZedOutput)[] = [];
  errors: Error[] = [];
  constructor(t: TokenArray) {
    let skipInput = false;
    t.read("expectedKeywordDO");
    while (true) {
      try {
        if (t.test("internalKeywordENDDO"))
          break;
        // if there is just a end of statement by itself
        else if (t.test("expectedEndOfStatement")) {
          t.read("expectedEndOfStatement");
          skipInput = false;
        }
        else if (skipInput) {
          t.assertPeek();
          t.advance();
        }
        // if OUT, make sure there is a :
        else if (t.test("internalKeywordOUT")) {
          this.statements.push(new ZedOutput(t));
          if (!t.test("expectedEndOfStatement"))
            this.errors.push(new ParserError("expectedEndOfStatement", t.assertPeek()));
        }
        // if '=', make sure there is a :
        else if (t.test("internalSequenceAssign")) {
          this.statements.push(new ZedAssignment(t));
          if (!t.test("expectedEndOfStatement"))
            this.errors.push(new ParserError("expectedEndOfStatement", t.assertPeek()));
        }
        else {
          //error unexpected token;
          // set skip flag, until end of statement
          this.errors.push(new ParserError("expectedAssignOutputOrControl", t.assertPeek()));
          t.advance();
          skipInput = true;
        }
      } catch (e) {
        skipInput = true;
        if (e instanceof UnexpectedEndOfProgram)
          throw e;
        else
          this.errors.push(e);
      }
    }
    t.read("internalKeywordENDDO");
  }
}

export class ZedPreTestLoop {
  condition: ZedCondition;
  code: ZedDoBlock;
  constructor(t: TokenArray) {
    t.read("internalKeywordWHEN");
    this.condition = new ZedCondition(t);
    this.code = new ZedDoBlock(t);
    t.read("expectedKeywordENDWHEN");
  }
}

export class ZedPostTestLoop {
  condition: ZedCondition;
  code: ZedDoBlock;
  constructor(t: TokenArray) {
    t.read("internalKeywordREPEAT");
    this.code = new ZedDoBlock(t);
    t.read("expectedKeywordUNTIL");
    this.condition = new ZedCondition(t);
    t.read("expectedKeywordENDREPEAT");
  }
}

export class ZedForLoop {
  variable: ZedVariable;
  from: ZedNumber;
  to: ZedNumber;
  by: ZedNumber;
  code: ZedDoBlock;
  constructor(t: TokenArray) {
    t.read("internalKeywordFOR");
    this.variable = t.readVariable();
    t.read("expectedKeywordFROM");
    this.from = new ZedNumber(Number(t.read("expectedNumber").value));
    t.read("expectedKeywordTO");
    this.to = new ZedNumber(Number(t.read("expectedNumber").value));
    t.read("expectedKeywordBY");
    this.by = new ZedNumber(Number(t.read("expectedNumber").value));
    this.code = new ZedDoBlock(t);
    t.read("expectedKeywordENDFOR");
  }
}

export class ZedBinarySelection {
  conditions: [ZedCondition | null, ZedDoBlock][] = [];
  constructor(t: TokenArray) {
    t.read("internalKeywordIF");
    this.conditions.push([
      new ZedCondition(t),
      new ZedDoBlock(t)
    ]);
    while (t.test("expectedKeywordOTHERWISE")) {
      t.read("expectedKeywordOTHERWISE");
      if (t.test("internalKeywordIF")) {
        t.read("internalKeywordIF");
        this.conditions.push([
          new ZedCondition(t),
          new ZedDoBlock(t)
        ]);
      }
      else {
        this.conditions.push([
          null,
          new ZedDoBlock(t)
        ]);
        break;
      }
    }
    t.read("expectedKeywordENDIF");
  }
}

export class ZedMultiwaySelection {
  variable: ZedVariable;
  whenValueThenCode: [(ZedNumber|ZedString),ZedDoBlock][] = [];
  constructor(t: TokenArray) {
    t.read("internalKeywordSWITCH");
    this.variable = t.readVariable();
    while (!t.test("expectedKeywordENDSWITCH")) {
      t.read("internalKeywordWHEN");
      this.whenValueThenCode.push([
        t.readValue(),
        new ZedDoBlock(t),
      ]);
    }
    t.read("expectedKeywordENDSWITCH");
  }
}

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
