import { parser } from "@lezer/python";
import { TreeCursor } from "@lezer/common";
import {
  Expr,
  Stmt,
  FunDef,
  TypedVar,
  Program,
  Type,
  VarDef,
  Literal,
  ClassDef,
  LValue,
} from "./ast";
import {
  isVarDef,
  throwParseError,
  stringifyTree,
  strToBinop,
  toType,
  strToUniOp,
} from "./parserUtils";

/**
 * Given a Python source program, return a Program AST (as defined in ast.ts)
 * with no annotations.
 *
 * @param source Python program to parse
 * @returns AST of the Python program
 */
export function parse(source: string): Program<null> {
  const t = parser.parse(source);
  console.log(`lezer tree:\n${stringifyTree(t.cursor(), source, 2)}`);
  const parsed = traverse(t.cursor(), source);
  console.log(`parsed:\n${JSON.stringify(parsed, null, 2)}`);
  return parsed;
}

/**
 * Given a TreeCursor to the root of a python program `s`, return a parsed AST
 * Program with no annotations. Guarantees `c` will be pointed at the same
 * element as where it started at return time.
 *
 * @param c TreeCursor to lezer-tree root of problem
 * @param s source Python program
 * @returns AST of Python Program
 * @throws if parse error
 */
export function traverse(c: TreeCursor, s: string): Program<null> {
  switch (c.node.type.name) {
    case "Script":
      let inTree = c.firstChild();
      const typesInFirstSection = [
        "FunctionDefinition",
        "AssignStatement",
        "ClassDefinition",
      ];

      let funcs = [];
      let vars = [];
      let classes = [];
      while (inTree && typesInFirstSection.includes(c.node.type.name)) {
        // @ts-ignore
        if (c.node.type.name === "FunctionDefinition") {
          funcs.push(traverseFunDef(c, s));
          // @ts-ignore
        } else if (c.node.type.name === "ClassDefinition") {
          classes.push(traverseClassDef(c, s));
          // @ts-ignore
        } else if (c.node.type.name === "AssignStatement") {
          if (!isVarDef(c)) break; // normal assign, get out of here!
          vars.push(traverseVarDef(c, s));
        }
        inTree = c.nextSibling();
      }
      if (!inTree) {
        return { vars, funcs, body: [], classes };
      }

      let body = [];
      do {
        if (
          // @ts-ignore
          c.node.type.name === "FunctionDefinition" ||
          // @ts-ignore
          c.node.type.name === "ClassDefinition" ||
          isVarDef(c)
        )
          throwParseError(c, s);
        body.push(traverseStmt(c, s));
      } while (c.nextSibling());

      return { vars, funcs, body, classes };
    default:
      throwParseError(c, s);
  }
}

/**
 * Given a TreeCUrsor pointing at a ClassDefinition, return a parsed ClassDef
 * with no annotations. Guarantees `c` will point at the same element it started
 * at.
 *
 * @param c TreeCursor at a class definition
 * @param s source program
 * @returns parsed ClassDef
 */
export function traverseClassDef(c: TreeCursor, s: string): ClassDef<null> {
  c.firstChild(); // at "class"
  c.nextSibling(); // at name
  const name = s.substring(c.from, c.to);
  c.nextSibling(); // at "object"
  c.nextSibling(); // at body

  c.firstChild(); // enter body, at ":"
  let vars: VarDef<null>[] = [];
  let methods: FunDef<null>[] = [];
  while (c.nextSibling()) {
    switch (c.node.type.name) {
      case "AssignStatement": {
        vars.push(traverseVarDef(c, s));
        break;
      }
      case "FunctionDefinition":
        methods.push(traverseFunDef(c, s));
        break;
      default:
        throwParseError(c, s);
    }
  }

  // Class must be non-empty
  if (vars === [] && methods === []) throwParseError(c, s);
  c.parent();
  c.parent();

  return { name, fields: vars, methods };
}

