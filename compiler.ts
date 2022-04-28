import {
  Stmt,
  Expr,
  Literal,
  Program,
  FunDef,
  Type,
  VarDef,
  ClassDef,
} from "./ast";
import {
  binOpToInstr,
  checkNone,
  getFieldIndex,
  uniOpToInstr,
} from "./compilerUtils";
import { RuntimeErrors } from "./panic";
import { isObject } from "./tcUtils";

type LocalEnv = Map<string, boolean>;
type ClassEnv = Map<string, ClassDef<Type>>;

type CompileResult = {
  wasmSource: string;
};

/**
 * Given an annotated Program, return a WAT program for execution.
 *
 * @param p annotated program AST
 * @returns WAT program
 */
export function compile(p: Program<Type>): CompileResult {
  const globals = p.vars
    .concat([
      {
        typedVar: { name: "heap", type: "int" },
        value: { tag: "num", value: 4 },
        a: "int",
      },
    ])
    .map(codeGenGlobalVarDef);

  const classes = new Map();
  p.classes.forEach((c) => classes.set(c.name, c));
  const classFuncs = p.classes
    .map((c) =>
      c.methods
        .map((m) =>
          codeGenFunDef({ ...m, name: `$${c.name}$${m.name}` }, classes)
        )
        .flat()
    )
    .flat();

  const funcs = p.funcs.map((f) => codeGenFunDef(f, classes)).flat();

  // all needs to be reworked with var inits and globals
  const scratchVar: string = `(local $$scratch i32)`;
  const localDefines = [scratchVar];

  var returnType = "";
  var returnExpr = "";
  if (p.body.length !== 0) {
    const lastExpr = p.body[p.body.length - 1];
    if (lastExpr.tag === "expr") {
      returnType = "(result i32)";
      returnExpr = "(local.get $$scratch)";
    }
  }

  const blankEnv = new Map();
  const body = codeGenStmts(p.body, blankEnv, classes);

  const commands = `(module
    (import "js" "mem" (memory 10))
    (func $print_num (import "imports" "print_num") (param i32) (result i32))
    (func $print_bool (import "imports" "print_bool") (param i32) (result i32))
    (func $print_none (import "imports" "print_none") (param i32) (result i32))
    (func $abs (import "imports" "abs") (param i32) (result i32))
    (func $min (import "imports" "min") (param i32 i32) (result i32))
    (func $max (import "imports" "max") (param i32 i32) (result i32))
    (func $pow (import "imports" "pow") (param i32 i32) (result i32))
    (func $panic (import "imports" "panic") (param i32))

    ${globals.join("\n    ")}
    ${classFuncs.join("\n\n")}
    ${funcs.join("\n\n")}

    (func (export "exported_func") ${returnType}
        ${localDefines.join("        ")}
        ${body.join("\n        ")}
        ${returnExpr}
    )
)`;
  console.log(`Generated:\n${commands}`);

  return {
    wasmSource: commands,
  };
}

/**
 * Given a VarDef for a global parameter, return Wasm instruction to initalize
 * it.
 *
 * @param v annotated VarDef
 * @returns WAT instrs for creating a global
 */
function codeGenGlobalVarDef(v: VarDef<Type>): string {
  const val = (() => {
    switch (v.value.tag) {
      case "num":
        return v.value.value;
      case "bool":
        return v.value.value ? "1" : "0";
      case "none":
        return 0;
    }
  })();
  return `(global $${v.typedVar.name} (mut i32) (i32.const ${val}))`;
}

/**
 * Compile a function into WAT instructions.
 *
 * @param fun Annotated FunDef
 * @returns WAT instructions for the function
 */
function codeGenFunDef(fun: FunDef<Type>, classes: ClassEnv): string[] {
  const locals = new Map();
  fun.params.forEach((p) => locals.set(p.name, true));
  fun.inits.forEach((i) => locals.set(i.typedVar.name, true));

  const paramInstrs = fun.params.map((p) => `(param $${p.name} i32)`);

  const initInstrs = fun.inits.map((i) => `\t(local $${i.typedVar.name} i32)`);

  initInstrs.push(
    ...fun.inits.map((i) => {
      if (i.value.tag === "num") {
        return `\t(local.set $${i.typedVar.name} (i32.const ${i.value.value}))`;
      } else if (i.value.tag === "bool") {
        return `\t(local.set $${i.typedVar.name} (i32.const ${
          i.value.value ? "1" : "0"
        }))`;
      }
    })
  );

  const bodyInstrs = codeGenStmts(fun.body, locals, classes);

  const retInstr = (() => {
    if (fun.ret === "none") {
      return "";
    }
    return "(result i32)";
  })();

  // WASM doesn't seem to do deep analysis. If a function has its final returns
  // in an if/else statement, it won't recognize that and will have a validation
  // error if the function doesn't have some int on the stack to return. Hence
  // our dummy value: by typechecker, your function should've returned a long
  // time ago, and this will never come into play. However, if you randomly get
  // a 9999 as a return value... this is probably the wrong solution :)
  const dummyVal = retInstr !== "" ? `(i32.const 9999)` : ``;

  return [
    `
    (func $${fun.name} ${paramInstrs.join(" ")} ${retInstr} 
      (local $$scratch i32)
      ${initInstrs.join("\n      ")}
      ${bodyInstrs.join("\n      ")}
      ${dummyVal}
    )`,
  ];
}

