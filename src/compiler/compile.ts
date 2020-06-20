// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0
/*
Translator

This part of the compiler is what makes a zed program really work!
It converts the program tree into python code, links a big standard
library of, and unifies all the errors from previous steps.
It provides us diagnostic info on the compiling phases,
and gives us everything we need to interact with an
editor or runtime.
*/

import { Sha1 } from "../deps.ts";
import { lex, Token } from "./lex.ts";
import { TypeCheckInstance } from "./action.ts";
import {
  parse,
  ZedProgram,
  ZedCodeBlock,
  ZedAssignment,
  ZedBinarySelection,
  ZedCondition,
  ZedForLoop,
  ZedInput,
  ZedMultiwaySelection,
  ZedOutput,
  ZedPostTestLoop,
  ZedPreTestLoop,
} from "./parse.ts";

/** Lib Zed defines expected functionality from structures
 * in the zed programming langauge. */
const libZed = `
# libzed
# - division by zero will result in NaN
import math

def zedInput(prompt):
 _in=input(prompt)
 try:
  return int(_in)
 except:
  try:
   return float(_in)
  except:
   return _in

def zedAssign(target, value, operator):
 # string
 if type(target) == str:
  if type(value) == str:
   if operator == '+':
    return target+value
   elif operator == '-':
    return target.replace(value,'')
   elif operator == '*':
    return value.join(list(target))
   elif operator == '/':
    return target.replace(value,'',1)
   elif operator == '%':
    return ''.join(set(target)+set(value))
  elif type(value) == int or type(value) == float:
   if operator == '+':
    return target+(" "*int(value))
   elif operator == '-':
    return target[0:-int(value)]
   elif operator == '*':
    return target*int(value)
   elif operator == '/':
    if value==0: return math.nan
    else: return target[0:len(target)/value]
   elif operator == '%':
    return len(target)%value
 # integer
 elif type(target) == int or type(target) == float:
  if type(value) == str:
   if operator == '+':
    return target + len(value)
   elif operator == '-':
    return target - len(value)
   elif operator == '*':
    return target * len(value)
   elif operator == '/':
    if len(value)==0: return math.nan
    else: return target / len(value)
   elif operator == '%':
    return target % len(value)
  elif type(value) == int or type(value) == float:
   if operator == '+':
    return target + value
   elif operator == '-':
    return target - value
   elif operator == '*':
    return target * value
   elif operator == '/':
    if value==0: return math.nan
    else: return target / value
   elif operator == '%':
    return target % value

`;

/** provide n spaces of indentation */
function indent(n: number): string {
  return ' '.repeat(n);
}

/** compile a code block, in python simply a sequence of statements. */
function compileBlock(code: ZedCodeBlock, indentLevel: number): string {
  if (code.statements.length < 1) return indent(indentLevel)+"pass\n";
  let out = "";
  for (let line of code.statements) {
    if (line instanceof ZedOutput)
      out += compileOutput(line, indentLevel);
    else if (line instanceof ZedAssignment)
      out += compileAssignment(line, indentLevel);
    else if (line instanceof ZedPreTestLoop)
      out += compilePreTest(line, indentLevel);
    else if (line instanceof ZedPostTestLoop)
      out += compilePostTest(line, indentLevel);
    else if (line instanceof ZedForLoop)
      out += compileForLoop(line, indentLevel);
    else if (line instanceof ZedBinarySelection)
      out += compileBinarySelection(line, indentLevel);
    else if (line instanceof ZedMultiwaySelection)
      out += compileMultiwaySelection(line, indentLevel);
    out += "\n";
  }
  return out;
}

/** compile an OUT[] statement */
function compileOutput(struct: ZedOutput, indentLevel: number): string {
  // join the parameters with commas, the sep='' ensures they are joined direct, and not with spaces
  return indent(indentLevel)+`print(${[...struct.promptParams.items,''].join(',')}sep='')`;
}

/** Compile an assignment e.g. '= A1 1:' -> 'A1 = 1' */
function compileAssignment(struct: ZedAssignment, indentLevel: number): string {
  let operand;
  if (struct.operand instanceof ZedInput)
    // translate to the special libZed function for auto data-type creation
    operand = 'zedInput('+struct.operand.promptParams.items.map(v=>`str(${v})`).join('+')+')';
  else
    operand = struct.operand.toString();
  // output variable with inital indent for first line
  let out: string = indent(indentLevel);
  // if there is an operator, we'll use the libZed function for overloading operators
  if (struct.operator !== null)
    out += `${struct.target} = zedAssign(${struct.target},${operand},'${struct.operator}')`;
  // if there is no operator, we can do a straight assignment
  else
    out += `${struct.target} = ${operand}`;
  return out;
}

/** compiles the condition recursively */
function compileCondition(struct: ZedCondition): string {
  let out = "";
  // replace && and || with python's equivelant
  let operator = struct.operator.replace("&&","and").replace("||","or");
  // place 'not' to invert truthiness if required
  out += (struct.invert ? "not" : "") + "(";
  if (struct.left instanceof ZedCondition)
    out += compileCondition(struct.left);
  else
    // not a condition, output the value
    out += struct.left.toString();
  // insert the conditional operator
  out += " "+operator+" ";
  if (struct.right instanceof ZedCondition)
    out += compileCondition(struct.right);
  else
    // not a condition, output the value
    out += struct.right.toString();
  out += ")";
  return out;
}

