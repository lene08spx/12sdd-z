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
} from "./parse.ts";

Deno.test("lex", ()=>{
  assertEquals(lex(`PROG HI\nENDPROG`), [
    { type: "keyword", value: "PROG", line: 0, position: 0 },
    { type: "other", value: "HI", line: 0, position: 5 },
    { type: "keyword", value: "ENDPROG", line: 1, position: 0 },
  ])
});

Deno.test("ZedInOutParams->empty", ()=>{
  const tokens = lex(`[]`);
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    []
  );
});

Deno.test("ZedInOutParams->variable", ()=>{
  const tokens = lex(`[Z80]`);
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    [new ZedVariable("Z80")]
  );
});

Deno.test("ZedInOutParams->string", ()=>{
  const tokens = lex(`["Hello"]`);
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    [new ZedString(`"Hello"`)]
  );
});

Deno.test("ZedInOutParams->number", ()=>{
  const tokens = lex(`[42]`);
  const result = new ZedInOutParams(tokens);
  assertEquals(
    result,
    [new ZedNumber(42)]
  );
});

Deno.test("ZedInOutParams->multiple", ()=>{
  const tokens = lex(`[Z80+"Hello"+42]`);
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
  const tokens = lex(`[Z80,42]`);
  assertThrows(()=>{
    new ZedInOutParams(tokens)
  });
});

Deno.test("ZedInput->valid", ()=>{
  const tokens = lex(`IN[]`);
  const result = new ZedInput(tokens);
  assertEquals(
    result.promptParams,
    []
  );
});

Deno.test("ZedInput->invalid", ()=>{
  const tokens = lex(`INPUT[]`);
  assertThrows(()=>{
    new ZedInput(tokens);
  });
});

Deno.test("ZedAssignment->variable", ()=>{
  const tokens = lex(`= A1 Z80`);
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
  const tokens = lex(`= A1 "Hello"`);
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
  const tokens = lex(`= A1 42`);
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
  const tokens = lex(`= A1 42 +`);
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
  const tokens = lex(`= A1 IN[]`);
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
  const tokens = lex(`= A1 Z80 %`);
  new ZedAssignment(tokens);
});

Deno.test("ZedOutput->multiple", ()=>{
  const tokens = lex(`OUT[Z80+"Hello"+42]`);
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
  const tokens = lex(`== 11 22`);
  const result = new ZedCondition(tokens);
  assertEquals(
    result,
    {
      operator: "eq",
      left: new ZedNumber(11),
      right: new ZedNumber(22),
      invert: false,
    } as ZedCondition
  )
});

Deno.test("ZedCondition->invertEquality", ()=>{
  const tokens = lex(`!== 11 22`);
  const result = new ZedCondition(tokens);
  assertEquals(
    result,
    {
      operator: "eq",
      left: new ZedNumber(11),
      right: new ZedNumber(22),
      invert: true,
    } as ZedCondition
  )
});

Deno.test("ZedCondition->logical", ()=>{
  const tokens = lex(`&& ! <= 11 11 >= 22 22`);
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
  )
});

