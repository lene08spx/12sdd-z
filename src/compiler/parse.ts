// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

import { Token, TokenType } from "./lex.ts";

// TODO->Assert minimum required tokens to help alleviate unexpected encountering of EndOfTokens Parser errors.

const mathematicalOperators = ["+","-","*","/"] as const;
const logicalOperators = ["&&","||"] as const;
const relationalOperators = [">=","<=",">","<","=="] as const;

export type MathematicalOperator = typeof mathematicalOperators[number];
export type LogicalOperator = typeof logicalOperators[number];
export type RelationalOperator = typeof relationalOperators[number];

type ErrorMessageFormatter = (t: Token, tokenType: TokenType[], tokenValue: string[])=>string;

class SyntaxTest {
  constructor (
    private errorMsgHandler: ErrorMessageFormatter,
    private type: TokenType[] = [],
    private value: string[] = [],
  ) {}
  check(t: Token | undefined): boolean {
    let valid = true;
    if (t === undefined)
      valid = false;
    else if (this.type.length > 0 && !this.type.includes(t.type))
      valid = false;
    else if (this.value.length > 0 && !this.value.includes(t.value))
      valid = false;
    return valid;
  }
  errorMsg(t: Token): string {
    return this.errorMsgHandler(t, this.type, this.value);
  }
}

const errorHandlers = {
  expectedToken: function(t, tokenType, tokenValue) {
    return `Expected ${tokenType.join(" or ")} '${tokenValue}' instead of '${t.value}' at line ${t.line} char ${t.position}.`;
  } as ErrorMessageFormatter,
  expectedProgramIdentifier: function(t, tokenType, tokenValue) {
    return `Expected a program identifier instead of '${t.value}' at line ${t.line} char ${t.position}.`;
  } as ErrorMessageFormatter
} as const;

export const syntaxTests = {
  programIdentifier: new SyntaxTest(errorHandlers.expectedProgramIdentifier, ["identifier"]),
  number: new SyntaxTest(errorHandlers.expectedToken, ["number"]),
  variable: new SyntaxTest(errorHandlers.expectedToken, ["variable"]),
  value: new SyntaxTest(errorHandlers.expectedToken, ["string", "number"]),
  variableOrValue: new SyntaxTest(errorHandlers.expectedToken, ["variable","string","number"]),
  parameterOpen: new SyntaxTest(errorHandlers.expectedToken, ["operator"], ["["]),
  parameterClose: new SyntaxTest(errorHandlers.expectedToken, ["operator"], ["]"]),
  parameterSeperator: new SyntaxTest(errorHandlers.expectedToken, ["operator"], ["+"]),
  conditionalOperator: new SyntaxTest(errorHandlers.expectedToken, ["operator"], ["!", ...logicalOperators, ...relationalOperators]),
  mathematicalOperator: new SyntaxTest(errorHandlers.expectedToken, ["operator"], [...mathematicalOperators]),
  logicalOperator: new SyntaxTest(errorHandlers.expectedToken, ["operator"], [...logicalOperators]),
  relationalOperator: new SyntaxTest(errorHandlers.expectedToken, ["operator"], [...relationalOperators]),
  invert: new SyntaxTest(errorHandlers.expectedToken, ["operator"], ["!"]),
  endOfStatement: new SyntaxTest(errorHandlers.expectedToken, ["operator"], [":"]),
  statement: new SyntaxTest(errorHandlers.expectedToken, ["operator","keyword"], [
    "=", "DO", "OUT", "IF", "SWITCH", "FOR", "WHEN", "REPEAT"
  ]),
  assign: new SyntaxTest(errorHandlers.expectedToken, ["operator"], ["="]),
  PROG: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["PROG"]),
  ENDPROG: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["ENDPROG"]),
  DO: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["DO"]),
  ENDDO: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["ENDDO"]),
  OUT: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["OUT"]),
  IN: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["IN"]),
  IF: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["IF"]),
  OTHERWISE: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["OTHERWISE"]),
  ENDIF: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["ENDIF"]),
  SWITCH: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["SWITCH"]),
  ENDSWITCH: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["ENDSWITCH"]),
  FOR: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["FOR"]),
  FROM: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["FROM"]),
  TO: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["TO"]),
  BY: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["BY"]),
  ENDFOR: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["ENDFOR"]),
  WHEN: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["WHEN"]),
  ENDWHEN: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["ENDWHEN"]),
  REPEAT: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["REPEAT"]),
  UNTIL: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["UNTIL"]),
  ENDREPEAT: new SyntaxTest(errorHandlers.expectedToken, ["keyword"], ["ENDREPEAT"]),
} as const;

