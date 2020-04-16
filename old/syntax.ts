//const program = '<keyword>"PROG";$name$<generic>;$hi${"A"};<keyword>"ENDPROG"';
/*
conditon: once, many, maybe, either
*/

type SyntaxCondition = "once" | "many" | "maybe" | "either";
interface TerminalSyntaxRule {
  token: string;
  value?: string;
  property?: string;
}
interface NonTerminalSyntaxRule {
  condition: SyntaxCondition;
  rules: SyntaxRule[];
  property?: string;
}
type SyntaxRule = TerminalSyntaxRule | NonTerminalSyntaxRule;
interface Token {
  token: string;
  value: string;
  line: number;
}

function isTerminalSyntaxRule(r: SyntaxRule): r is TerminalSyntaxRule {
  return 'token' in r;
}
function testTerminalRule(r: TerminalSyntaxRule, t: Token): boolean {
  if (r.value !== undefined && r.value === t.value) return true;
  else if (r.value !== undefined) return false;
  if (r.token === t.token) return true;
  return false;
}
/** WHEN writing this, debugging the condition. Was originally missing and so undefined was added to make it a default. */
/** Troubleshooting recursion, stepping through manually. FIX-- Solution was to copy data outside trying to recurse/*/
function syntaxCheck(rules: SyntaxRule[], data: Token[]): any {
  const output: any = {};
  for (let r of rules) {
    if (isTerminalSyntaxRule(r)) {
      const token = data.shift() as Token;
      if (!testTerminalRule(r, token)) throw "SYNTAX ERROR on line "+String(token.line)+", unexpected '"+token.value+"'";
      if (r.property !== undefined) output[r.property] = token.value;
    } else {
      if (r.condition === "once") {
        const result = syntaxCheck(r.rules, data);
        if (Object.keys(result).length > 0 && r.property !== undefined) output[r.property] = result;
      }
      else if (r.condition === "many") {
        const manyOut = [];
        while (true) {
          const dataCopy = data.slice(0, r.rules.length);
          try {
            const result = syntaxCheck(r.rules, data);
            manyOut.push(result);
          } catch (e) {
            data.unshift(...dataCopy);
            break;
          }
        }
        if (r.property !== undefined) output[r.property] = manyOut;
      }
    }
  }
  return output;
}

const synTest: SyntaxRule[] = [
  {
    token: "keyword",
    value: "PROG"
  },
  {
    token: "generic",
    property: "name"
  },
  {
    condition: "many",
    property: "code",
    rules: [
      {
        token: "special",
        value: "="
      },
      {
        token: "variable",
        property: "varName"
      },
      {
        token: "variable",
        property: "varValue"
      },
      {
        token: "special",
        value: ":"
      }
    ]
  },
  {
    token: "keyword",
    value: "ENDPROG"
  }
];
const tokList: Token[] = [
  {
    token: "keyword",
    value: "PROG",
    line: 1
  },
  {
    token: "generic",
    value: "COUNTER",
    line: 1
  },
  {
    token: "special",
    value: "=",
    line: 2
  },
  {
    token: "variable",
    value: "A1",
    line: 2
  },
  {
    token: "variable",
    value: "B1",
    line: 2
  },
  {
    token: "keyword",
    value: "ENDPROG",
    line: 3
  }
]

console.log(syntaxCheck(synTest, tokList));