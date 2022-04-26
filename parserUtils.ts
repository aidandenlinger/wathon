import { TreeCursor } from "@lezer/common";
import { BinOp, Type, UniOp } from "./ast";

/**
 * A Map from tokens to their respective BinOp. This is the reverse of the BinOp
 * enum, which very likely means I'm not taking full advantage of TypeScript
 * here - future things to look into.
 */
export const strToBinop: Map<string, BinOp> = new Map([
  ["+", BinOp.ADD],
  ["-", BinOp.SUB],
  ["*", BinOp.MUL],
  ["//", BinOp.DIV],
  ["%", BinOp.MOD],
  ["==", BinOp.EQ],
  ["!=", BinOp.NE],
  ["<", BinOp.LT],
  ["<=", BinOp.LE],
  [">", BinOp.GT],
  [">=", BinOp.GE],
  ["is", BinOp.IS],
]);

/**
 * A Map from tokens to their respective UniOp. Again, probably not the most
 * efficient or beautiful solution.
 */
export const strToUniOp: Map<string, UniOp> = new Map([
  ["not", UniOp.NOT],
  ["-", UniOp.NEG],
]);

/**
 * Throw a parse error for the token the TreeCursor is currently pointing at.
 *
 * @param c TreeCursor pointing at parse error
 * @param s source program
 * @throws yes ;)
 */
export function throwParseError(c: TreeCursor, s: string) {
  throw new Error(`Parse error near token: ${s.substring(c.from, c.to)}`);
}

/**
 * Given an "AssignStatement", return true if VarDef, else it's an assign
 *
 * @param c A tree cursor pointed at an "AssignStatement"
 * @returns true if a varDef, false otherwise
 */
export function isVarDef(c: TreeCursor): boolean {
  c.firstChild();
  c.nextSibling();
  const shouldBeTypeDef = c.node.type.name;
  c.parent(); //return
  return shouldBeTypeDef === "TypeDef";
}

/**
 * Given a string, return its type or error
 *
 * @param s A string that could be a type
 * @returns A type
 */
export function toType(s: string): Type {
  switch (s) {
    case "int":
      return "int";
    case "bool":
      return "bool";
    case "none":
      return "none";
    default:
      return { tag: "object", class: s };
  }
}

// DEBUGGING UTILS

/**
 * Takes in a TreeCursor, the source program, and the current indent level
 * to turn a Lezer Python tree into a string.
 *
 * @author Yousef Alhessi
 * @param t TreeCursor at the root of the tree to print
 * @param source the source program the tree cursor is looking at
 * @param d the current indent level, should start at 0
 * @returns string representation of the lezer tree
 */
export function stringifyTree(t: TreeCursor, source: string, d: number) {
  var str = "";
  var spaces = " ".repeat(d * 2);
  str += spaces + t.type.name;
  if (
    [
      "Number",
      "CallExpression",
      "BinaryExpression",
      "UnaryExpression",
      "VariableName",
    ].includes(t.type.name)
  ) {
    str += "-->" + source.substring(t.from, t.to);
  }
  str += "\n";
  if (t.firstChild()) {
    do {
      str += stringifyTree(t, source, d + 1);
    } while (t.nextSibling());
    t.parent();
  }
  return str;
}