/**
 * Given a TreeCursor pointing at an AssignStatement for a VarDef, return a
 * parsed VarDef with no annotations. Guarantees `c` will point at the same
 * element as where it started at return time.
 *
 * @param c TreeCursor at a VarDef
 * @param s source Python program
 * @returns parsed VarDef
 * @throws if parse error
 */
export function traverseVarDef(c: TreeCursor, s: string): VarDef<null> {
  // traversing the TypedVar will send us back to the beginning
  c.firstChild();
  const typedVar = traverseTypedVar(c, s);
  c.nextSibling(); // now at TypeDef
  c.nextSibling(); // now at equal sign
  c.nextSibling(); // now at value!
  const valStr = s.substring(c.from, c.to);

  // Type may not actually be what typedVar says it is - this case will
  // be caught in type checking later.
  const actualType = ((): Type => {
    switch (c.node.type.name) {
      case "Number":
        return "int";
      case "Boolean":
        return "bool";
      case "None":
        return "none";
      default:
        throwParseError(c, s);
    }
  })();

  const value = ((): Literal<null> => {
    switch (actualType) {
      case "int":
        return { tag: "num", value: Number(valStr) };
      case "bool":
        return { tag: "bool", value: valStr === "True" };
      case "none":
        return { tag: "none" };
      default:
        throwParseError(c, s);
    }
  })();

  // reset c!
  c.parent();
  return { typedVar, value };
}

/**
 * Given a TreeCursor pointed at the beginning of a typed var, parse into a
 * TypedVar with no annotations. Guarantees `c` will point at the same
 * element it started at when function returns.
 *
 * @param c TreeCursor at the start of a TypedVar
 * @param s Source program
 * @returns parsed TypedVar
 * @throws if parse error
 */
export function traverseTypedVar(c: TreeCursor, s: string): TypedVar<null> {
  const name = s.substring(c.from, c.to);
  c.nextSibling(); // TypeDef
  if (c.type.name !== "TypeDef") throwParseError(c, s);
  c.firstChild(); // at ":"
  c.nextSibling(); // at type
  const type: Type = toType(s.substring(c.from, c.to));
  c.parent(); // back to typeDef
  c.prevSibling(); // back to where we started
  return { name, type };
}

/**
 * Given a TreeCursor at a FunctionDefinition, return a parsed FunDef with no
 * annotations. Guarantees `c` will point at the same element it started at when
 * function returns.
 *
 * @param c TreeCursor pointed at a FunctionDefinition
 * @param s source Python program
 * @returns parsed FunDef
 * @throws if parse error
 */
export function traverseFunDef(c: TreeCursor, s: string): FunDef<null> {
  c.firstChild(); // at def
  c.nextSibling(); // at name
  const name = s.substring(c.from, c.to);
  c.nextSibling(); // at param list
  const params = traverseParams(c, s);
  c.nextSibling(); // at TypeDef for return, or body?
  let ret: Type = "none";
  if (c.type.name === "TypeDef") {
    c.firstChild();
    ret = toType(s.substring(c.from, c.to));
    c.parent();
    c.nextSibling(); // at Body
  }
  c.firstChild(); // at ":"
  let hasStmt = c.nextSibling(); // at first line of prgm

  const inits = [];
  while (hasStmt && c.type.name === "AssignStatement") {
    if (!isVarDef(c)) break; // normal assign! escape
    inits.push(traverseVarDef(c, s));
    hasStmt = c.nextSibling();
  }

  let body: Stmt<null>[] = [];
  // Grammar guarantees at least one statement for a valid function
  if (!hasStmt) throwParseError(c, s);
  do {
    if (isVarDef(c)) throwParseError(c, s);
    body.push(traverseStmt(c, s));
  } while (c.nextSibling());
  c.parent();
  c.parent();

  return { name, params, ret, inits, body };
}

/**
 * Given a tree cursor at a Param List, parse the parameters into a list of
 * TypedVars with no annotations. Guarantees `c` points to the same element it
 * started at when function exits.
 *
 * @param c Tree cursor pointed at ParamList
 * @param s source Program
 * @returns parsed list of parameters
 */
