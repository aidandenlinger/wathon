import { expect } from "chai";
import { Program } from "../ast";
import { parse } from "../parser";
import {
  assertPrint,
  assertFail,
  assertTCFail,
  assertTC,
} from "./asserts.test";
import { NUM, BOOL, NONE, CLASS } from "./helpers.test";

function assertParse(name: string, source: string, result: Program<null>) {
  it(name, () => {
    expect(parse(source)).to.deep.equal(result);
  });
}

// npm run my-test doesn't hook asserts.test.ts, copy this over to prevent
// printing
before(function () {
  console.log = function () {};
});

let blankPrgm: Program<null> = {
  vars: [],
  funcs: [],
  classes: [],
  body: [],
};

describe("basic class lookup", () => {
  assertParse(
    "Parses a class with integers",
    `
class C(object):
  x : int = 123
`,
    {
      ...blankPrgm,
      classes: [
        {
          name: "C",
          fields: [
            {
              typedVar: { name: "x", type: "int" },
              value: { tag: "num", value: 123 },
            },
          ],
          methods: [],
        },
      ],
    }
  );

  assertParse(
    "Parses a class with integers and statement afterwards",
    `
class C(object):
  x : int = 123

print(z)
`,
    {
      ...blankPrgm,
      classes: [
        {
          name: "C",
          fields: [
            {
              typedVar: { name: "x", type: "int" },
              value: { tag: "num", value: 123 },
            },
          ],
          methods: [],
        },
      ],
      body: [
        {
          tag: "expr",
          expr: {
            tag: "call",
            name: "print",
            args: [{ tag: "id", name: "z" }],
          },
        },
      ],
    }
  );

  assertParse(
    "Can parse vars as None/classes",
    `
x : C = None`,
    {
      ...blankPrgm,
      vars: [
        {
          typedVar: { name: "x", type: { tag: "object", class: "C" } },
          value: { tag: "none" },
        },
      ],
    }
  );

  assertTC(
    "Can typecheck vars as None/as classes",
    `
class C(object):
  x : int = 123
  
x : C = None
x`,
    { tag: "object", class: "C" }
  );

  assertTCFail(
    "Doesn't typecheck a nonexistant class",
    `
x : C = None`
  );

  assertTC(
    "allows for classes to be used out of order in var definitions",
    `
x : C = None

class C(object):
  dig : D = None
  
class D(object):
  e : int =123
  
x`,
    { tag: "object", class: "C" }
  );

  assertPrint(
    "Can assign variables to None",
    `
class C(object):
  x : int = 123
  
x : C = None
`,
    [""]
  );

  // Questions: print_none?
  // TODO: method that returns None in place of an object
  // TODO: class with no fields, but has methods!
  // TODO: calls like r1.mul(None), None is an acceptable parameter for a class
  // but should cause a runtime error!
});
