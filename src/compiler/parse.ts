// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0
/*
Syntactic Analysis

This is the most complex and significant part of the compiler.
It takes a list of meaningful tokens, and infers context. It
has to be kind enough to see the user's errors, and guide them
towards a solution with error messages.
*/

import { Token, TokenType } from "./lex.ts";

const mathematicalOperators = ["+","-","*","/","%"] as const;
const logicalOperators = ["&&","||"] as const;
const relationalOperators = [">=","<=",">","<","=="] as const;

export type MathematicalOperator = typeof mathematicalOperators[number];
export type LogicalOperator = typeof logicalOperators[number];
export type RelationalOperator = typeof relationalOperators[number];

/** A prototype for error generating functions to follow. */
type ErrorMessageFormatter = (t: Token, tokenTypes: TokenType[], tokenValues: string[])=>string;

/** A test to check if a Token follows the test's rules. */
class SyntaxTest {
  constructor (
    /** The message generator for user-friendly output */
    private errorMsgHandler: ErrorMessageFormatter,
    /** Rule defining allowable types */
    private allowedTypes: TokenType[] = [],
    /** Rule defining allowable values */
    private allowedValues: string[] = [],
  ) {}
  /** Check whether the given Token (which may or may not exist) follows the Test's rules. */
  check(t: Token | undefined): boolean {
    let valid = true;
    if (t === undefined)
      valid = false;
    // if allowedTypes > 0, then we are applying rules regarding token types
    else if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(t.type))
      valid = false;
      // if allowedValues > 0, then we are applying rules regarding token values
    else if (this.allowedValues.length > 0 && !this.allowedValues.includes(t.value))
      valid = false;
    return valid;
  }
  /** Generate a error message specific to this test, including context from the given token. */
  errorMsg(t: Token): string {
    return this.errorMsgHandler(t, this.allowedTypes, this.allowedValues);
  }
}

/** Defined templates for generating messages. */
const errorHandlers = {
  /** Message formatter regarding a token that was expected, but not found. */
  expectedToken: function(t, tokenTypes, tokenValues) {
    return `Expected ${tokenTypes.join(" or ")} '${tokenValues}' instead of '${t.value}' at line ${t.line} char ${t.position}.`;
  } as ErrorMessageFormatter,
  /** Message formatter regarding the absence of a Program Identifier. */
  expectedProgramIdentifier: function(t, tokenTypes, tokenValues) {
    return `Expected a program identifier instead of '${t.value}' at line ${t.line} char ${t.position}.`;
  } as ErrorMessageFormatter
} as const;

/** Defined tests for all language features in Zed. */
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
    "=", /*"DO",*/ "OUT", "IF", "SWITCH", "FOR", "WHEN", "REPEAT"
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

/** An error in the structure of the source code. */
export class ParserError extends Error {
  constructor(test: SyntaxTest, public token: Token) {
    super(test.errorMsg(token));
  }
}

/** An unclosed block meant the parser assumed it should be able to keep going,
 *  but it reached the end of the file. */
export class UnexpectedEndOfProgram extends Error {
  currentErrors: ParserError[] = [];
}

