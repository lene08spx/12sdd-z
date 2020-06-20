// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

const allNewline = /(\r\n|[\n\v\f\r\x85\u2028\u2029])/g;
const zedTokenRules = {
  "keyword": /(?<keyword>\b(?:PROG|ENDPROG|DO|ENDDO|OUT|IN|IF|OTHERWISE|ENDIF|SWITCH|ENDSWITCH|FOR|FROM|TO|BY|ENDFOR|WHEN|ENDWHEN|REPEAT|UNTIL|ENDREPEAT)\b)/,
  "operator": /(?<operator>\+|-|\*|\/|>=|<=|>|<|==|&&|\|\||!|:|\[|\]|=)/,
  "string": /(?<string>"[ !#-~]*")/,
  "number": /(?<number>\b\d+(?:\.\d+)?\b)/,
  "variable": /(?<variable>\b[A-Z]\d+\b)/,
  "identifier": /(?<identifier>\b[A-Za-z_]+\b)/,
  "comment": /(?<comment>#.*)/,
  "other": /(?<other>[^\s]+)/,
} as const;
const zedToken = new RegExp(Object.values(zedTokenRules).map(v=>v.source).join("|"), "g");

export type TokenType = keyof typeof zedTokenRules;
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  position: number;
}

function tokenFromMatch(m: RegExpMatchArray): Token {
  // retrieve the entry in m.groups which is not undefined, this is the right token type and holds the desired value
  const [ tokType, tokValue ] = Object.entries(m.groups??{}).filter(v=>v[1]!==undefined)[0];
  return {
    type: tokType as TokenType,
    value: tokValue,
    line: 0,
    position: m.index ?? 0
  };
}

/** Perform lexical analysis on source code, returning a list of tokens. */
export function lex(source: string): Token[] {
  const lines = source.split(/\r?\n/);
  const tokenList: Token[] = [];
  for (let i = 0; i < lines.length; i++) {
    const tokenMatches = lines[i].matchAll(zedToken);
    for (let match of tokenMatches) {
      const token = tokenFromMatch(match);
      if (token.type === "comment") continue;
      token.line = i+1;
      tokenList.push(token);
    }
  }
  return tokenList;
}
