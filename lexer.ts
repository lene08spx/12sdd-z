/* Work done on 11th April 2020 */

import { decode } from "https://deno.land/std@v0.40.0/encoding/utf8.ts";
import { BufReader } from "https://deno.land/std@v0.40.0/io/mod.ts";

import { Token, tokenRules } from "./language.ts";

/* 12th April, moved token rules to a shared language dependencies file. */

const zedRegexItems: string[] = [];
for (let [k, v] of Object.entries(tokenRules)) zedRegexItems.push(`(?<${k}>${v})`);
const tokenRegex = new RegExp(`(${zedRegexItems.join("|")})`,"g");

/** Get the Token-Type by the available RegEx groups. */
function getToken(groups: Record<string,string>): Token {
  for (let [k,v] of Object.entries(groups)) {
    // The only available group is not undefined.
    if (v !== undefined) return {type: k, value: v} as Token;
  }
  // All items should be captured in groups, otherwise throw error.
  throw new Error("Ungrouped Token");
}

/** Analyse a file, and outpput a list of tokens. */
export async function lexify(r: Deno.Reader): Promise<Token[]> {
  const bufReader = new BufReader(r);
  const tokenList: Token[] = [];
  let lineResult = await bufReader.readLine();
  while (lineResult !== Deno.EOF) {
    /* perform regex test */
    const testResult = decode(lineResult.line).matchAll(tokenRegex);
    for (const match of testResult) {
      tokenList.push(getToken(match.groups!));
    }
    /* prep new line */
    lineResult = await bufReader.readLine();
  }
  return tokenList;
}
