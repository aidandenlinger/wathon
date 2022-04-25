import { BinOp, UniOp } from "./ast";

/**
 * Map of BinOps to their cooresponding WAT instructions. If it's not so simple,
 * you'll need to edit codeGenExpr.
 */
export const binOpToInstr: Map<BinOp, string> = new Map([
  [BinOp.ADD, "(i32.add)"],
  [BinOp.SUB, "(i32.sub)"],
  [BinOp.MUL, "(i32.mul)"],
  [BinOp.DIV, "(i32.div_s)"],
  [BinOp.MOD, "(i32.rem_s)"],
  [BinOp.EQ, "(i32.eq)"],
  [BinOp.NE, "(i32.ne)"],
  [BinOp.LT, "(i32.lt_s)"],
  [BinOp.LE, "(i32.le_s)"],
  [BinOp.GT, "(i32.gt_s)"],
  [BinOp.GE, "(i32.ge_s)"],
]);

export const uniOpToInstr: Map<UniOp, string> = new Map([
  [UniOp.NEG, "(i32.mul (i32.const -1))"],
  [UniOp.NOT, "(i32.xor (i32.const 1))"],
]);
