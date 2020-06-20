// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

import { assertEquals, assertThrows } from "../lib/deno_std/testing/asserts.ts";
import { lex, Token } from "./compiler/lex.ts";
import {
  ZedVariable,
  ZedString,
  ZedNumber,
  ZedInOutParams,
  ZedInput,
  ZedAssignment,
  ZedOutput,
  ZedCondition,
  ZedDoBlock,
  ZedPreTestLoop,
  ZedPostTestLoop,
  ZedForLoop,
  ZedBinarySelection,
  ZedMultiwaySelection,
  TokenArray,
  ParserError,
  syntaxTests,
} from "./compiler/parse.ts";

Deno.test("lex", ()=>{
  assertEquals(lex(`PROG HI\nENDPROG`), [
    { type: "keyword", value: "PROG", line: 0, position: 0 },
    { type: "identifier", value: "HI", line: 0, position: 5 },
    { type: "keyword", value: "ENDPROG", line: 1, position: 0 },
  ])
});

Deno.test("ZedInOutParams->empty", ()=>{
  const tokens = new TokenArray(lex(`[]`),true);
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    {items:[]}
  );
});

Deno.test("ZedInOutParams->variable", ()=>{
  const tokens = new TokenArray(lex(`[Z80]`),true);
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    {items:[new ZedVariable("Z80")]}
  );
});

Deno.test("ZedInOutParams->string", ()=>{
  const tokens = new TokenArray(lex(`["Hello"]`),true);
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    {items:[new ZedString(`"Hello"`)]}
  );
});

Deno.test("ZedInOutParams->number", ()=>{
  const tokens = new TokenArray(lex(`[42]`),true);
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    {items:[new ZedNumber(42)]}
  );
});

Deno.test("ZedInOutParams->multiple", ()=>{
  const tokens = new TokenArray(lex(`[Z80+"Hello"+42]`),true);
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    {items:[
      new ZedVariable("Z80"),
      new ZedString(`"Hello"`),
      new ZedNumber(42)
    ]}
  );
});

Deno.test("ZedInOutParams->invalid", ()=>{
  const tokens = new TokenArray(lex(`[Z80,42]`),true);
  assertThrows(()=>{
    new ZedInOutParams(tokens)
  });
});

Deno.test("ZedInput->valid", ()=>{
  const tokens = new TokenArray(lex(`IN[]`),true);
  const result = new ZedInput(tokens);
  assertEquals(
    result.promptParams,
    {items: []} as ZedInOutParams
  );
});

Deno.test("ZedInput->invalid", ()=>{
  const tokens = new TokenArray(lex(`INPUT[]`),true);
  assertThrows(()=>{
    new ZedInput(tokens);
  });
});

Deno.test("ZedAssignment->variable", ()=>{
  const tokens = new TokenArray(lex(`= A1 Z80`),true);
  const result = new ZedAssignment(tokens);
  assertEquals(
    result,
    {
      target: new ZedVariable("A1"),
      operand: new ZedVariable("Z80"),
      operator: null,
      startTokenIndex: 0,
      endTokenIndex: 2,
    } as ZedAssignment
  );
});

Deno.test("ZedAssignment->string", ()=>{
  const tokens = new TokenArray(lex(`= A1 "Hello"`),true);
  const result = new ZedAssignment(tokens);
  assertEquals(
    result,
    {
      target: new ZedVariable("A1"),
      operand: new ZedString(`"Hello"`),
      operator: null,
      startTokenIndex: 0,
      endTokenIndex: 2,
    } as ZedAssignment
  );
});

Deno.test("ZedAssignment->number", ()=>{
  const tokens = new TokenArray(lex(`= A1 42`),true);
  const result = new ZedAssignment(tokens);
  assertEquals(
    result,
    {
      target: new ZedVariable("A1"),
      operand: new ZedNumber(42),
      operator: null,
      startTokenIndex: 0,
      endTokenIndex: 2,
    } as ZedAssignment
  );
});

Deno.test("ZedAssignment->operator", ()=>{
  const tokens = new TokenArray(lex(`= A1 42 +`),true);
  const result = new ZedAssignment(tokens);
  assertEquals(
    result,
    {
      target: new ZedVariable("A1"),
      operand: new ZedNumber(42),
      operator: "+",
      startTokenIndex: 0,
      endTokenIndex: 3,
    } as ZedAssignment
  );
});

Deno.test("ZedAssignment->input", ()=>{
  const tokens = new TokenArray(lex(`= A1 IN[]`),true);
  const result = new ZedAssignment(tokens);
  assertEquals(
    result,
    {
      target: new ZedVariable("A1"),
      operand: { promptParams: {items:[]} } as ZedInput,
      operator: null,
      startTokenIndex: 0,
      endTokenIndex: 4,
    } as ZedAssignment
  );
});