/**
 * Compile an annotated Stmt into its cooresponding WAT instructions.
 *
 * @param stmt Annotated Stmt
 * @param locals Map of local variables, to decide between local and global .set
 * @returns WAT instructions for the Stmt, and updated number of while loops
 */
function codeGenStmt(
  stmt: Stmt<Type>,
  locals: LocalEnv,
  classes: ClassEnv
): string[] {
  switch (stmt.tag) {
    case "assign":
      if (typeof stmt.lhs === "string") {
        const setInstr = locals.has(stmt.lhs) ? "local.set" : "global.set";
        const valStmts = codeGenExpr(stmt.value, locals, classes);
        return valStmts.concat([`(${setInstr} $${stmt.lhs})`]);
      }
      // stmt.lhs is an object
      const getObj = codeGenExpr(stmt.lhs.obj, locals, classes);
      const fieldIndex = getFieldIndex(stmt.lhs.obj.a, stmt.lhs.field, classes);
      const newValue = codeGenExpr(stmt.value, locals, classes);

      return [
        `${getObj}
        ${checkNone}
        (i32.add (i32.const ${fieldIndex * 4}))
        ${newValue}
        (i32.store)`,
      ];
    case "expr":
      const exprStmts = codeGenExpr(stmt.expr, locals, classes);
      if (
        (stmt.expr.tag == "call" || stmt.expr.tag == "method") &&
        stmt.expr.a == "none"
      ) {
        // if the function returns None, don't try to save its value since there is none!
        return exprStmts;
      }
      return exprStmts.concat(`(local.set $$scratch)`);
    case "return":
      const returnStmts =
        stmt.expr === undefined ? [] : codeGenExpr(stmt.expr, locals, classes);
      return returnStmts.concat([`(return)`]);
    case "pass":
      return [];
    case "if": {
      const result: string[] = [];
      result.push(...codeGenExpr(stmt.cond, locals, classes)); // cond on stack
      result.push(`(if`, `(then`);

      const instrs = codeGenStmts(stmt.body, locals, classes).map(
        (x) => "    " + x
      );

      result.push(...instrs);
      result.push(`)`); // close the then

      if (stmt.elif !== undefined) {
        result.push(`(else`);
        result.push(...codeGenExpr(stmt.elif.cond, locals, classes));
        result.push(`(if`, `(then`);

        const instrs = codeGenStmts(stmt.elif.body, locals, classes).map(
          (x) => x + "    "
        );

        result.push(...instrs);
        result.push(`)`); // close then

        if (stmt.else !== undefined) {
          const instrs = codeGenElse(stmt, locals, classes);
          result.push(...instrs);
        }

        result.push(`)`); // close if
        result.push(`)`); // close else branch
      } else if (stmt.else !== undefined) {
        const instrs = codeGenElse(stmt, locals, classes).map(
          (x) => "    " + x
        );
        result.push(...instrs);
      }

      result.push(`)`); // close the top level if
      return result;
    }
    case "while": {
      const cond = codeGenExpr(stmt.cond, locals, classes);
      const body = codeGenStmts(stmt.body, locals, classes);

      // We use an xor to flip the condition, since br_if will branch if
      // the condition is true.
      // br 0 breaks to the closest loop, loop, which restarts.
      // br_if 1 will break to the 2nd closest loop, the block, which escapes
      // the loop, if the boolean is true.
      return [
        `(block
           (loop
            ${cond.join("\n    ")}
            (i32.xor (i32.const 1))
            (br_if 1)
            ${body.join("\n    ")}
            (br 0)
           )
          )`,
      ];
    }
  }
}

/**
 * Given an "if" statement, generate the code needed for the `else` portion.
 * Needed because otherwise, this big code block is needed in *both* elif and
 * the else portion. There's definitely a better way of doing this, but this
 * isn't horrid.
 *
 * You must update your whileCount with the whileCount returned from this
 * function.
 *
 * @param stmt an if statement with an else
 * @param locals local variables the environment
 * @returns the compiled instructions for the else body
 */