/** Helper singleton for reading off tokens. */
export class TokenArray {
  /** Private storage of the program tokens. */
  #data: Token[];
  /** Private storage of the Parser's Head's current position. */
  #index: number = 0;
  constructor(init: Token[], private testMode=false){this.#data = init;}
  /** Move the head of the Parser forward by 1. */
  advance(){this.#index++;}
  /** Peek at the next token, which may or may not exist. */
  peek(): Token | undefined { return this.#data[this.#index]; }
  /** Get the current position of the Parser head. */
  currentIndex(){ return this.#index; }
  /** Peeks at the next token, but if the end of the program has been reached, throws. */
  assertPeek(){
    const tok = this.peek();
    if (tok === undefined)
      throw new UnexpectedEndOfProgram("UNEXPECTED_END_OF_PROGRAM");
    else
      return tok as Token;
  }
  /** Read off the next token, and assert that it passes the given test.
   *  Advances the Parser head. */
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
  /** Check whether the next token will pass the given test. */
  check(test: SyntaxTest): boolean {
    return test.check(this.peek());
  }
  /** Read off the next token, asserting it as a number, and returning a ZedNumber */
  readNumber(): ZedNumber {
    const numberToken = this.read(syntaxTests.number);
    return new ZedNumber(Number(numberToken.value));
  }
  /** Read off the next token, asserting it as a variable, and returning a ZedVariable */
  readVariable(): ZedVariable {
    const variableToken = this.read(syntaxTests.variable);
    // a check which enables unit testing to be much simpler
    if (this.testMode)
      return new ZedVariable(variableToken.value);
    else
      // create a variable, with identifier,
      // at the given index in the class's #data property,
      // and pass in a reference to the token.
      return new ZedVariable(variableToken.value, this.currentIndex()-1, variableToken);
  }
  /** Read off the next token, asserting it as a string or number, returns ZedString or ZedNumber */
  readValue(): ZedString | ZedNumber {
    const valueToken = this.read(syntaxTests.value);
    if (valueToken.type === "string")
      return new ZedString(valueToken.value);
    else 
      return new ZedNumber(Number(valueToken.value));
  }
  /** Read off the next token, asserting it as a variable, string, or number, returns ZedVariable, ZedString or ZedNumber */
  readVariableOrValue(): ZedVariable | ZedString | ZedNumber {
    const token = this.read(syntaxTests.variableOrValue);
    if (token.type === "variable")
      if (this.testMode)
        return new ZedVariable(token.value);
      else
        return new ZedVariable(token.value, this.currentIndex()-1, token);
    else if (token.type === "string")
      return new ZedString(token.value);
    else
      return new ZedNumber(Number(token.value));
  }
}

/** A Zed variable */
export class ZedVariable {
  constructor(public identifier: string, public tokenIndex?: number, public token?: Token){}
  toString(){return this.identifier}
}

/** A Zed string. */
export class ZedString {
  constructor(public content: string){}
  toString(){return this.content}
}

/** A Zed number */
export class ZedNumber {
  constructor(public value: number){}
  toString(){return this.value.toString()}
}

/** Constructs/Parses the [a,b,c,...] in an IN[] or OUT[] statement */
export class ZedInOutParams {
  /** the data values being used in the prompt or message */
  items: Array<ZedVariable | ZedString | ZedNumber> = [];
  constructor (t: TokenArray) {
    // assert the opening left-bracket
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
    // assert the closing right-bracket
    t.read(syntaxTests.parameterClose);
  }
}

/** Constructs/Parses an IN statement */
export class ZedInput {
  promptParams: ZedInOutParams;
  constructor(t: TokenArray) {
    t.read(syntaxTests.IN);
    this.promptParams = new ZedInOutParams(t);
  }
}

/** Constructs/Parses an assignment statement, e.g. '= A1 1:' */
export class ZedAssignment {
  /** the variable being assigned */
  target: ZedVariable;
  /** the value or the location of the value being assigned. */
  operand: ZedVariable | ZedString | ZedNumber | ZedInput;
  /** The operator being applied between Target & Operand */
  operator: MathematicalOperator | null = null;
  constructor(t: TokenArray) {
    // assert the starting '='
    t.read(syntaxTests.assign);
    // get target variable
    this.target = t.readVariable();
    // get operand
    // if it is an IN[], then construct a new IN.
    if (t.check(syntaxTests.IN))
      this.operand = new ZedInput(t);
    // otherwise read off a variable or number or string
    else
      this.operand = t.readVariableOrValue();
    // get optional operator, by checking if it is the next token, otherwise finish constructing
    if (t.check(syntaxTests.mathematicalOperator))
      this.operator = t.read(syntaxTests.mathematicalOperator).value as MathematicalOperator;
  }
}

/** Construct/Parse an OUT[] statement */
export class ZedOutput {
  promptParams: ZedInOutParams;
  constructor(t: TokenArray) {
    t.read(syntaxTests.OUT);
    this.promptParams = new ZedInOutParams(t);
  }
}

/** Construct / Parse a condition */
export class ZedCondition {
  /** the logical or relational operator: e.g. ==, && ||, <=, etc.. */
  operator: LogicalOperator | RelationalOperator;
  /** the "left" hand side is either a variable, value or another (recursed) condition  */
  left: ZedCondition | ZedVariable | ZedString | ZedNumber;
  /** the "right" hand side is either a variable, value or another (recursed) condition  */
  right: ZedCondition | ZedVariable | ZedString | ZedNumber;
  /** whether the invert '!' operator was present to reverse the truthiness */
  invert: boolean = false;
  constructor(t: TokenArray) {
    // test for an invert operator
    if (t.check(syntaxTests.invert)) {
      t.read(syntaxTests.invert);
      this.invert = true;
    }
    // enforce that there is a conditional operator
    if (t.check(syntaxTests.logicalOperator))
      this.operator = t.read(syntaxTests.logicalOperator).value as LogicalOperator;
    else if (t.check(syntaxTests.relationalOperator))
      this.operator = t.read(syntaxTests.relationalOperator).value as RelationalOperator;
    // otherwise throw an error up the chain
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

/** Constructs/Parses a Code block in Zed. */
export class ZedCodeBlock {
  /** The control structures present in the block. */
  statements: (ZedOutput | ZedAssignment | ZedPreTestLoop | ZedPostTestLoop | ZedForLoop | ZedBinarySelection | ZedMultiwaySelection )[] = [];
  /** Any errors encountering while parsing each statement. This is propagated upwards. */
  errors: ParserError[] = [];
  constructor(
    /** the program token array */
    t: TokenArray,
    /** the (optionally required) start keyword test */
    openingKeywordTest: SyntaxTest | null,
    /** the required end keyword test */
    closingKeywordTest: SyntaxTest
  ) {
    /** this flag allows us to skip until the end of the block or the next ':' incase of an error.
     * this is a more graceful approach to error handling. */
    let skipInput = false;
    // test for the optional keyword
    if (openingKeywordTest !== null)
      t.read(openingKeywordTest);
    // keep looping until we meet certain conditions.
    while (true) {
      try {
        // if we get to the closing keyword, break the parsing loop to finalise construction
        if (t.check(closingKeywordTest))
          break;
        // if there is just a end of statement by itself handle it,
        // or if we find the next ':' after skipping input
        else if (t.check(syntaxTests.endOfStatement)) {
          t.read(syntaxTests.endOfStatement);
          skipInput = false;
        }
        // while skipping unimportant import, don't throw parsererrors to avoid mass amounts
        // of unexpected token errors.
        else if (skipInput) {
          t.assertPeek();
          t.advance();
        }
        // if OUT, make sure there is a :
        else if (t.check(syntaxTests.OUT)) {
          this.statements.push(new ZedOutput(t));
          // if there is no ':' throw an error
          if (!t.check(syntaxTests.endOfStatement))
            this.errors.push(new ParserError(syntaxTests.endOfStatement, t.assertPeek()));
        }
        // if '=', make sure there is a :
        else if (t.check(syntaxTests.assign)) {
          this.statements.push(new ZedAssignment(t));
          // if there is no ':' throw an error
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
          // iterate each block of the if,
          // appending any errors encountered to the errors to be propagated
          for (let [_, block] of structure.conditions)
            this.errors.push(...block.errors);
        }
        else if (ZedMultiwaySelection.check(t.peek())) {
          const structure = new ZedMultiwaySelection(t);
          this.statements.push(structure);
          this.errors.push(...structure.errors);
          // propagate errors up
          for (let [_, block] of structure.whenValueThenCode)
            this.errors.push(...block.errors);
        }
        else {
          // If we reach here, we have encountered an unexpected token;
          // Add an error to alert the user to a misplaced keyword,
          // or improper start to a statement.
          // Set skip flag, until end of statement
          this.errors.push(new ParserError(syntaxTests.statement, t.assertPeek()));
          // because we can't do anything with this token, advance and discard it
          t.advance();
          // skip until the end of the block, or until an end of statement ':'
          skipInput = true;
        }
      } catch (e) {
        // If an error occured catch it to handle it cleanly,
        // allowing a recovery.
        // Also skip input until end of block or ':'
        skipInput = true;
        // if the end of the program was reached, throw up the chain to force compilation to halt
        if (e instanceof UnexpectedEndOfProgram) {
          // append the error so in the editor it will show up as an unexpectedly early finish to the file
          // this moves all errors encounterd so far into the EOF error, so that they are not lost
          e.currentErrors.unshift(...this.errors);
          throw e;
        }
        // if it is not fatal, just track it in the list of errors to be propagated further
        else
          this.errors.push(e);
      }
    }
    // assert that the block ends with the following keyword
    t.read(closingKeywordTest);
  }
}

/** Extend the CodeBlock, to construct a block starting with DO and finishing with ENDDO */
export class ZedDoBlock extends ZedCodeBlock {
  constructor(t: TokenArray) { super(t, syntaxTests.DO, syntaxTests.ENDDO) }
}

/** Construct/Parse a WHEN loop */
export class ZedPreTestLoop {
  /** The condition on which the loop will still run if met.  */
  condition: ZedCondition;
  /** The code to run */
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

/** Construct/Parse a REPEAT loop */
export class ZedPostTestLoop {
  /** The condition on which the loop will terminate when met. */
  condition: ZedCondition;
  /** The code to be run. */
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

/** Construct/Parse a FOR loop */
export class ZedForLoop {
  /** The variable which will be assigned for use in the loop */
  variable: ZedVariable;
  /** The starting number */
  from: ZedNumber;
  /** The ending number */
  to: ZedNumber;
  /** How much to increase the variable by each iteration. */
  by: ZedNumber;
  /** The code to run */
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

/** Construct/Parse an IF statement */
export class ZedBinarySelection {
  /** The conditions, and the blocks that will be run when satisfied. The null condition is the else block. */
  conditions: [ZedCondition | null, ZedDoBlock][] = [];
  constructor(t: TokenArray) {
    t.read(syntaxTests.IF);
    // read of the first condition
    this.conditions.push([
      new ZedCondition(t),
      new ZedDoBlock(t)
    ]);
    // read subsequent conditions
    while (t.check(syntaxTests.OTHERWISE)) {
      t.read(syntaxTests.OTHERWISE);
      // parse an OTHERWISE-IF (akin to C's else if)
      if (t.check(syntaxTests.IF)) {
        t.read(syntaxTests.IF);
        this.conditions.push([
          new ZedCondition(t),
          new ZedDoBlock(t)
        ]);
      }
      // parse and OTHERWISE (akin to C's else)
      else {
        this.conditions.push([
          null,
          new ZedDoBlock(t)
        ]);
        // break to ensure this is the final block in the IF statement
        break;
      }
    }
    t.read(syntaxTests.ENDIF);
  }
  static check(t: Token | undefined): boolean {
    return syntaxTests.IF.check(t);
  }
}

/** Construct/Parse a SWITCH sequence */
export class ZedMultiwaySelection {
  /** The variable to switch blocks based upon */
  variable: ZedVariable;
  /** A map of the value which when met will result in the associated code being run. */
  whenValueThenCode: [(ZedNumber|ZedString),ZedDoBlock][] = [];
  /** Any errors encountered in parsing the WHEN blocks inside */
  errors: ParserError[] = [];
  constructor(t: TokenArray) {
    // flag to fail fast to the next when if failure occurs
    let skipToNextWhen = false;
    t.read(syntaxTests.SWITCH);
    this.variable = t.readVariable();
    // keep looping until the ENDSWITCH keyword is met
    while (!t.check(syntaxTests.ENDSWITCH)) {
      if (t.check(syntaxTests.WHEN)) {
        t.read(syntaxTests.WHEN);
        // no need to skip when we are about to parse a when block
        skipToNextWhen = false;
      }
      // skip and disregard input, but ensure we don't step into EOF space
      else if (skipToNextWhen) {
        t.advance();
        t.assertPeek();
      }
      // parse the value DO ENDDO after the WHEN
      else {
        try {
          this.whenValueThenCode.push([
            t.readValue(),
            new ZedDoBlock(t),
          ]);
        } catch (e) {
          // if we enconuter EOF, throw up the chain
          if (e instanceof UnexpectedEndOfProgram)
            throw e;
          // otherwise push the encountered error, and skip until next when
          else {
            this.errors.push(e);
            skipToNextWhen = true;
          }
        }
      }
    }
    t.read(syntaxTests.ENDSWITCH);
  }
  static check(t: Token | undefined): boolean {
    return syntaxTests.SWITCH.check(t);
  }
}

/** Construct/Parse a Zed Program */
export class ZedProgram {
  /** The mainline code */
  code: ZedCodeBlock | null;
  /** All errors encounterd in parsing the program, that have been propagated up. */
  errors: ParserError[];
  /** The name of the program as it appears in source */
  identifier: string;
  /** Whether the file is a complete source file, or missing the end. */
  unexpectedEnd: boolean = false;
  constructor(t: TokenArray) {
    try {
      t.read(syntaxTests.PROG);
      this.identifier = t.read(syntaxTests.programIdentifier).value;
      this.code = new ZedCodeBlock(t, null, syntaxTests.ENDPROG);
      this.errors = this.code.errors;
    } catch (e) {
      // no valid code if errors occurs
      this.code = null;
      // no valid identifier
      this.identifier = '';
      // if eof, get all errors from currentErrors
      if (e instanceof UnexpectedEndOfProgram) {
        // get the errors from the so-far parsed code
        // which were progagated up the chain in the DoBlock
        this.errors = e.currentErrors;
        this.unexpectedEnd = true;
      }
      // if there is an error in the PROG identifier ENDPROG then
      // that is the only error that will show up.
      else
        this.errors = [e];
    }
  }
}

/** Takes program tokens from lex, parses them, and returns a Program...
 *  which is the tree representing the logic of the program to be translated */
export function parse(t: Token[]): ZedProgram {
  return new ZedProgram(new TokenArray(t));
}

// HAIKU
/*
 * Lex's tokens passed,
 * Magically they are parsed,
 * Tree casts summer shade.
*/
