import { BinOp, Stmt, Type, UniOp } from "./ast";

/**
 * Map of BinOps to their accepted types and return type.
 *
 * For example, EQ will accept two ints or two bools, and returns an int.
 */
export const binopTypes: Map<BinOp, [Type[][], Type]> = new Map([
  [BinOp.ADD, [[["int", "int"]], "int"]],
  [BinOp.SUB, [[["int", "int"]], "int"]],
  [BinOp.MUL, [[["int", "int"]], "int"]],
  [BinOp.DIV, [[["int", "int"]], "int"]],
  [BinOp.MOD, [[["int", "int"]], "int"]],
  [BinOp.LT, [[["int", "int"]], "bool"]],
  [BinOp.LE, [[["int", "int"]], "bool"]],
  [BinOp.GT, [[["int", "int"]], "bool"]],
  [BinOp.GE, [[["int", "int"]], "bool"]],
  [BinOp.IS, [[["none", "none"]], "bool"]],
  [
    BinOp.EQ,
    [
      [
        ["int", "int"],
        ["bool", "bool"],
      ],
      "bool",
    ],
  ],
  [
    BinOp.NE,
    [
      [
        ["int", "int"],
        ["bool", "bool"],
      ],
      "bool",
    ],
  ],
]);

/**
 * Map of UniOps to their accepted types and return types.
 */
export const uniOpTypes: Map<UniOp, [Type[], Type]> = new Map([
  [UniOp.NOT, [["bool"], "bool"]],
  [UniOp.NEG, [["int"], "int"]],
]);

/**
 * Map of builtin functions and their type signatures.
 *
 * For example, min takes in two ints and returns an int.
 */
export const builtinTypes: Map<string, [Type[], Type]> = new Map([
  ["print_num", [["int"], "int"]],
  ["print_bool", [["bool"], "bool"]],
  ["print_none", [["none"], "none"]],
  ["abs", [["int"], "int"]],
  ["min", [["int", "int"], "int"]],
  ["max", [["int", "int"], "int"]],
  ["pow", [["int", "int"], "int"]],
]);

/**
 * Checks a grouping of statements to ensure any returns matches the expected
 * return type, throws otherwise.
 *
 * @param stmts Collection of statements in a block
 * @param expectedRet the type this block is expected to return
 * @throws if any statement returns an incorrect type
 */
export function checkForInvalidReturns(stmts: Stmt<Type>[], expectedRet: Type) {
  const extras = stmts
    .filter((s) => s.tag === "return" && s.a !== expectedRet)
    .map((s) => s.a);

  if (extras.length !== 0) {
    throwNotExpectedType(expectedRet, extras[0]);
  }
}

// ALL TYPE-CHECKING ERRORS

/**
 * Throw an error for when a variable is declared twice in the same scope.
 *
 * @param s the name of the variable
 * @throws yes ;)
 */
export function throwDupDecl(s: string) {
  throw new Error(
    `TYPE ERROR: Duplicate declaration of identifier in same scope: ${s}`
  );
}

/**
 * Throw an error for when an expression's type is not the expected type (ex,
 * assigning a bool to a variable that was declared to be an int)
 *
 * @param expected The expected type
 * @param got The type that was actually received
 * @throws yes ;)
 */
export function throwNotExpectedType(expected: Type, got: Type) {
  throw new Error(
    `TYPE ERROR: Expected type \`${expected}\`; got type \`${got}\``
  );
}

/**
 * Throw an error during a function call when the provided argument is not the
 * expected type for that parameter.
 *
 * @param expected The expected type
 * @param got The type that was actually received
 * @param pos the parameter position where the error occured
 * @throws yes ;)
 */
export function throwNotExpectedTypeParam(
  expected: Type,
  got: Type,
  pos: number
) {
  throw new Error(
    `TYPE ERROR: Expected type \`${expected}\`; got type \`${got}\` in parameter ${pos}`
  );
}

/**
 * Throw an error when a function doesn't return on all execution branches.

 * @param funcName name of the function where the error occured
 * @throws yes ;)
 */
export function throwMustReturn(funcName: string) {
  throw new Error(
    `TYPE ERROR: All paths in this function/method must have a return statement: ${funcName}`
  );
}

/**
 * Throw an error when a function tries to use a variable name that doesn't
 * exist in its env.
 *
 * @param name name of nonexistant var
 * @throws yes ;)
 */
export function throwNotAVar(name: string) {
  throw new Error(`TYPE ERROR: Not a variable: ${name}`);
}

/**
 * Throw an error when an expr tries to call a nonexistant function.
 *
 * @param name name of nonexistant function
 * @throws yes ;)
 */
export function throwNotAFunc(name: string) {
  throw new Error(`TYPE ERROR: Not a function or class: ${name}`);
}

/**
 * Throws an error when a condition in an if/while is not a bool.
 *
 * @param actualType Type that was there instead of bool
 * @throws yes ;)
 */
export function throwCondNotBool(actualType: Type) {
  throw new Error(
    `TYPE ERROR: Condition expression cannot be of type \`${actualType}\``
  );
}

/**
 * Throws an error when a function call has the wrong number of arguments.
 *
 * @param expected expected num of args
 * @param got number of args received
 */
export function throwWrongNumArgs(expected: number, got: number) {
  throw new Error(`TYPE ERROR: Expected ${expected} arguments; got ${got}`);
}

export function throwWrongUniopArg(op: UniOp, arg: Type) {
  throw new Error(
    `TYPE ERROR: Cannot apply operator \`${op}\` on type \`${arg}\``
  );
}
/**
 * Throw an error when a BinOp is given the wrong argument types.
 *
 * @param op BinOp with wrong types
 * @param left type on left
 * @param right type on right
 */
export function throwWrongBinopArgs(op: BinOp, left: Type, right: Type) {
  throw new Error(
    `TYPE ERROR: Cannot apply operator \`${op}\` on types \`${left}\` and \`${right}\``
  );
}
