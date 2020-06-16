import { assertEquals, assertThrows } from "../lib/deno_std/testing/asserts.ts";
import { lex } from "./lex.ts";
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
} from "./parse.ts";

Deno.test("lex", ()=>{
  assertEquals(lex(`PROG HI\nENDPROG`), [
    { type: "keyword", value: "PROG", line: 0, position: 0 },
    { type: "other", value: "HI", line: 0, position: 5 },
    { type: "keyword", value: "ENDPROG", line: 1, position: 0 },
  ])
});

Deno.test("ZedInOutParams->empty", ()=>{
  const tokens = new TokenArray(lex(`[]`));
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    []
  );
});

Deno.test("ZedInOutParams->variable", ()=>{
  const tokens = new TokenArray(lex(`[Z80]`));
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    [new ZedVariable("Z80")]
  );
});

Deno.test("ZedInOutParams->string", ()=>{
  const tokens = new TokenArray(lex(`["Hello"]`));
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    [new ZedString(`"Hello"`)]
  );
});

Deno.test("ZedInOutParams->number", ()=>{
  const tokens = new TokenArray(lex(`[42]`));
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    [new ZedNumber(42)]
  );
});

Deno.test("ZedInOutParams->multiple", ()=>{
  const tokens = new TokenArray(lex(`[Z80+"Hello"+42]`));
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    [
      new ZedVariable("Z80"),
      new ZedString(`"Hello"`),
      new ZedNumber(42)
    ]
  );
});

Deno.test("ZedInOutParams->invalid", ()=>{
  const tokens = new TokenArray(lex(`[Z80,42]`));
  assertThrows(()=>{
    new ZedInOutParams(tokens)
  });
});

Deno.test("ZedInput->valid", ()=>{
  const tokens = new TokenArray(lex(`IN[]`));
  const result = new ZedInput(tokens);
  assertEquals(
    result.promptParams,
    []
  );
});

Deno.test("ZedInput->invalid", ()=>{
  const tokens = new TokenArray(lex(`INPUT[]`));
  assertThrows(()=>{
    new ZedInput(tokens);
  });
});

Deno.test("ZedAssignment->variable", ()=>{
  const tokens = new TokenArray(lex(`= A1 Z80`));
  const result = new ZedAssignment(tokens);
  assertEquals(
    result,
    {
      target: new ZedVariable("A1"),
      operand: new ZedVariable("Z80"),
      operator: null,
    } as ZedAssignment
  );
});

Deno.test("ZedAssignment->string", ()=>{
  const tokens = new TokenArray(lex(`= A1 "Hello"`));
  const result = new ZedAssignment(tokens);
  assertEquals(
    result,
    {
      target: new ZedVariable("A1"),
      operand: new ZedString(`"Hello"`),
      operator: null,
    } as ZedAssignment
  );
});

Deno.test("ZedAssignment->number", ()=>{
  const tokens = new TokenArray(lex(`= A1 42`));
  const result = new ZedAssignment(tokens);
  assertEquals(
    result,
    {
      target: new ZedVariable("A1"),
      operand: new ZedNumber(42),
      operator: null,
    } as ZedAssignment
  );
});

Deno.test("ZedAssignment->operator", ()=>{
  const tokens = new TokenArray(lex(`= A1 42 +`));
  const result = new ZedAssignment(tokens);
  assertEquals(
    result,
    {
      target: new ZedVariable("A1"),
      operand: new ZedNumber(42),
      operator: "add",
    } as ZedAssignment
  );
});

Deno.test("ZedAssignment->input", ()=>{
  const tokens = new TokenArray(lex(`= A1 IN[]`));
  const result = new ZedAssignment(tokens);
  assertEquals(
    result,
    {
      target: new ZedVariable("A1"),
      operand: { promptParams: [] } as ZedInput,
      operator: null,
    } as ZedAssignment
  );
});

// treated as the next token; in other words, ignored.
Deno.test("ZedAssignment->invalidOperator", ()=>{
  const tokens = new TokenArray(lex(`= A1 Z80 %`));
  new ZedAssignment(tokens);
});

