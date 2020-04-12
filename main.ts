/* Work done 12th April 2020 */

import { lexify } from "./lexer.ts";
import { syntaxify } from "./syntax.ts";

const filename = "test.z";

const source = await Deno.open(filename);
console.log(filename);
const tokens = await lexify(source);
//console.log(tokens);
const ast = syntaxify(tokens);
console.log(ast);