export function traverseParams(c: TreeCursor, s: string): TypedVar<null>[] {
  let params = [];
  c.firstChild(); // enter arglist at '('
  c.nextSibling(); // focus on var name

  // we're at '(' or a comma, move to actual element or nothing
  while (c.type.name !== ")") {
    params.push(traverseTypedVar(c, s)); // traverse argument
    c.nextSibling(); // at typeDef
    c.nextSibling(); // at comma or '('
    c.nextSibling(); // var name
  }

  c.parent(); // revert to where we were!

  return params;
}

/**
 * Given a TreeCursor at a statement, return the parsed Stmt with no
 * annotations. Guarantees `c` will point at the same element it started at when
 * function returns.
 *
 * @param c TreeCursor at a statement
 * @param s source Program
 * @returns parsed Stmt
 * @throws if parse error
 */
export function traverseStmt(c: TreeCursor, s: string): Stmt<null> {
  switch (c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // go to name
      let lhs: LValue<null> = (() => {
        switch (c.node.type.name) {
          // @ts-ignore
          case "VariableName":
            return s.substring(c.from, c.to);
          // @ts-ignore
          case "MemberExpression":
            return { tag: "field", ...traverseMemberExpr(c, s) };
          default:
            throwParseError(c, s);
        }
      })();
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      c.parent();
      return { tag: "assign", lhs, value };
    case "ExpressionStatement": {
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr };
    }
    case "ReturnStatement": {
      c.firstChild();
      if (!c.nextSibling()) {
        c.parent();
        return { tag: "return" };
      }
      const expr = traverseExpr(c, s);
      c.parent();
      return { tag: "return", expr: expr };
    }
    case "IfStatement": {
      c.firstChild(); // at If
      c.nextSibling(); // at cond
      const cond = traverseExpr(c, s);
      c.nextSibling(); // at body
      c.firstChild(); // at ":" in body

      let body = [];
      while (c.nextSibling()) {
        body.push(traverseStmt(c, s));
      }

      c.parent(); // out of body

      let stmt: Stmt<null> = { tag: "if", cond, body };

      let stillInTree = c.nextSibling();
      // else, we're either at "elif" or "else"
      // @ts-ignore
      if (stillInTree && c.node.type.name === "elif") {
        c.nextSibling(); // at elif's cond
        const elifCond = traverseExpr(c, s);
        c.nextSibling(); // at body
        c.firstChild(); // at ":" in body
        let elifBody = [];
        while (c.nextSibling()) {
          elifBody.push(traverseStmt(c, s));
        }
        c.parent(); // pop out of body

        stmt.elif = { cond: elifCond, body: elifBody };

        stillInTree = c.nextSibling();
      }

      // @ts-ignore
      if (stillInTree && c.node.type.name === "else") {
        c.nextSibling(); // now at else's body
        c.firstChild(); // at ":" in body
        let elseBody = [];
        while (c.nextSibling()) {
          elseBody.push(traverseStmt(c, s));
        }
        c.parent(); // pop out of body

        stmt.else = elseBody;
      }

      c.parent(); // leave if statement
      return stmt;
    }
    case "WhileStatement": {
      c.firstChild(); // at "while"
      c.nextSibling(); // at cond
      const cond = traverseExpr(c, s);
      c.nextSibling(); // at Body

      c.firstChild(); // enter body, at ":"
      // Grammar specifies there must be at least one statement
      if (!c.nextSibling()) throwParseError(c, s);
      const body: Stmt<null>[] = [];
      do {
        body.push(traverseStmt(c, s));
      } while (c.nextSibling());

      c.parent(); // leave body
      c.parent(); // leave WhileStatement

      return { tag: "while", cond, body };
    }
    case "PassStatement":
      return { tag: "pass" };
    default:
      throwParseError(c, s);
  }
}