// treated as the next token; in other words, ignored.
Deno.test("ZedAssignment->invalidOperator", ()=>{
  const tokens = new TokenArray(lex(`= A1 Z80 %`),true);
  new ZedAssignment(tokens);
});

Deno.test("ZedOutput->multiple", ()=>{
  const tokens = new TokenArray(lex(`OUT[Z80+"Hello"+42]`),true);
  const result = new ZedOutput(tokens);
  assertEquals(
    result.promptParams,
    {items:[
      new ZedVariable("Z80"),
      new ZedString(`"Hello"`),
      new ZedNumber(42)
    ]} as ZedInOutParams
  );
});

Deno.test("ZedCondition->equality", ()=>{
  const tokens = new TokenArray(lex(`== 11 22`),true);
  const result = new ZedCondition(tokens);
  assertEquals(
    result,
    {
      operator: "==",
      left: new ZedNumber(11),
      right: new ZedNumber(22),
      invert: false,
    } as ZedCondition
  );
});

Deno.test("ZedCondition->invertEquality", ()=>{
  const tokens = new TokenArray(lex(`!== 11 22`),true);
  const result = new ZedCondition(tokens);
  assertEquals(
    result,
    {
      operator: "==",
      left: new ZedNumber(11),
      right: new ZedNumber(22),
      invert: true,
    } as ZedCondition
  );
});

Deno.test("ZedCondition->logical", ()=>{
  const tokens = new TokenArray(lex(`&& ! <= 11 11 >= 22 22`),true);
  const result = new ZedCondition(tokens);
  assertEquals(
    result,
    {
      operator: "&&",
      left: {
        operator: "<=",
        left: new ZedNumber(11),
        right: new ZedNumber(11),
        invert: true
      } as ZedCondition,
      right: {
        operator: ">=",
        left: new ZedNumber(22),
        right: new ZedNumber(22),
        invert: false
      } as ZedCondition,
      invert: false,
    } as ZedCondition
  );
});

Deno.test("ZedDoBlock->empty", ()=>{
  const tokens = new TokenArray(lex(
    `DO ENDDO`
  ),true);
  const result = new ZedDoBlock(tokens);
  assertEquals(
    result,
    {
      errors: [],
      statements: [],
    } as ZedDoBlock
  );
});

Deno.test("ZedDoBlock->assign", ()=>{
  const tokens = new TokenArray(lex(
    `DO = A1 2: ENDDO`
  ),true);
  const result = new ZedDoBlock(tokens);
  assertEquals(
    result,
    {
      errors: [],
      statements: [
        {
          target: new ZedVariable("A1"),
          operand: new ZedNumber(Number("2")),
          operator: null,
          startTokenIndex: 1,
          endTokenIndex: 3,
        } as ZedAssignment
      ],
    } as ZedDoBlock
  );
});

Deno.test("ZedDoBlock->assignForgotEndOfStatement", ()=>{
  const tokens = new TokenArray(lex(
    `DO = A1 2 = B1 3 +: ENDDO`
  ),true);
  const result = new ZedDoBlock(tokens);
  assertEquals(
    result,
    {
      errors: [
        new ParserError(syntaxTests.endOfStatement, {
          type: "operator",
          value: "=",
          line: 0,
          position: 10
        } as Token)
      ],
      statements: [
        {
          target: new ZedVariable("A1"),
          operand: new ZedNumber(Number("2")),
          operator: null,
          startTokenIndex: 1,
          endTokenIndex: 3,
        } as ZedAssignment,
        {
          target: new ZedVariable("B1"),
          operand: new ZedNumber(Number("3")),
          operator: "+",
          startTokenIndex: 4,
          endTokenIndex: 7,
        } as ZedAssignment
      ],
    } as ZedDoBlock
  );
});

Deno.test("ZedPreTestLoop->valid", ()=>{
  const tokens = new TokenArray(lex(
    `WHEN == A1 Z1 DO ENDDO ENDWHEN`
  ),true);
  const result = new ZedPreTestLoop(tokens);
  assertEquals(
    result,
    {
      condition: {
        invert: false,
        left: new ZedVariable("A1"),
        right: new ZedVariable("Z1"),
        operator: "==",
      } as ZedCondition,
      code: {
        statements: [],
        errors: []
      } as ZedDoBlock
    } as ZedPreTestLoop
  );
});

Deno.test("ZedPreTestLoop->invalid", ()=>{
  const tokens = new TokenArray(lex(
    `WHEN DO ENDDO ENDWHEN`
  ),true);
  assertThrows(()=>{
    new ZedPreTestLoop(tokens);
  });
});

