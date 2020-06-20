// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

// walk the program tree, and get what's in what scope

import {
  ZedProgram,
  ZedCodeBlock,
  ZedAssignment,
  ZedVariable,
  ZedForLoop,
  ZedOutput,
  ZedMultiwaySelection,
} from "./parse.ts";

export class ZedUndefinedError extends Error {
  constructor(public variable: ZedVariable){super(`Undefined variable '${variable.identifier}' at line ${variable.token?.line} char ${variable.token?.position}`)}
}

export class TypeCheckInstance {
  errors: ZedUndefinedError[] = [];
  currentScope: string[][] = [];
  constructor(p: ZedProgram) {
    if (p.code === null) throw "TYPECHECKSHOULDNOTHAVEBEENCALLED";
    this.checkTypes({code: p.code!});
    //console.log(this.errors)
  }
  inScope(identifier: string): boolean {
    for (let a of this.currentScope)
      for (let b of a)
        { if (b === identifier) return true };
    return false;
  }
  checkTypes(b: {code: ZedCodeBlock}) {
    const scope: string[] = [];
    this.currentScope.push(scope);
    for (let stmt of b.code.statements) {
      if (stmt instanceof ZedAssignment) {
        let success = true;
        if (stmt.operator !== null && !this.inScope(stmt.target.identifier)) {
          this.errors.push(new ZedUndefinedError(stmt.target));
          success = false;
        }
        if (stmt.operand instanceof ZedVariable && !this.inScope(stmt.operand.identifier)) {
          this.errors.push(new ZedUndefinedError(stmt.operand));
          success = false;
        }
        if (success && !this.inScope(stmt.target.identifier))
          scope.push(stmt.target.identifier);
      }
      // test for variables used in an OUT[] statement
      else if (stmt instanceof ZedOutput) {
        // go through each item in the prompt list
        //console.log(stmt.promptParams.items);
        for (let param of stmt.promptParams.items) {
          // if its a variable, we're interested in it
          if (param instanceof ZedVariable) {
            // if the variable is not in scope
            // then throw undefined error
            if (!this.inScope(param.identifier))
              this.errors.push(new ZedUndefinedError(param));
          }
        }
      }
      else if (stmt instanceof ZedMultiwaySelection) {
        if (!this.inScope(stmt.variable.identifier))
          this.errors.push(new ZedUndefinedError(stmt.variable));
        else
          scope.push(stmt.variable.identifier);
        for (let whenBlock of stmt.whenValueThenCode) {
          this.checkTypes({code: whenBlock[1]});
        }
      }
      else if ('code' in stmt) {
        if (stmt instanceof ZedForLoop) scope.push(stmt.variable.identifier);
        this.checkTypes(stmt);
      }
    }
    //console.log(this.currentScope);
    this.currentScope.pop();
  }
}


