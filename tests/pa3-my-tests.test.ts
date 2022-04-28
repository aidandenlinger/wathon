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

describe("basic class", () => {
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

  assertTCFail(
    "Doesn't typecheck a class with an invalid typedVar",
    `
class C(object):
  x : bool = 123
  y : int = True`
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

  assertTCFail(
    "Can't declare a class and variable with same name",
    `
class C(object):
  x : int = 123
  
C : int = 3`
  );

  assertTCFail(
    "Can't call class constructor with wrong num of args",
    `
class C(object):
  x : int = 123
  
x : C = None
x = C(123)`
  );

  assertPrint(
    "Can instantiate a class without erroring",
    `
class C(object):
  x : int = 123
  
x : C = None
x = C()`,
    [""]
  );
});

describe("getfield", () => {
  assertParse("Parses basic getfield", "c.x", {
    ...blankPrgm,
    body: [
      {
        tag: "expr",
        expr: { tag: "getfield", obj: { tag: "id", name: "c" }, field: "x" },
      },
    ],
  });

  assertParse("Parses nested getfield", "a.b.c", {
    ...blankPrgm,
    body: [
      {
        tag: "expr",
        expr: {
          tag: "getfield",
          obj: { tag: "getfield", obj: { tag: "id", name: "a" }, field: "b" },
          field: "c",
        },
      },
    ],
  });

  assertTCFail(
    "Can't access fields on an int",
    `
x : int = 3
x.a`
  );

  assertTCFail(
    "Can't acess invalid fields on an obj",
    `
class C(object):
  x : int = 123
  
x : C = None
x = C()
x.y`
  );

  assertTC(
    "Typecheck allows accessing valid fields",
    `
class C(object):
  y : int = 123
  
x : C = None
x = C()
x.y`,
    NUM
  );

  assertPrint(
    "Successful field access",
    `
class C(object):
  y : int = 123

x : C = None
x = C()
print(x.y)`,
    ["123"]
  );
});

describe("field assign", () => {
  assertPrint(
    "Regular assigns still work",
    `
x : int = 0
x = 2
print(x)`,
    ["2"]
  );

  assertParse("Parses basic field assign", `x.a = 3`, {
    ...blankPrgm,
    body: [
      {
        tag: "assign",
        lhs: { tag: "field", obj: { tag: "id", name: "x" }, field: "a" },
        value: { tag: "literal", value: { tag: "num", value: 3 } },
      },
    ],
  });

  assertTCFail(
    "Can't set fields on an int",
    `
x : int = 3
x.a = 3`
  );

  assertTCFail(
    "Can't acess invalid fields on an obj",
    `
class C(object):
  x : int = 123
  
x : C = None
x = C()
x.y = 5`
  );

  assertTC(
    "Typecheck allows setting valid fields with valid type",
    `
class C(object):
  y : int = 123
  
x : C = None
x = C()
x.y = 5`,
    NUM
  );

  assertTCFail(
    "Can't set field with wrong type",
    `
class C(object):
  y : int = 123
  
x : C = None
x = C()
x.y = False`
  );

  assertTC(
    "Can typecheck setting field to another class",
    `
class C(object):
  d : D = None
  
class D(object):
  x : int = 123
  
x : C = None
x = C()
x.d = D()
x.d`,
    { tag: "object", class: "D" }
  );

  assertTC(
    "Can typecheck nested assigns",
    `
class C(object):
  d : D = None
  
class D(object):
  y : int = 123
  
x : C = None
x = C()
x.d = D()
x.d.y = 5
x.d.y`,
    NUM
  );

  assertTC(
    "Can assign None to object types",
    `
class C(object):
  d : D = None
  
class D(object):
  y : int = 123
  
x : C = None
x = C()
x.d = None
x.d`,
    { tag: "object", class: "D" }
  );

  assertPrint(
    "Successfully reassign field",
    `
class C(object):
  num : int = 123
  
x : C = None
x = C()
x.num = 456
print(x.num)`,
    ["456"]
  );

  assertPrint(
    "Successfully reassign consecutive fields",
    `
  class C(object):
  x : int = 123
  y : int = 456

x : C = None
x = C()
x.x = 7
x.y = 8
print(x.x)
print(x.y)`,
    ["7", "8"]
  );

  assertPrint(
    "Assign fields with two separate classes",
    `
class A(object):
  b : int = 123
  
class C(object):
  d : int = 456
  
x : A = None
y : C = None
x = A()
y = C()
x.b = 1
y.d = 2
print(x.b + y.d)`,
    ["3"]
  );
});

describe("Classes hold methods", () => {
  assertParse(
    "Parse class with methods",
    `
class C(object):
  x : int = 123
  
  def test(self: C) -> int:
    return 3
  
  y : int = 456`,
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
            {
              typedVar: { name: "y", type: "int" },
              value: { tag: "num", value: 456 },
            },
          ],
          methods: [
            {
              name: "test",
              params: [{ name: "self", type: { tag: "object", class: "C" } }],
              ret: "int",
              inits: [],
              body: [
                {
                  tag: "return",
                  expr: { tag: "literal", value: { tag: "num", value: 3 } },
                },
              ],
            },
          ],
        },
      ],
    }
  );

  assertTCFail(
    "Fail methods that don't have the first parameter of their own class",
    `
class C(object):
  def funcWithoutSelf() -> int:
    return 3`
  );

  assertTCFail(
    "Ensure methods are typechecked by function rules",
    `
class C(object):
  def test(self : C) -> int:
    return True`
  );

  assertTC(
    "Ensure methods can return objects",
    `
class C(object):
  def test(self : C, b : D) -> D:
    return b
    
class D(object):
  y : int = 3`,
    NONE
  );

  assertTCFail(
    "Ensure methods cannot return invalid objects",
    `
class C(object):
  def test(self : C) -> D:
    return 1`
  );

  assertTC(
    "Methods can return none in place of objects",
    `
class C(object):
  def test(self : C) -> C:
    return None`,
    NONE
  );
});