function codeGenElse(
  stmt: Stmt<Type>,
  locals: LocalEnv,
  classes: ClassEnv
): string[] {
  // Make Typescript happy - we've already checked this, this function is only
  // called when we're evaluating an if statement
  if (stmt.tag === "if" && stmt.else !== undefined) {
    const result = [];
    result.push(`(else`);

    const instrs = codeGenStmts(stmt.else, locals, classes);

    result.push(...instrs);

    result.push(`)`); // close else

    return result;
  }
  throw new Error(`Logic error in codeGenElse`);
}

/**
 * Evaluate many statements and return their commands as well as the new
 * whileCount label.
 *
 * You must update your whileCount with the whileCount returned from this
 * function.
 *
 * @param stmts list of statements to generate code for
 * @param locals the local variables the stmts have access to
 * @returns instructions for the stmts and the new whileCount
 */
function codeGenStmts(
  stmts: Stmt<Type>[],
  locals: LocalEnv,
  classes: ClassEnv
): string[] {
  return stmts.map((s) => codeGenStmt(s, locals, classes).concat([""])).flat();
}

/**
 * Compile an annotated Expr into WAT instructions.
 *
 * @param expr Annotated Expr
 * @param locals the local variables for this function, used to decide between local and global .get
 * @returns WAT instructions for the expr
 * @throws if I forgot to implement a binop
 */
function codeGenExpr(
  expr: Expr<Type>,
  locals: LocalEnv,
  classes: ClassEnv
): string[] {
  switch (expr.tag) {
    case "call": {
      if (classes.has(expr.name)) {
        // Class constructor
        const initvals: string[] = [];
        const classdata = classes.get(expr.name);
        classdata.fields.forEach((f, index) => {
          const offset = index * 4;

          // Get the value of the heap, add to get to our offset, get our value,
          // store it there
          initvals.push(
            `(global.get $heap)`,
            `(i32.add (i32.const ${offset}))`,
            ...codeGenLiteral(f.value),
            `(i32.store)`
          );
        });

        // Finally, get the value of the start of our item
        // then bump the heap up by the number of fields * 4 to the next free
        // area
        return initvals.concat(
          `(global.get $heap)`,
          `(global.set $heap (i32.add (global.get $heap) (i32.const ${
            classdata.fields.length * 4
          })))`
        );
      }
      // typecheck has already replaced "print" with its type specific print
      return expr.args
        .map((a) => codeGenExpr(a, locals, classes))
        .flat()
        .concat([`(call $${expr.name})`]);
    }
    case "literal": {
      return codeGenLiteral(expr.value);
    }
    case "id": {
      const setInstr = locals.has(expr.name) ? "local.get" : "global.get";
      return [`(${setInstr} $${expr.name})`];
    }
    case "uniop": {
      if (!uniOpToInstr.has(expr.op)) {
        throw new Error(`TODO: ${expr.op} unimplemented in compiler`);
      }
      const arg = codeGenExpr(expr.arg, locals, classes);
      return [...arg, uniOpToInstr.get(expr.op)];
    }
    case "binop": {
      if (!binOpToInstr.has(expr.op)) {
        throw new Error(`TODO: ${expr.op} unimplemented in compiler`);
      }

      const leftStmts = codeGenExpr(expr.left, locals, classes);
      const rightStmts = codeGenExpr(expr.right, locals, classes);
      return [
        ...leftStmts, // put left on stack
        ...rightStmts, // put right on stack
        binOpToInstr.get(expr.op), // perform operation and put on stack
      ];
    }
    case "parenthesis": {
      return codeGenExpr(expr.expr, locals, classes);
    }
    case "getfield": {
      const objStmts = codeGenExpr(expr.obj, locals, classes);
      const fieldIndex = getFieldIndex(expr.obj.a, expr.field, classes);

      return [
        ...objStmts,
        `(i32.add (i32.const ${fieldIndex * 4}))`,
        `(i32.load)`,
      ];
    }
    case "method": {
      const argInstrs = [expr.obj, ...expr.args]
        .map((a) => codeGenExpr(a, locals, classes))
        .flat();
      if (!isObject(expr.obj.a)) throw new Error("Should not happen");

      return [...argInstrs, `(call $$${expr.obj.a.class}$${expr.method})`];
    }
  }
}

/**
 * Given an annotated Literal, return the WAT instructions for its initalization.
 *
 * @param l annotated Literal
 * @returns WAT instructions for initalization
 */
function codeGenLiteral(l: Literal<Type>): string[] {
  switch (l.tag) {
    case "num":
      return ["(i32.const " + l.value + ")"];
    case "bool":
      return [`(i32.const ${l.value ? "1" : "0"})`];
    case "none":
      return [`(i32.const 0)`];
  }
}