/**
 * Given a member expression, traverse and return its parsed fields.
 *
 * @param c TreeCursor at MemberExpression
 * @param s source program
 * @returns parsed MemberExpression
 */
function traverseMemberExpr(
  c: TreeCursor,
  s: string
): { obj: Expr<null>; field: string } {
  c.firstChild(); // at first expression
  const obj = traverseExpr(c, s);
  c.nextSibling(); // at .
  c.nextSibling(); // at PropertyName for field
  const field = s.substring(c.from, c.to);
  c.parent(); // restore c!

  return { obj, field };
}

/**
 * Given a TreeCursor at an Expr, return the parsed Expr with no annotations.
 * Guarantees `c` will point at the same element it started at at function
 * return.
 *
 * @param c TreeCursor at Expr
 * @param s source Python program
 * @returns parsed Expr
 * @throws if parse error
 */
export function traverseExpr(c: TreeCursor, s: string): Expr<null> {
  switch (c.type.name) {
    case "None": {
      return { tag: "literal", value: { tag: "none" } };
    }
    case "Number": {
      return {
        tag: "literal",
        value: { tag: "num", value: Number(s.substring(c.from, c.to)) },
      };
    }
    case "Boolean": {
      return {
        tag: "literal",
        value: { tag: "bool", value: s.substring(c.from, c.to) === "True" },
      };
    }
    case "VariableName": {
      return { tag: "id", name: s.substring(c.from, c.to) };
    }
    case "UnaryExpression": {
      c.firstChild();
      const opStr = s.substring(c.from, c.to);
      if (!strToUniOp.has(opStr)) throwParseError(c, s);
      const op = strToUniOp.get(opStr);

      c.nextSibling();
      const arg = traverseExpr(c, s);

      c.parent();

      return { tag: "uniop", op, arg };
    }
    case "BinaryExpression": {
      // To implement new BinOps - add to strToOp in parseUtils.ts!

      // First, check if we have a proper operation
      c.firstChild(); // at left expr
      c.nextSibling(); // at operator
      const opStr = s.substring(c.from, c.to);
      if (!strToBinop.has(opStr)) throwParseError(c, s);
      const op = strToBinop.get(opStr);

      // go back to left elem and parse
      c.prevSibling();
      const left = traverseExpr(c, s);

      // go to right and parse
      c.nextSibling();
      c.nextSibling();
      const right = traverseExpr(c, s);

      // maintain invariant: finish at the node we started at
      c.parent();

      return { tag: "binop", op, left, right };
    }
    case "ParenthesizedExpression": {
      c.firstChild(); // at (
      c.nextSibling(); // at actual expr
      const expr = traverseExpr(c, s);
      c.parent(); //return!
      return { tag: "parenthesis", expr };
    }
    case "CallExpression": {
      c.firstChild(); // to name
      const name = s.substring(c.from, c.to);
      c.nextSibling(); // go to arglist
      const args = traverseArgs(c, s);
      c.parent(); // we've parsed everything, move back to start node

      return { tag: "call", name, args };
    }
    case "MemberExpression": {
      return { tag: "getfield", ...traverseMemberExpr(c, s) };
    }

    default:
      throwParseError(c, s);
  }
}

/**
 * Given an argument list, parse the Exprs into an array. Guarantees `c` points
 * to the same element it started at when function exits.
 *
 * @author Yousef Alhessi, Joe Politz
 * @param c TreeCursor at start of argument list
 * @param s source Python program
 * @returns List of arguments
 */
function traverseArgs(c: TreeCursor, s: string): Expr<null>[] {
  let args = [];
  c.firstChild(); // enter arglist at the parentheses
  c.nextSibling(); // move to first arg

  // we're at '(' or a comma, move to actual element or nothing
  while (c.type.name !== ")") {
    args.push(traverseExpr(c, s)); // traverse argument
    c.nextSibling(); // move to '(' or comma
    c.nextSibling(); // move to next expr
  }

  c.parent(); // revert to where we were!

  return args;
}