Deno.test("ZedPostTestLoop->valid", ()=>{
  const tokens = new TokenArray(lex(
    `REPEAT DO ENDDO UNTIL == A1 Z1 ENDREPEAT`
  ),true);
  const result = new ZedPostTestLoop(tokens);
  assertEquals(
    result,
    {
      condition: {
        invert: false,
        left: new ZedVariable("A1"),
        right: new ZedVariable("Z1"),
        operator: "==",
      } as ZedCondition,
      code: {
        statements: [],
        errors: []
      } as ZedDoBlock
    } as ZedPostTestLoop
  );
});

Deno.test("ZedPostTestLoop->invalid", ()=>{
  const tokens = new TokenArray(lex(
    `REPEAT DO ENDDO == A1 Z1 ENDREPEAT`
  ),true);
  assertThrows(()=>{
    new ZedPostTestLoop(tokens);
  });
});

Deno.test("ZedForLoop->valid", ()=>{
  const tokens = new TokenArray(lex(
    `FOR I1 FROM 1 TO 10 BY 1 DO ENDDO ENDFOR`
  ),true);
  const result = new ZedForLoop(tokens);
  assertEquals(
    result,
    {
      variable: new ZedVariable("I1"),
      from: new ZedNumber(1),
      to: new ZedNumber(10),
      by: new ZedNumber(1),
      code: {
        statements: [],
        errors: [],
      } as ZedDoBlock,
    } as ZedForLoop
  );
});

Deno.test("ZedForLoop->invalid", ()=>{
  const tokens = new TokenArray(lex(
    `FOR FROM 1 TO 10 BY 1 DO ENDDO ENDFOR`
  ),true);
  assertThrows(()=>{
    new ZedForLoop(tokens);
  });
});

Deno.test("ZedBinarySelection->if", ()=>{
  const tokens = new TokenArray(lex(
    `IF == A1 Z1 DO ENDDO ENDIF`
  ),true);
  const result = new ZedBinarySelection(tokens);
  assertEquals(
    result,
    {
      conditions: [
        [
          {
            invert: false,
            left: new ZedVariable("A1"),
            right: new ZedVariable("Z1"),
            operator: "==",
          } as ZedCondition,
          {
            statements: [],
            errors: [],
          } as ZedDoBlock
        ]
      ]
    } as ZedBinarySelection
  );
});

Deno.test("ZedBinarySelection->if_else", ()=>{
  const tokens = new TokenArray(lex(
    `IF == A1 Z1 DO ENDDO OTHERWISE DO ENDDO ENDIF`
  ),true);
  const result = new ZedBinarySelection(tokens);
  assertEquals(
    result,
    {
      conditions: [
        [
          {
            invert: false,
            left: new ZedVariable("A1"),
            right: new ZedVariable("Z1"),
            operator: "==",
          } as ZedCondition,
          {
            statements: [],
            errors: [],
          } as ZedDoBlock
        ],
        [
          null,
          {
            statements: [],
            errors: [],
          } as ZedDoBlock
        ]
      ]
    } as ZedBinarySelection
  );
});

Deno.test("ZedBinarySelection->if_elseif_else", ()=>{
  const tokens = new TokenArray(lex(
    `IF == A1 Z1 DO ENDDO OTHERWISE IF == B1 Y1 DO ENDDO OTHERWISE DO ENDDO ENDIF`
  ),true);
  const result = new ZedBinarySelection(tokens);
  assertEquals(
    result,
    {
      conditions: [
        [
          {
            invert: false,
            left: new ZedVariable("A1"),
            right: new ZedVariable("Z1"),
            operator: "==",
          } as ZedCondition,
          {
            statements: [],
            errors: [],
          } as ZedDoBlock
        ],
        [
          {
            invert: false,
            left: new ZedVariable("B1"),
            right: new ZedVariable("Y1"),
            operator: "==",
          } as ZedCondition,
          {
            statements: [],
            errors: [],
          } as ZedDoBlock
        ],
        [
          null,
          {
            statements: [],
            errors: [],
          } as ZedDoBlock
        ]
      ]
    } as ZedBinarySelection
  );
});

Deno.test("ZedMultiwaySelection->empty", ()=>{
  const tokens = new TokenArray(lex(
    `SWITCH A1 ENDSWITCH`
  ),true);
  const result = new ZedMultiwaySelection(tokens);
  assertEquals(
    result,
    {
      variable: new ZedVariable("A1"),
      whenValueThenCode: []
    } as ZedMultiwaySelection
  )
});

Deno.test("ZedMultiwaySelection->single", ()=>{
  const tokens = new TokenArray(lex(
    `SWITCH A1 WHEN 2 DO ENDDO ENDSWITCH`
  ),true);
  const result = new ZedMultiwaySelection(tokens);
  assertEquals(
    result,
    {
      variable: new ZedVariable("A1"),
      whenValueThenCode: [
        [
          new ZedNumber(2),
          {
            statements: [],
            errors: []
          }
        ]
      ]
    } as ZedMultiwaySelection
  )
});
