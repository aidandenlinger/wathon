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

describe("basic class lookup", () => {
  assertParse(
    "Parses a class with integers",
    `
class C(object):
  x : int = 123
`,
    {
      vars: [],
      funcs: [],
      classes: [
        {
          name: "C",
          vars: [
            {
              typedVar: { name: "x", type: "int" },
              value: { tag: "num", value: 123 },
            },
          ],
          methods: [],
        },
      ],
      body: [],
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
      vars: [],
      funcs: [],
      classes: [
        {
          name: "C",
          vars: [
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
});