export class ParserError extends Error {
  constructor(test: SyntaxTest, public token: Token) {
    super(test.errorMsg(token));
  }
}
export class UnexpectedEndOfProgram extends Error {
  currentErrors: ParserError[] = [];
}

export class TokenArray {
  #data: Token[];
  #index: number = 0;
  constructor(init: Token[], private testMode=false){this.#data = init;}
  advance(){this.#index++;}
  peek(){ return this.#data[this.#index]; }
  currIndex(){ return this.#index; }
  assertPeek(){
    const tok = this.peek();
    if (tok === undefined)
      throw new UnexpectedEndOfProgram("UNEXPECTED_END_OF_PROGRAM");
    else
      return tok as Token;
  }
  read(test: SyntaxTest): Token {
    const nextToken = this.peek();
    if (nextToken === undefined)
      throw new UnexpectedEndOfProgram();
    else if (!test.check(nextToken))
      throw new ParserError(test, nextToken);
    else {
      this.advance();
      return nextToken;
    }
  }
  check(test: SyntaxTest): boolean {
    return test.check(this.peek());
  }
  readNumber(): ZedNumber {
    const varToken = this.read(syntaxTests.number);
    return new ZedNumber(Number(varToken.value));
  }
  readVariable(): ZedVariable {
    const varToken = this.read(syntaxTests.variable);
    if (this.testMode)
      return new ZedVariable(varToken.value);
    else
      return new ZedVariable(varToken.value, this.currIndex()-1, varToken);
  }
  readValue(): ZedString | ZedNumber {
    const valToken = this.read(syntaxTests.value);
    if (valToken.type === "string")
      return new ZedString(valToken.value);
    else 
      return new ZedNumber(Number(valToken.value));
  }
  readVariableOrValue(): ZedVariable | ZedString | ZedNumber {
    const tok = this.read(syntaxTests.variableOrValue);
    if (tok.type === "variable")
      if (this.testMode)
        return new ZedVariable(tok.value);
      else
        return new ZedVariable(tok.value, this.currIndex()-1, tok);
    else if (tok.type === "string")
      return new ZedString(tok.value);
    else
      return new ZedNumber(Number(tok.value));
  }
}

export class ZedVariable {
  constructor(public identifier: string, public tokenIndex?: number, public token?: Token){}
  toString(){return this.identifier}
}
export class ZedString {
  constructor(public content: string){}
  toString(){return this.content}
}
export class ZedNumber {
  constructor(public value: number){}
  toString(){return this.value.toString()}
}

export class ZedInOutParams {
  items: Array<ZedVariable | ZedString | ZedNumber> = [];
  constructor (t: TokenArray) {
    t.read(syntaxTests.parameterOpen);
    // test for '+' separated parameters
    while (true) {
      // if the next token is ']' then break the loop
      if (t.check(syntaxTests.parameterClose))
        break;
      const param = t.readVariableOrValue();
      this.items.push(param);
      // if the next character is not ']'
      // then assert there is a '+' separator
      if (!t.check(syntaxTests.parameterClose))
        t.read(syntaxTests.parameterSeperator);
    }
    t.read(syntaxTests.parameterClose);
  }
}

export class ZedInput {
  promptParams: ZedInOutParams;
  constructor(t: TokenArray) {
    t.read(syntaxTests.IN);
    this.promptParams = new ZedInOutParams(t);
  }
}

export class ZedAssignment {
  target: ZedVariable;
  operand: ZedVariable | ZedString | ZedNumber | ZedInput;
  operator: MathematicalOperator | null = null;
  startTokenIndex: number;
  endTokenIndex: number;
  constructor(t: TokenArray) {
    this.startTokenIndex = t.currIndex();
    t.read(syntaxTests.assign);
    // get target variable
    this.target = t.readVariable();
    // get operand
    if (t.check(syntaxTests.IN))
      this.operand = new ZedInput(t);
    else
      this.operand = t.readVariableOrValue();
    // get optional operator
    if (t.check(syntaxTests.mathematicalOperator))
      this.operator = t.read(syntaxTests.mathematicalOperator).value as MathematicalOperator;
    this.endTokenIndex = t.currIndex() - 1;
  }
}

export class ZedOutput {
  promptParams: ZedInOutParams;
  constructor(t: TokenArray) {
    t.read(syntaxTests.OUT);
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
    if (t.check(syntaxTests.invert)) {
      t.read(syntaxTests.invert);
      this.invert = true;
    }
    // enfore that there is a conditional operator
    if (t.check(syntaxTests.logicalOperator))
      this.operator = t.read(syntaxTests.logicalOperator).value as LogicalOperator;
    else if (t.check(syntaxTests.relationalOperator))
      this.operator = t.read(syntaxTests.relationalOperator).value as RelationalOperator;
    else
      throw new ParserError(syntaxTests.conditionalOperator, t.assertPeek());
    // parse left hand side
    if (t.check(syntaxTests.conditionalOperator))
      this.left = new ZedCondition(t);
    else
      this.left = t.readVariableOrValue();
    // parse right hand side
    if (t.check(syntaxTests.conditionalOperator))
      this.right = new ZedCondition(t);
    else
      this.right = t.readVariableOrValue();
  }
}

export class ZedCodeBlock {
  statements: (ZedOutput | ZedAssignment | ZedPreTestLoop | ZedPostTestLoop | ZedForLoop | ZedBinarySelection | ZedMultiwaySelection )[] = [];
  errors: ParserError[] = [];
  constructor(t: TokenArray, startBlockTest: SyntaxTest | null, endBlockTest: SyntaxTest) {
    let skipInput = false;
    if (startBlockTest !== null)
      t.read(startBlockTest);
    while (true) {
      try {
        if (t.check(endBlockTest))
          break;
        // if there is just a end of statement by itself
        else if (t.check(syntaxTests.endOfStatement)) {
          t.read(syntaxTests.endOfStatement);
          skipInput = false;
        }
        else if (skipInput) {
          t.assertPeek();
          t.advance();
        }
        // if OUT, make sure there is a :
        else if (t.check(syntaxTests.OUT)) {
          this.statements.push(new ZedOutput(t));
          if (!t.check(syntaxTests.endOfStatement))
            this.errors.push(new ParserError(syntaxTests.endOfStatement, t.assertPeek()));
        }
        // if '=', make sure there is a :
        else if (t.check(syntaxTests.assign)) {
          this.statements.push(new ZedAssignment(t));
          if (!t.check(syntaxTests.endOfStatement))
            this.errors.push(new ParserError(syntaxTests.endOfStatement, t.assertPeek()));
        }
        else if (ZedPreTestLoop.check(t.peek())) {
          const structure = new ZedPreTestLoop(t);
          this.statements.push(structure);
          this.errors.push(...structure.code.errors);
        }
        else if (ZedPostTestLoop.check(t.peek())) {
          const structure = new ZedPostTestLoop(t);
          this.statements.push(structure);
          this.errors.push(...structure.code.errors);
        }
        else if (ZedForLoop.check(t.peek())) {
          const structure = new ZedForLoop(t);
          this.statements.push(structure);
          this.errors.push(...structure.code.errors);
        }
        else if (ZedBinarySelection.check(t.peek())) {
          const structure = new ZedBinarySelection(t);
          this.statements.push(structure);
          for (let [_, block] of structure.conditions)
            this.errors.push(...block.errors);
        }
        else if (ZedMultiwaySelection.check(t.peek())) {
          const structure = new ZedMultiwaySelection(t);
          this.statements.push(structure);
          for (let [_, block] of structure.whenValueThenCode)
            this.errors.push(...block.errors);
        }
        // handle each special loop
        else {
          //error unexpected token;
          // set skip flag, until end of statement
          this.errors.push(new ParserError(syntaxTests.statement, t.assertPeek()));
          t.advance();
          skipInput = true;
        }
      } catch (e) {
        skipInput = true;
        if (e instanceof UnexpectedEndOfProgram) {
          e.currentErrors.unshift(...this.errors);
          throw e;
        }
        else
          this.errors.push(e);
      }
    }
    t.read(endBlockTest);
  }
}

export class ZedDoBlock extends ZedCodeBlock {
  constructor(t: TokenArray) { super(t, syntaxTests.DO, syntaxTests.ENDDO) }
}

export class ZedPreTestLoop {
  condition: ZedCondition;
  code: ZedDoBlock;
  constructor(t: TokenArray) {
    t.read(syntaxTests.WHEN);
    this.condition = new ZedCondition(t);
    this.code = new ZedDoBlock(t);
    t.read(syntaxTests.ENDWHEN);
  }
  static check(t: Token | undefined): boolean {
    return syntaxTests.WHEN.check(t);
  }
}

export class ZedPostTestLoop {
  condition: ZedCondition;
  code: ZedDoBlock;
  constructor(t: TokenArray) {
    t.read(syntaxTests.REPEAT);
    this.code = new ZedDoBlock(t);
    t.read(syntaxTests.UNTIL);
    this.condition = new ZedCondition(t);
    t.read(syntaxTests.ENDREPEAT);
  }
  static check(t: Token | undefined): boolean {
    return syntaxTests.REPEAT.check(t);
  }
}

export class ZedForLoop {
  variable: ZedVariable;
  from: ZedNumber;
  to: ZedNumber;
  by: ZedNumber;
  code: ZedDoBlock;
  constructor(t: TokenArray) {
    t.read(syntaxTests.FOR);
    this.variable = t.readVariable();
    t.read(syntaxTests.FROM);
    this.from = t.readNumber();
    t.read(syntaxTests.TO);
    this.to = t.readNumber();
    t.read(syntaxTests.BY);
    this.by = t.readNumber();
    this.code = new ZedDoBlock(t);
    t.read(syntaxTests.ENDFOR);
  }
  static check(t: Token | undefined): boolean {
    return syntaxTests.FOR.check(t);
  }
}

export class ZedBinarySelection {
  conditions: [ZedCondition | null, ZedDoBlock][] = [];
  constructor(t: TokenArray) {
    t.read(syntaxTests.IF);
    this.conditions.push([
      new ZedCondition(t),
      new ZedDoBlock(t)
    ]);
    while (t.check(syntaxTests.OTHERWISE)) {
      t.read(syntaxTests.OTHERWISE);
      if (t.check(syntaxTests.IF)) {
        t.read(syntaxTests.IF);
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
    t.read(syntaxTests.ENDIF);
  }
  static check(t: Token | undefined): boolean {
    return syntaxTests.IF.check(t);
  }
}

export class ZedMultiwaySelection {
  variable: ZedVariable;
  whenValueThenCode: [(ZedNumber|ZedString),ZedDoBlock][] = [];
  constructor(t: TokenArray) {
    t.read(syntaxTests.SWITCH);
    this.variable = t.readVariable();
    while (!t.check(syntaxTests.ENDSWITCH)) {
      t.read(syntaxTests.WHEN);
      this.whenValueThenCode.push([
        t.readValue(),
        new ZedDoBlock(t),
      ]);
    }
    t.read(syntaxTests.ENDSWITCH);
  }
  static check(t: Token | undefined): boolean {
    return syntaxTests.SWITCH.check(t);
  }
}

export class ZedProgram {
  code: ZedCodeBlock | null;
  errors: (ParserError|UnexpectedEndOfProgram)[];
  identifier: string;
  constructor(t: TokenArray) {
    try {
      t.read(syntaxTests.PROG);
      this.identifier = t.read(syntaxTests.programIdentifier).value;
      this.code = new ZedCodeBlock(t, null, syntaxTests.ENDPROG);
      this.errors = this.code.errors;
    } catch (e) {
      this.code = null;
      this.identifier = '';
      if (e instanceof UnexpectedEndOfProgram)
        this.errors = e.currentErrors;
      else
        this.errors = [e];
    }
  }
}

export function parse(t: Token[]): ZedProgram {
  return new ZedProgram(new TokenArray(t));
}