/** compile WHEN loop */
function compilePreTest(struct: ZedPreTestLoop, indentLevel: number): string {
  // a simple while loop in python
  return indent(indentLevel)+`while ${compileCondition(struct.condition)}:\n${compileBlock(struct.code, indentLevel+1)}`;
}

/** Compile REPEAT loop */
function compilePostTest(struct: ZedPostTestLoop, indentLevel: number): string {
  // a repeat is a While True loop, with a condition in the bottom to break out.
  return `${indent(indentLevel)}while True:\n${compileBlock(struct.code, indentLevel+1)}${indent(indentLevel+1)}if ${compileCondition(struct.condition)}:\n${indent(indentLevel+2)}break`;
}

/** Compile FOR loop */
function compileForLoop(struct: ZedForLoop, indentLevel: number): string {
  // for VARIBALE in range(FROM, TO + 1, BY): ...
  return indent(indentLevel)+`for ${struct.variable} in range(${struct.from},${struct.to}+1,${struct.by}):\n${compileBlock(struct.code, indentLevel+1)}`;
}

/** Compile IF-OTHERWISE-IF-ELSE-IF statement */
function compileBinarySelection(struct: ZedBinarySelection, indentLevel: number): string {
  //python uses if: elif: else:
  let out = indent(indentLevel)+`if ${compileCondition(struct.conditions[0][0]!)}:\n${compileBlock(struct.conditions[0][1], indentLevel+1)}`;
  for (let i = 1; i < struct.conditions.length; i++) {
    // compile the OTHERWISE-IF... !== null means there is a condition to parse
    if (struct.conditions[i][0] !== null)
      out += indent(indentLevel)+`elif ${compileCondition(struct.conditions[i][0]!)}:\n${compileBlock(struct.conditions[i][1], indentLevel+1)}`;
    // parse the OTHERWISE / else / final block
    else 
      out += indent(indentLevel)+`else:\n${compileBlock(struct.conditions[i][1], indentLevel+1)}`;
  }
  return out;
}

/** Compile SWITCH-WHEN */
function compileMultiwaySelection(struct: ZedMultiwaySelection, indentLevel: number): string {
  // if there is no body, no need to compile
  if (struct.whenValueThenCode.length < 1) return '';
  // use if: elif: for multiway, so the first option is chosen and the others disregarded.
  let out = indent(indentLevel)+`if ${struct.variable} == ${struct.whenValueThenCode[0][0].toString()}:\n${compileBlock(struct.whenValueThenCode[0][1], indentLevel+1)}`;
  // iterate each subsequent line after the inital if
  for (let i = 1; i < struct.whenValueThenCode.length; i++)
    out += indent(indentLevel)+`elif ${struct.variable} == ${struct.whenValueThenCode[i][0]}:\n${compileBlock(struct.whenValueThenCode[i][1], indentLevel+1)}`;
  return out;
}

/** Compile the whole tree of a program to python, including libZed. */
function translateProgram(p: ZedProgram): string {
  // if there is no code, output a null value just to be sure of python's stability
  if (p.code === null) return "None";
  let indentLevel = 0;
  let output = "";
  // preprend libZed functionality
  output += libZed;
  // create main function
  output += `def ${p.identifier}():\n`;
  // compiled mainline
  output += compileBlock(p.code, indentLevel+1);
  // call for main function
  output += p.identifier+"()\n";
  return output;
}

/** Represents a unified error in the whole compilation process. */
export interface CompilationError {
  type: "eof" | "parser" | "undefined";
  message: string;
  token: Token | null;
}

/** The result of compiling source code. */
export interface CompilationResult {
  hash: string;
  success: boolean;
  timeMs: number;
  source: string;
  output: string;
  errors: CompilationError[];
  programName: string;
}

/** Takes program source, performs lexical analysis, syntactic analysis, type checking, translation,
 * returns all info required to use the compiled program. */
export function compileSource(sourceCode: string): CompilationResult {
  const errors: CompilationError[] = [];
  // generate a CRC hash of source for retrieving by the zeditor
  const hash = new Sha1().update(sourceCode).hex();
  /** Stores the output object code */
  let objCode: string = '';
  /** begin timing compilation */
  const startTime = performance.now();
  // lexical analysis
  const toks = lex(sourceCode);
  // syntactic analysis
  const program = parse(toks);
  // if the program was cut short, unify the EOF error
  if (program.unexpectedEnd)
    errors.push({type: "eof", message: "Unexpected end of file.", token: null})
  // for all other parsing errors, unify them
  for (let e of program.errors) {
    errors.push({type: "parser", message: e.message, token: e.token});
  }
  // if the code is  not null (the body was successfully parsed somewhat),
  // then we should type check the variables referenced.
  if (program.code !== null) {
    // check the types of the program, and unify the errors regarding undefined variables.
    for (let e of new TypeCheckInstance(program).errors) {
      errors.push({type: "undefined", message: e.message, token: e.variable.token!});
    }
    // if there are no errors, then translate
    if (errors.length < 1) objCode = translateProgram(program);
  }
  // stop the stopwatch
  const endTime = performance.now();
  return <CompilationResult>{
    hash: hash,
    success: errors.length < 1,
    timeMs: endTime - startTime,
    source: sourceCode,
    output: objCode,
    errors: errors,
    programName: program.identifier,
  };
}
