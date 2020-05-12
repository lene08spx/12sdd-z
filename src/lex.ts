import { BufReader, decode } from "./deps.ts";

/// END REPEAT

const TOKEN_RULES = {
  "keyword": "\\b(PROG|ENDPROG|SWITCH|WHEN|DO|ENDDO|ENDSWITCH|IF|OTHERWISE|ENDIF|FOR|FROM|TO|BY|ENDFOR|UNTIL|ENDWHEN|ENDREPEAT|OUT|IN)\\b",
  "number": "\\b([0-9]+)(\\.[0-9]+)?\\b",
  "math": "\\+|\\-|\\*|\\/",
  "compare": "<=|>=|<|>|==|&&|\\|\\||!|\\b(AND|NOT|OR)\\b",
  "special": ":|\\[|\\]|=",
  "string": "\"([\x20\x21\x23-\x7E])*\"",
  "variable": "\\b([A-Z]([0-9])*)\\b",
  "generic": "\\b([A-Z]+)\\b",
  "invalid": "[^\\s]+"
};
const zedRegexRules: string[] = [];
for (let [k, v] of Object.entries(TOKEN_RULES)) zedRegexRules.push(`(?<${k}>${v})`);
const zedTokenRegex = new RegExp(`(${zedRegexRules.join("|")})`,"g");

export interface Token {
  type: keyof typeof TOKEN_RULES;
  value: string;
  line: number;
}

function getToken(regexGroups: Record<string,string>): Token {
  for (let [k,v] of Object.entries(regexGroups)) {
    // The only available group is not undefined.
    if (v !== undefined) return {type: k, value: v, line: 0} as Token;
  }
  // All items should be captured in groups, otherwise throw error.
  throw new Error("Ungrouped Token");
}

export async function lex(r: Deno.Reader): Promise<Token[]> {
  const buf = new BufReader(r);
  const tokenList: Token[] = [];
  let currLine = 0;
  let lineResult;
  lineResult = await buf.readLine();
  while (lineResult !== null) {
    currLine++;
    const testResult = decode(lineResult.line).matchAll(zedTokenRegex);
    for (const match of testResult) {
      const token = getToken(match.groups??{});
      token.line = currLine;
      tokenList.push(token);
    }
    lineResult = await buf.readLine();
  }
  return tokenList;
}
