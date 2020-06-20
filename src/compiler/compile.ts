// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

import { Sha1 } from "../deps.ts";
import { lex, Token } from "./lex.ts";
import { TypeCheckInstance, ZedUndefinedError } from "./action.ts";
import {
  parse,
  UnexpectedEndOfProgram,
  ParserError,
  ZedProgram,
  ZedCodeBlock,
  ZedAssignment,
  ZedBinarySelection,
  ZedCondition,
  ZedForLoop,
  ZedInput,
  ZedMultiwaySelection,
  ZedNumber,
  ZedOutput,
  ZedPostTestLoop,
  ZedPreTestLoop,
  ZedString,
  ZedVariable,
} from "./parse.ts";

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

`;

function indent(n: number): string {
  return ' '.repeat(n);
}

function compileBlock(code: ZedCodeBlock, indentLevel: number): string {
  if (code.statements.length < 1) return indent(indentLevel)+"pass\n";
  let out = "";
  for (let line of code.statements) {
    if (line instanceof ZedOutput)
      out += compileOutput(line, indentLevel+1);
    else if (line instanceof ZedAssignment)
      out += compileAssignment(line, indentLevel+1);
    else if (line instanceof ZedPreTestLoop)
      out += compilePreTest(line, indentLevel+1);
    else if (line instanceof ZedPostTestLoop)
      out += compilePostTest(line, indentLevel+1);
    else if (line instanceof ZedForLoop)
      out += compileForLoop(line, indentLevel+1);
    else if (line instanceof ZedBinarySelection)
      out += compileBinarySelection(line, indentLevel+1);
    else if (line instanceof ZedMultiwaySelection)
      out += compileMultiwaySelection(line, indentLevel+1);
    out += "\n";
  }
  return out;
}

function compileOutput(struct: ZedOutput, indentLevel: number): string {
  return indent(indentLevel)+`print(${struct.promptParams.items.join(',')},sep='')`;
}

function compileAssignment(struct: ZedAssignment, indentLevel: number): string {
  let assignValue;
  if (struct.operand instanceof ZedInput)
    assignValue = 'zedInput('+struct.operand.promptParams.items.map(v=>`str(${v})`).join('+')+')';
  else
    assignValue = struct.operand.toString();
  let out: string = indent(indentLevel);
  if (struct.operator !== null)
    out += `${struct.target} = zedAssign(${struct.target},${assignValue},'${struct.operator}')`;
  else
    out += `${struct.target} = ${assignValue}`;
  return out;
}

function compileCondition(struct: ZedCondition): string {
  let out = "";
  let operator = struct.operator.replace("&&","and").replace("||","or");
  out += (struct.invert ? "not" : "") + "(";
  if (struct.left instanceof ZedCondition)
    out += compileCondition(struct.left);
  else
    out += struct.left.toString();
  out += " "+operator+" ";
  if (struct.right instanceof ZedCondition)
    out += compileCondition(struct.right);
  else
    out += struct.right.toString();
  out += ")";
  return out;
}

function compilePreTest(struct: ZedPreTestLoop, indentLevel: number): string {
  return indent(indentLevel)+`while ${compileCondition(struct.condition)}:\n${compileBlock(struct.code, indentLevel+1)}`;
}

function compilePostTest(struct: ZedPostTestLoop, indentLevel: number): string {
  return indent(indentLevel)+`while True:\n${compileBlock(struct.code, indentLevel+1)}if ${compileCondition(struct.condition)}:break`;
}

function compileForLoop(struct: ZedForLoop, indentLevel: number): string {
  return indent(indentLevel)+`for ${struct.variable} in range(${struct.from},${struct.to}+1,${struct.by}):\n${compileBlock(struct.code, indentLevel+1)}`;
}

function compileBinarySelection(struct: ZedBinarySelection, indentLevel: number): string {
  let out = indent(indentLevel)+`if ${compileCondition(struct.conditions[0][0]!)}:\n${compileBlock(struct.conditions[0][1], indentLevel+1)}`;
  for (let i = 1; i < struct.conditions.length; i++) {
    if (struct.conditions[i][0] !== null)
      out += `else if ${compileCondition(struct.conditions[i][0]!)}:\n${compileBlock(struct.conditions[i][1], indentLevel+1)}`;
    else 
      out += `else:\n${compileBlock(struct.conditions[0][1], indentLevel+1)}`;
  }
  return out;
}

function compileMultiwaySelection(struct: ZedMultiwaySelection, indentLevel: number): string {
  if (struct.whenValueThenCode.length < 0) return '';
  let out = indent(indentLevel)+`if ${struct.variable} == ${struct.whenValueThenCode[0][0].toString()}:\n${compileBlock(struct.whenValueThenCode[0][1], indentLevel+1)}`;
  for (let i = 1; i < struct.whenValueThenCode.length; i++)
    out += `else if ${struct.variable} == ${struct.whenValueThenCode[i][0]}:\n${compileBlock(struct.whenValueThenCode[i][1], indentLevel+1)}`;
  return out;
}

function compile(p: ZedProgram): string {
  if (p.code === null) return "None";
  let indentLevel = 0;
  let output = "";
  output += libZed;
  // create main function
  output += `def ${p.identifier}():\n`;
  output += compileBlock(p.code, indentLevel+1);
  output += p.identifier+"()\n";
  return output;
}

export interface CompilationError {
  type: "eof" | "parser" | "undefined";
  message: string;
  token: Token | null;
}

export interface CompilationResult {
  hash: string;
  success: boolean;
  timeMs: number;
  source: string;
  output: string;
  errors: CompilationError[];
  programName: string;
}

export function compileSource(sourceCode: string): CompilationResult {
  const errors: CompilationError[] = [];
  const hash = new Sha1().update(sourceCode).hex();
  let objCode: string = '';
  const startTime = performance.now();
  const toks = lex(sourceCode);
  const program = parse(toks);
  if (program.unexpectedEnd)
    errors.push({type: "eof", message: "Unexpected end of file.", token: null})
  for (let e of program.errors) {
    errors.push({type: "parser", message: e.message, token: e.token});
  }
  if (program.code !== null) {
    for (let e of new TypeCheckInstance(program).errors) {
      errors.push({type: "undefined", message: e.message, token: e.variable.token!});
    }
    if (errors.length < 1) objCode = compile(program);
  }
  const endTime = performance.now();
  return {
    hash: hash,
    success: errors.length < 1,
    timeMs: endTime - startTime,
    source: sourceCode,
    output: objCode,
    errors: errors,
    programName: program.identifier,
  };
}
