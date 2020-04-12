export const tokenRules = {
  "keyword": "(PROG|ENDPROG|SWITCH|WHEN|DO|ENDDO|ENDSWITCH|IF|OTHERWISE|ENDIF|FOR|FROM|TO|BY|ENDFOR|UNTIL|ENDWHEN|OUT|IN)\\b",
  "number": "([0-9]+)(\\.[0-9]+)?",
  "math": "\\+|\\-|\\*|\\/",
  "compare": "<|>|<=|>=|==|&&|\\|\\||!|(AND|NOT|OR)\\b",
  "special": ":|\\[|\\]|=",
  "string": "\"([A-Z]|[0-9])*\"",
  "variable": "([A-Z]([0-9])*)\\b",
  "generic": "([A-Z]+)\\b",
  "invalid": "[^\\s]+"
};

/** A lexical token. */
export interface Token {
  type: keyof typeof tokenRules | "none";
  value: string;
  line: number;
}

/* Note 12th April:: Extend Requirements to allow for : end of statement after control-structure for flexibility. */

export type Value = string | number;
export type Variable = string & { isVariable: true };

export interface Program {
  type: "program";
  name: string;
  code: Instruction[];
}
/* Mistake in taking needs. Condition ALWAYS has two terms.*/
export interface Condition {
  type: "condition";
  operator: string;
  left: Condition | Value | Variable;
  right: Condition | Value | Variable;
}
export interface Input {
  type: "input";
  prompt: (Variable|Value)[];
}
export interface PreTest {
  type: "preTest";
  condition: Condition;
  code: Instruction[];
}
export interface PostTest {
  type: "postTest";
  condition: Condition;
  code: Instruction[];
}
export interface CountLoop {
  type: "countLoop";
  variable: Variable;
  from: number;
  to: number;
  by: number;
  code: Instruction[];
}
/* Note in Evaluation, a mistake in taking down client needs. Otherwise is only optional, not zero-to-many. */
export interface Select {
  type: "select";
  condition: Condition;
  trueCode: Instruction[];
  falseCode?: Instruction[];
}
/* For Evaluation: Mistake in client needs taking, switch should allow multiple WHEN statements. */
export interface Switch {
  type: "switch";
  variable: Variable;
  whenValueThenCode: [Value, Instruction[]];
}
export interface Assign {
  type: "assign";
  variable: Variable;
  value: Variable | Value | Input;
  operator?: string;
}
export interface Output {
  type: "output";
}

export type Instruction = PreTest | PostTest | CountLoop | Select | Switch | Assign | Output;
export type Structure = Instruction | Program | Condition | Input ;