describe("Method calls", () => {
  assertParse("still parses regular calls", `test()`, {
    ...blankPrgm,
    body: [
      {
        tag: "expr",
        expr: {
          tag: "call",
          name: "test",
          args: [],
        },
      },
    ],
  });

  assertParse("parses method calls", `x.test()`, {
    ...blankPrgm,
    body: [
      {
        tag: "expr",
        expr: {
          tag: "method",
          obj: { tag: "id", name: "x" },
          method: "test",
          args: [],
        },
      },
    ],
  });

  assertParse("Parses nested method calls", `x.y.test()`, {
    ...blankPrgm,
    body: [
      {
        tag: "expr",
        expr: {
          tag: "method",
          obj: { tag: "getfield", obj: { tag: "id", name: "x" }, field: "y" },
          method: "test",
          args: [],
        },
      },
    ],
  });

  assertParse("Parses stacked method calls", `x.y().test()`, {
    ...blankPrgm,
    body: [
      {
        tag: "expr",
        expr: {
          tag: "method",
          obj: {
            tag: "method",
            obj: { tag: "id", name: "x" },
            method: "y",
            args: [],
          },
          method: "test",
          args: [],
        },
      },
    ],
  });

  assertTCFail(
    "Ensure we can't call nonexistant methods",
    `
class C(object):
  def test(self : C) -> int:
    return 3
    
x : C = None
x = C()
x.funcThatDoesntExist()`
  );

  assertTCFail(
    "Ensure we can't call on nonclasses",
    `
x : int = 3
x.asString()`
  );

  assertTCFail(
    "Ensure method calls are checked like functions",
    `
class C(object):
  def test(self : C, x : int) -> int:
    return x
    
x : C = None
x = C()
x.test()`
  );

  assertTC(
    "Ensure we can call a method",
    `
class C(object):
  def test(self : C, x : int) -> int:
    return x
    
x : C = None
x = C()
x.test(3)`,
    NUM
  );

  assertTC(
    "Ensure we can call a method with no args",
    `
class C(object):
  def id(self : C) -> C:
    return self
    
x : C = None
x = C()
x.id()`,
    { tag: "object", class: "C" }
  );

  assertTC(
    "Ensure we can call a function with None",
    `
class C(object):
  def otherId(self : C, other : C) -> C:
    return other
    
x : C = None
x = C()
x.otherId(None)`,
    { tag: "object", class: "C" }
  );

  assertPrint(
    "Successfully call a method",
    `
class C(object):
  x : int = 123
  def getX(self : C) -> int:
    return self.x
    
x : C = None
x = C()
print(x.getX())`,
    ["123"]
  );

  assertPrint(
    "Successfully call a method that doesn't return anything",
    `
class C(object):
  x : int = 123
  def setX(self : C):
    self.x = 4

c : C = None
c = C()
c.setX()
print(c.x)`,
    ["4"]
  );
});

// Questions: print_none?
// tldr lots of None
// TODO: getting/setting fields on None, runtime error
// TOOD: method calls on None, runtime error
// TODO: calls like r1.mul(None), None is an acceptable parameter for a class but should cause a runtime error!

// TODO: class with no fields, but has methods! Can be called and stuff with other classes existing!