Deno.test("ZedOutput->multiple", ()=>{
  const tokens = new TokenArray(lex(`OUT[Z80+"Hello"+42]`));
  const result = new ZedOutput(tokens);
  assertEquals(
    result.promptParams,
    [
      new ZedVariable("Z80"),
      new ZedString(`"Hello"`),
      new ZedNumber(42)
    ]
  );
});

Deno.test("ZedCondition->equality", ()=>{
  const tokens = new TokenArray(lex(`== 11 22`));
  const result = new ZedCondition(tokens);
  assertEquals(
    result,
    {
      operator: "eq",
      left: new ZedNumber(11),
      right: new ZedNumber(22),
      invert: false,
    } as ZedCondition
  );
});

Deno.test("ZedCondition->invertEquality", ()=>{
  const tokens = new TokenArray(lex(`!== 11 22`));
  const result = new ZedCondition(tokens);
  assertEquals(
    result,
    {
      operator: "eq",
      left: new ZedNumber(11),
      right: new ZedNumber(22),
      invert: true,
    } as ZedCondition
  );
});

Deno.test("ZedCondition->logical", ()=>{
  const tokens = new TokenArray(lex(`&& ! <= 11 11 >= 22 22`));
  const result = new ZedCondition(tokens);
  assertEquals(
    result,
    {
      operator: "and",
      left: {
        operator: "le",
        left: new ZedNumber(11),
        right: new ZedNumber(11),
        invert: true
      } as ZedCondition,
      right: {
        operator: "ge",
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
  ));
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
  ));
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
        } as ZedAssignment
      ],
    } as ZedDoBlock
  );
});

Deno.test("ZedDoBlock->assignForgotEndOfStatement", ()=>{
  const tokens = new TokenArray(lex(
    `DO = A1 2 = B1 3 +: ENDDO`
  ));
  const result = new ZedDoBlock(tokens);
  assertEquals(
    result,
    {
      errors: [
        new ParserError("expectedEndOfStatement", {} as any)
      ],
      statements: [
        {
          target: new ZedVariable("A1"),
          operand: new ZedNumber(Number("2")),
          operator: null,
        } as ZedAssignment,
        {
          target: new ZedVariable("B1"),
          operand: new ZedNumber(Number("3")),
          operator: "add",
        } as ZedAssignment
      ],
    } as ZedDoBlock
  );
});

Deno.test("ZedPreTestLoop->valid", ()=>{
  const tokens = new TokenArray(lex(
    `WHEN == A1 Z1 DO ENDDO ENDWHEN`
  ));
  const result = new ZedPreTestLoop(tokens);
  assertEquals(
    result,
    {
      condition: {
        invert: false,
        left: new ZedVariable("A1"),
        right: new ZedVariable("Z1"),
        operator: "eq",
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
  ));
  assertThrows(()=>{
    new ZedPreTestLoop(tokens);
  });
});

Deno.test("ZedPostTestLoop->valid", ()=>{
  const tokens = new TokenArray(lex(
    `REPEAT DO ENDDO UNTIL == A1 Z1 ENDREPEAT`
  ));
  const result = new ZedPostTestLoop(tokens);
  assertEquals(
    result,
    {
      condition: {
        invert: false,
        left: new ZedVariable("A1"),
        right: new ZedVariable("Z1"),
        operator: "eq",
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
  ));
  assertThrows(()=>{
    new ZedPostTestLoop(tokens);
  });
});

Deno.test("ZedForLoop->valid", ()=>{
  const tokens = new TokenArray(lex(
    `FOR I1 FROM 1 TO 10 BY 1 DO ENDDO ENDFOR`
  ));
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
  ));
  assertThrows(()=>{
    new ZedForLoop(tokens);
  });
});

Deno.test("ZedBinarySelection->if", ()=>{
  const tokens = new TokenArray(lex(
    `IF == A1 Z1 DO ENDDO ENDIF`
  ));
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
            operator: "eq",
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
  ));
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
            operator: "eq",
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
  ));
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
            operator: "eq",
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
            operator: "eq",
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
  ));
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
  ));
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
