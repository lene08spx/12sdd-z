// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0
/*
Action Checking (Typically the type checker)

Here in Zed, the IN[] is typically ambiguous.
We are never sure of its return; either a string,
integer or float. Therefore, the job of the type
checker is much simpler: to test whether the
variable is defined at the point it is referenced
in the program tree. 

The undefined-type-checker walks the program tree,
and pushes onto a stack the identifiers of currently
in scope variables.
*/

import {
  ZedProgram,
  ZedCodeBlock,
  ZedAssignment,
  ZedVariable,
  ZedForLoop,
  ZedOutput,
  ZedMultiwaySelection,
  ZedBinarySelection,
  ZedCondition,
  ZedPreTestLoop,
  ZedPostTestLoop,
  ZedInOutParams,
  ZedInput,
} from "./parse.ts";

/** Represents an undefined variable at a given point. */
export class ZedUndefinedError extends Error {
  constructor(public variable: ZedVariable){super(`Undefined variable '${variable.identifier}' at line ${variable.token?.line} char ${variable.token?.position}`)}
}

/** Singleton constructor to check the types of the given program. */
export class TypeCheckInstance {
  /** All occurences of undefined variables are tracked in this array. */
  errors: ZedUndefinedError[] = [];
  /** The currently in scope variables are tracked in a stack. */
  currentScope: string[][] = [];
  constructor(p: ZedProgram) {
    // this is a silly line, just to keep me in check interms of when i'm calling things in the script host.
    if (p.code === null) throw "TYPECHECKSHOULDNOTHAVEBEENCALLED";
    // begin to recursively check types.
    this.checkTypes({code: p.code!});
  }
  /** Tests whether a given variable identifier is currently in scope. */
  inScope(identifier: string): boolean {
    // walk
    for (let blockScope of this.currentScope)
      for (let inScopeVariableIdentifier of blockScope)
        { if (inScopeVariableIdentifier === identifier) return true };
    return false;
  }
  /** Recursively check the state of variables referenced in a condition */
  checkCondition(condition: ZedCondition) {
    // if the LHS is a variable, and doesn't exist, then error
    if (condition.left instanceof ZedVariable && !this.inScope(condition.left.identifier))
      this.errors.push(new ZedUndefinedError(condition.left));
    // if the LHS is a conditon, recursively check it.
    else if (condition.left instanceof ZedCondition)
      this.checkCondition(condition.left);
    // if the RHS is a variable, and doesn't exist, then error
    if (condition.right instanceof ZedVariable && !this.inScope(condition.right.identifier))
      this.errors.push(new ZedUndefinedError(condition.right));
    // if the RHS is a conditon, recursively check it.
    else if (condition.right instanceof ZedCondition)
      this.checkCondition(condition.right);
  }
  /** Check the state of variables in the param list */
  checkParams(params: ZedInOutParams) {
    for (let item of params.items) {
      // go through each item in the prompt list
      for (let param of params.items) {
        // if its a variable, we're interested in it
        if (param instanceof ZedVariable) {
          // if the variable is not in scope
          // then throw undefined error
          if (!this.inScope(param.identifier))
            this.errors.push(new ZedUndefinedError(param));
        }
      }
    }
  }
  /** Recursively checks the state of variables in a tree containing a codeBlock. */
  checkTypes(b: {code: ZedCodeBlock}) {
    // create the current block scope.
    const scope: string[] = [];
    // refernce the block scope in the program's whole scope
    this.currentScope.push(scope);
    // go through each instruction and find every variable and test whether its in scope
    for (let stmt of b.code.statements) {
      if (stmt instanceof ZedAssignment) {
        // thes are tricky, and so require mutliple checks
        let success = true;
        // if there is an operator, the target variable must exist
        if (stmt.operator !== null && !this.inScope(stmt.target.identifier)) {
          this.errors.push(new ZedUndefinedError(stmt.target));
          success = false;
        }
        // if the operand is a variable, it must exist
        if (stmt.operand instanceof ZedVariable && !this.inScope(stmt.operand.identifier)) {
          this.errors.push(new ZedUndefinedError(stmt.operand));
          success = false;
        }
        // if operand is Input, check variables referenced in its parameters
        else if (stmt.operand instanceof ZedInput) {
          this.checkParams(stmt.operand.promptParams);
        }
        // if we have successfully passed the other checks,
        // add the variable to the current block scope
        if (success && !this.inScope(stmt.target.identifier))
          scope.push(stmt.target.identifier);
      }
      // test for variables used in an OUT[] statement
      else if (stmt instanceof ZedOutput) {
        this.checkParams(stmt.promptParams);
      }
      else if (stmt instanceof ZedBinarySelection) {
        // walk all the conditions
        for (let [condition, doBlock] of stmt.conditions) {
          // check the condition if it exists
          if (condition !== null)
            this.checkCondition(condition);
          // check all the blocks associated with the binary selection
          this.checkTypes({code: doBlock});
        }
      }
      else if (stmt instanceof ZedMultiwaySelection) {
        // if the SWITCH variable is not in scope, note that error
        if (!this.inScope(stmt.variable.identifier))
          this.errors.push(new ZedUndefinedError(stmt.variable));
        // 
        //else
        //  scope.push(stmt.variable.identifier);
        for (let whenBlock of stmt.whenValueThenCode) {
          // recursively check each WHEN block inside
          this.checkTypes({code: whenBlock[1]});
        }
      }
      // a few structures share a code property,
      // check them here
      else if ('code' in stmt) {
        // if we have a forloop, the variable is now a part of the scope
        if (stmt instanceof ZedForLoop)
          scope.push(stmt.variable.identifier);
        // check variables referenced in a WHEN loop
        if (stmt instanceof ZedPreTestLoop)
          this.checkCondition(stmt.condition);
        // check variables referenced in a REPEAT loop
        if (stmt instanceof ZedPostTestLoop)
          this.checkCondition(stmt.condition);
        // recursively check the code block that forms part of the structure
        this.checkTypes(stmt);
      }
    }
    // Go up a block; exit the current block scope
    this.currentScope.pop();
  }
}
// HAIKU
/*
 * They do start unknown,
 * Undefined variables,
 * and find them, we must.
*/

