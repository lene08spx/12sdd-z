/* Work done 12th April 2020 */

import { Token, Assign, Output, Program, Variable, Input } from "./language.ts";

const aprogram = '<keyword>"PROG";$name$<generic>;$code${%instruction%};<keyword>"ENDPROG"';
const ainstruction = '(%statement%;%control%)';
const astatement = '%assign%;%output%;<special>":"';
const aassign = '<special>"=";<variable>;(variable;string;number;input);[<math>]';

function isDesired(t: Token, type: Token["type"], value?: string): boolean {
  if (value !== undefined) return (t.type === type && value === t.value);
  else return (t.type === type);
}

function checkProgram(tokList: Token[]): Program {
  if (!isDesired(tokList[0], "keyword", "PROG")) throw new Error("SYNTAX");
  tokList.shift();
  if (!isDesired(tokList[0], "generic")) throw new Error("SYNTAX");
  const programName = tokList.shift()?.value!;
  let code = [];
  let instruction = null;
  while (instruction = checkInstruction(tokList)) {
    code.push(instruction);
  }
  return {
    type: "program",
    name: programName,
    code
  };
}

function checkInstruction(t: Token[]){
  if (isDesired(t[0], "special", "=")) {
    t.shift();
    const result = checkAssign(t);
    if (!isDesired(t[0], "special", ":")) throw new Error("SYNTAX");
    t.shift();
    return result;
  }
  else if (isDesired(t[0], "keyword", "OUT")) {
    t.shift();
    const result = checkOutput(t);
    if (!isDesired(t[0], "special", ":")) throw new Error("SYNTAX");
    t.shift();
    return result;
  }
  else if (isDesired(t[0], "keyword", "ENDPROG")) {
    return null;
  }
  else {
    //throw new Error("SYNTAX:: "+Deno.inspect(t[0]));
  }
}

function checkAssign(t: Token[]): Assign {
  if (!isDesired(t[0], "variable")) throw new Error("SYNTAX");
  const varName = t.shift()?.value!;
  let value: any;
  if (!isDesired(t[0], "variable") && !isDesired(t[0], "string") && !isDesired(t[0], "number") && !isDesired(t[0], "keyword", "IN")) throw new Error("SYNTAX");
  else if (isDesired(t[0], "keyword", "IN")) {
    t.shift();
    value = checkInput(t);
  }
  else {
    value = t.shift()?.value;
  }
  return {
    type: "assign",
    variable: varName as Variable,
    value
  };
}

function checkOutput(t: Token[]): Output {
  return {
    type: "output"
  };
}

function checkInput(t: Token[]): Input {
  if (!isDesired(t[0],"special","[")) throw new Error("SYNTAX");
  t.shift();
  let prompt: any[] = [];
  while (true) {
    if (!isDesired(t[0], "variable") && !isDesired(t[0], "number") && !isDesired(t[0], "string") && !isDesired(t[0], "math", "+")) throw new Error("SYNTAX");
    else if (!isDesired(t[0], "math", "+")){
      prompt.push(t[0]);
      t.shift();
    } else t.shift();
    if (isDesired(t[0],"special","]")) {t.shift(); break;};
  }
  return {
    type: "input",
    prompt
  };
}

export function syntaxify(t: Token[]) {
  return checkProgram(t);
}

/*

KEEP FOR LOG-BOOK 11th April 2020

Macro-Esque

\program{name}{
  \assign{B1}{\input{text}}
  \assign{E1}{\input{text}}
  \assign{C1}{B1}
  \while{\condition{!==}{C1}{E1}}{
    \output{C1}
    \add{C1}{1}
  }
}

*/

