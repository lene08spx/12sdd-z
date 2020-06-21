// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0
/*
Lexical Analysis

The job here is not so much about analysis, but more about organisation.
The lexer/tokeniser is designed to provide meaning to each lexeme,
but is not its job to infer context.

Simply, the Lexical Analyser takes some input source code,
and gives back a list of meaningful words, with added metadata
such as the line number and character position.
*/

/** An object mapping a RegExp pattern to a TokenType. */
const zedTokenRules = {
  "keyword": /(?<keyword>\b(?:PROG|ENDPROG|DO|ENDDO|OUT|IN|IF|OTHERWISE|ENDIF|SWITCH|ENDSWITCH|FOR|FROM|TO|BY|ENDFOR|WHEN|ENDWHEN|REPEAT|UNTIL|ENDREPEAT)\b)/,
  "number": /(?<number>-?\b\d+(?:\.\d+)?\b)/,
  "operator": /(?<operator>\+|-|\*|\/|>=|<=|>|<|==|&&|\|\||!|:|\[|\]|=|%)/,
  "string": /(?<string>"[ !#-~]*")/,
  "variable": /(?<variable>\b[A-Z]\d+\b)/,
  "identifier": /(?<identifier>\b[A-Za-z_]+\b)/,
  "comment": /(?<comment>#.*)/,
  "other": /(?<other>[^\s]+)/,
} as const;

/** The RegExp instance used to match all tokens relevant to Zed. */
const zedTokenPattern = new RegExp(Object.values(zedTokenRules).map(v=>v.source).join("|"), "g");

/** Simply the indexes of zedTokenRules; all available types of tokens encountered in parsing. */
export type TokenType = keyof typeof zedTokenRules;

/** A Lexeme; a meaningful structural piece in the puzzle of a program. */
export interface Token {
  /** The classification. */
  type: TokenType;
  /** The raw content of the token. */
  value: string;
  /** The line (counting from one) in which the token appears in the source code. */
  line: number;
  /** The horizontal position of the token (counting from zero) on the line in source code. */
  position: number;
}

/** Generate a Token given the RegExp match list from zedTokenPattern, and the lineNumber. */
function tokenFromMatch(matchedTokens: RegExpMatchArray, lineNumber: number): Token {
  // retrieve the entry in m.groups which is not undefined, this is the right token type and holds the desired value
  const [ tokType, tokValue ] = Object.entries(matchedTokens.groups??{}).filter(v=>v[1]!==undefined)[0];
  return <Token>{
    type: tokType as TokenType,
    value: tokValue,
    line: lineNumber,
    position: matchedTokens.index ?? 0
  };
}

/** Given the source code as a string,
 *  perform lexical analysis
 *  and return a list of tokens. */
export function lex(source: string): Token[] {
  const tokenList: Token[] = [];
  // split the source code into lines, using either Linux (LF) or Windows (CRLF) delimiters.
  const lines = source.split(/\r?\n/);
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    // match all tokens on the current line
    const tokenMatches = lines[lineNo].matchAll(zedTokenPattern);
    // convert each of those RegExp matches into Tokens
    for (let match of tokenMatches) {
      const token = tokenFromMatch(match, lineNo+1);
      // if the token is a comment, ignore it so it is not parsed
      if (token.type === "comment")
        continue;
      // otherwise push it into the output array.
      else
        tokenList.push(token);
    }
  }
  return <Token[]>tokenList;
}
// Or in a Haiku...
/* 
 * Lex takes string source code,
 * Analyses Lexical,
 * Gifts us our Tokens.
*/
