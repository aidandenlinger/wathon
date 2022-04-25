import "mocha";
import { expect } from "chai";
import { importObject } from "./import-object.test";
import {run, typeCheck} from "./helpers.test";
import { fail } from 'assert'


// Clear the output before every test
beforeEach(function () {
  importObject.output = "";
});

// suppress console logging so output of mocha is clear
before(function () {
  console.log = function () {};
});

// Assert the output of printing matches the expected output
export function assertPrint(name: string, source: string, expected: Array<string>) {
  it(name, async () => {
    await run(source);
    const output = importObject.output;
    expect(importObject.output.trim().split("\n")).to.deep.eq(expected);
  });
}

// Assert an error gets thrown at runtime
export function assertFail(name: string, source: string) {
  it(name, async () => {
    try {
      await run(source);
      fail("Expected an exception");
    } catch (err) {
      expect(err.message).to.contain("RUNTIME ERROR:");
    }
  });
}

// Assert the last expression in the program has the correct type
export function assertTC(name: string, source: string, result: any) {
  it(name, async () => {
      const typ = typeCheck(source);
      expect(typ).to.deep.eq(result);
  });
}

// Assert an error gets thrown at type-checking
export function assertTCFail(name: string, source: string) {
  it(name, async () => {
    expect(function(){
      typeCheck(source);
  }).to.throw('TYPE ERROR:');
  });
}

