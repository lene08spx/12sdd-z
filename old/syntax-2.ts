//const program = '<keyword>"PROG";$name$<generic>;$hi${"A"};<keyword>"ENDPROG"';
/*
conditon: once, many, maybe, either
*/
interface SyntaxRule {
  token: string;
  value?: string | SyntaxRule[];
  condition?: string;
  property?: string;
}
interface Token {
  token: string;
  value: string;
}
const programSyntax: SyntaxRule[] = [
  {
    token: "tt",
    value: "PROG",
    condition: "once"
  },
  {
    property: "name",
    token: "tt",
    condition: "once"
  },
  {
    token: "tt",
    condition: "once",
    value: [{token:"tt",value:"A"},{token:"tt",value:"A"}]
  },
  {
    token: "tt",
    value: "ENDPROG",
    condition: "once"
  },
];
const list = [
  {
    token: "tt",
    value: "PROG"
  },
  {
    token: "tt",
    value: "HELLO"
  },
  {
    token: "tt",
    value: "A"
  },
  {
    token: "tt",
    value: "A"
  },
  {
    token: "tt",
    value: "ENDPROG"
  }
];
/** WHEN writing this, debugging the condition. Was originally missing and so undefined was added to make it a default. */
function syntaxCheck(rules: SyntaxRule[], data: Token[]): any {
  const output: any = {};
  for (let i=0; i<rules.length; i++) {
    console.log("###",rules[i],data[0])
    if (rules[i].condition === "once" || rules[i].condition === undefined) {
      if (rules[i].value !== undefined) {
        if (typeof rules[i].value === "string") {
          if (rules[i].token !== data[0].token || rules[i].value !== data[0].value) throw "SYNTAX";
          if (rules[i].property !== undefined) {
            output[rules[i].property!] = data[0].value;
          }
          data.shift();
        }
        else {
          if (rules[i].property !== undefined) {
            output[rules[i].property!] = syntaxCheck(rules[i].value as SyntaxRule[], data);
          } else {
            syntaxCheck(rules[i].value as SyntaxRule[], data);
          }
        }
      }
      else {
        if (rules[i].token !== data[0].token) throw "SYNTAX";
        if (rules[i].property !== undefined) {
          output[rules[i].property!] = data[0].value;
        }
        data.shift();
      }
    }
  }
  return output;
}

console.log(syntaxCheck(programSyntax, list));