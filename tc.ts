import {
  ClassDef,
  Expr,
  FunDef,
  Literal,
  Program,
  Stmt,
  Type,
  TypedVar,
  VarDef,
} from "./ast";
import {
  builtinTypes,
  binopTypes,
  checkForInvalidReturns,
  throwCondNotBool,
  throwDupDecl,
  throwMustReturn,
  throwNotAFunc,
  throwNotAVar,
  throwNotExpectedType,
  throwNotExpectedTypeParam,
  throwWrongNumArgs,
  throwWrongBinopArgs,
  uniOpTypes,
  throwWrongUniopArg,
  assignableTo,
  throwInvalidType,
  isObject,
  throwNoAttr,
  throwShadowClass,
  throwMethodNeedsSelf,
  throwNoMethod,
} from "./tcUtils";

type BodyEnv = Map<string, Type>;
type FuncEnv = Map<string, [Type[], Type]>;
type ClassEnv = Map<string, ClassDef<null>>;

/**
 * Given a Program AST, annotates it with proper types, throws if not typesafe.
 *
 * @param p Program AST without annotations
 * @returns with annotations
 * @throws if variable names are redeclared in global scope
 */
export function tcProgram(p: Program<null>): Program<Type> {
  const classEnv = new Map();
  p.classes.forEach((c) => {
    if (classEnv.has(c.name)) throwDupDecl(c.name);
    classEnv.set(c.name, c);
  });

  const vars = p.vars.map((v) => tcVarDef(v, classEnv));
  const globals = new Map<string, Type>();
  vars.forEach((v) => {
    if (globals.has(v.typedVar.name) || classEnv.has(v.typedVar.name))
      throwDupDecl(v.typedVar.name);
    globals.set(v.typedVar.name, v.a);
  });

  // define funcEnv before typechecking funcs, since all funcs can use each other
  const funcEnv = new Map(builtinTypes);
  // Now typecheck funcs
  p.funcs.forEach((func) => {
    if (
      funcEnv.has(func.name) ||
      globals.has(func.name) ||
      classEnv.has(func.name)
    )
      throwDupDecl(func.name);
    funcEnv.set(func.name, [func.params.map((p) => p.type), func.ret]);
  });

  const classes = p.classes.map((c) => tcClass(c, globals, funcEnv, classEnv));
  const funcs = p.funcs.map((f) => tcFunDef(f, globals, funcEnv, classEnv));

  // Typecheck body, which returns "none"
  const body = p.body.map((s) => tcStmt(s, globals, funcEnv, "none", classEnv));

  const finalStmtType = (() => {
    if (body.length === 0) {
      return "none";
    }
    return body[body.length - 1].a;
  })();

  const finalProg: Program<Type> = {
    ...p,
    body,
    vars,
    funcs,
    classes,
    a: finalStmtType,
  };

  console.log(`Typechecked:\n${JSON.stringify(finalProg, null, 2)}`);
  return finalProg;
}

export function tcClass(
  c: ClassDef<null>,
  globals: BodyEnv,
  funcs: FuncEnv,
  classes: ClassEnv
): ClassDef<Type> {
  const fields = c.fields.map((f) => tcVarDef(f, classes));

  // TODO: ensure first parameter is self with correct type, then only consider
  // the rest of the params
  const methods = c.methods.map((m) => tcFunDef(m, globals, funcs, classes));
  methods.forEach((m) => {
    if (
      m.params.length === 0 ||
      !isObject(m.params[0].a) ||
      m.params[0].a.class !== c.name
    )
      throwMethodNeedsSelf(m.name);
  });

  return { ...c, fields, methods };
}

/**
 * Annotates a VarDef with its type, throws if not typesafe.
 *
 * @param v VarDef without annotations
 * @returns VarDef with annotations
 * @throws if typedVar's type isn't literal's type
 */
export function tcVarDef(v: VarDef<null>, classes: ClassEnv): VarDef<Type> {
  const typedVar = tcTypedVar(v.typedVar, classes);
  const value = tcLiteral(v.value);
  if (!assignableTo(value.a, typedVar.a))
    throwNotExpectedType(typedVar.a, value.a);

  return { ...v, typedVar, value, a: typedVar.a };
}
/**
 * Checks TypeVar to make sure type is valid
 *
 * @param v TypedVar without annotations
 * @returns annotated TypedVar
 * @throws if assigning to a nonexistant class
 */
export function tcTypedVar(
  v: TypedVar<null>,
  classes: ClassEnv
): TypedVar<Type> {
  if (isObject(v.type) && !classes.has(v.type.class))
    throwInvalidType(v.type.class);
  return { ...v, a: v.type };
}

/**
 * Annotates the given function and the items it holds with their types, throws
 * if not typesafe.
 *
 * @param f Function without annotations
 * @param globals Variables in global scope
 * @param funcs Functions in global scope
 * @returns annotated function
 * @throws if locals duplicate a name in global space
 * @throws if function has a return that returns the wrong type
 * @throws if function does not return on all execution branches
 */
export function tcFunDef(
  f: FunDef<null>,
  globals: BodyEnv,
  funcs: FuncEnv,
  classes: ClassEnv
): FunDef<Type> {
  const locals: BodyEnv = new Map();

  // Ensure it's returning a valid Type
  if (isObject(f.ret) && !classes.has(f.ret.class))
    throwInvalidType(f.ret.class);

  // add params to locals and check for duplicates
  const params = f.params.map((p) => tcTypedVar(p, classes));
  params.forEach((p) => {
    if (locals.has(p.name)) throwDupDecl(p.name);
    if (classes.has(p.name)) throwShadowClass(p.name);
    locals.set(p.name, p.a);
  });

  // add local variables to locals and check for duplicates
  const inits = f.inits.map((i) => tcVarDef(i, classes));
  inits.forEach((i) => {
    if (locals.has(i.typedVar.name)) throwDupDecl(i.typedVar.name);
    if (classes.has(i.typedVar.name)) throwShadowClass(i.typedVar.name);
    locals.set(i.typedVar.name, i.typedVar.type);
  });

  // local env, where local variable names overwrite global variable names!
  // Don't need to worry about class vars - they need to be accessed through
  // the "self" parameter
  const env = new Map([
    ...Array.from(globals.entries()),
    ...Array.from(locals.entries()),
  ]);

  const body = f.body.map((s) => tcStmt(s, env, funcs, f.ret, classes));

  // Check each return to ensure it returns the function type
  body
    .filter((s) => s.tag === "return")
    .forEach((s) => {
      if (!assignableTo(s.a, f.ret)) throwNotExpectedType(f.ret, s.a);
    });

  // basic return check - if we say we're returning something, make sure we
  // either have a return in the body, or we have an if expression that is
  // *guaranteed* to return on all branches. This type checker annotates that
  // by giving such an if statement an annotation, otherwise it's annotated none
  if (
    f.ret !== "none" &&
    body.filter((s) => s.tag === "return").length === 0 &&
    body.filter((s) => s.tag === "if" && assignableTo(s.a, f.ret)).length === 0
  ) {
    throwMustReturn(f.name);
  }

  return { ...f, params, body, inits, a: f.ret };
}

/**
 * Annotates a given Statement with its type, throws if not typesafe.
 *
 * An If expression has an annotation of "none" unless every branch returns, in
 * which case it has an annotation of the type that every return statement
 * returns.
 *
 * @param s Statement without annotation
 * @param env variables the statement can access (global + local)
 * @param funcs global functions the statement can call
 * @param currentRet the type that is expected to be returned - "none" if in program body
 * @returns annotated Statement
 * @throws if statement assigns to a non-existant variable
 * @throws if statement assigns the wrong type to a variable
 * @throws if condition expression is not a bool
 */
export function tcStmt(
  s: Stmt<null>,
  env: BodyEnv,
  funcs: FuncEnv,
  currentRet: Type,
  classes: ClassEnv
): Stmt<Type> {
  switch (s.tag) {
    case "assign": {
      if (typeof s.lhs === "string") {
        if (!env.has(s.lhs)) throwNotAVar(s.lhs);
        const value = tcExpr(s.value, env, funcs, classes);
        if (!assignableTo(value.a, env.get(s.lhs)))
          throwNotExpectedType(env.get(s.lhs), value.a);
        return { ...s, value, a: value.a };
      }
      // s.lhs is a lookup
      const obj = tcExpr(s.lhs.obj, env, funcs, classes);
      const fieldType = tcField(obj, s.lhs.field, classes);
      const value = tcExpr(s.value, env, funcs, classes);
      if (!assignableTo(value.a, fieldType))
        throwNotExpectedType(fieldType, value.a);

      return { ...s, value, lhs: { ...s.lhs, obj, a: obj.a }, a: fieldType };
    }
    case "expr": {
      const expr = tcExpr(s.expr, env, funcs, classes);
      return { ...s, expr, a: expr.a };
    }
    case "return":
      if (s.expr === undefined) {
        return { ...s, a: "none" };
      }
      const expr = tcExpr(s.expr, env, funcs, classes);
      return { ...s, expr, a: expr.a };
    case "if": {
      const cond: Expr<Type> = tcExpr(s.cond, env, funcs, classes);
      if (!assignableTo(cond.a, "bool")) throwCondNotBool(cond.a);

      const body = s.body.map((s) =>
        tcStmt(s, env, funcs, currentRet, classes)
      );
      checkForInvalidReturns(body, currentRet);

      // annotation is currently none: without an else branch this statement
      // might not run code at all, so let's assume not.
      const checkedStmt: Stmt<Type> = { tag: "if", cond, body, a: "none" };

      if (s.elif !== undefined) {
        const elifCond = tcExpr(s.elif.cond, env, funcs, classes);
        if (!assignableTo(cond.a, "bool")) throwCondNotBool(cond.a);
        const elifBody = s.elif.body.map((s) =>
          tcStmt(s, env, funcs, currentRet, classes)
        );
        checkForInvalidReturns(elifBody, currentRet);

        checkedStmt.elif = { cond: elifCond, body: elifBody };
      }

      if (s.else !== undefined) {
        const elseBody = s.else.map((s) =>
          tcStmt(s, env, funcs, currentRet, classes)
        );
        checkForInvalidReturns(elseBody, currentRet);

        checkedStmt.else = elseBody;

        // Since we have an else, we now know something from this statement will
        // be run - if they all return, we can generate a statement.

        let alwaysReturns =
          body.filter((s) => s.tag === "return").length !== 0 &&
          elseBody.filter((s) => s.tag === "return").length !== 0;

        if (s.elif !== undefined) {
          alwaysReturns =
            alwaysReturns &&
            checkedStmt.elif.body.filter((s) => s.tag === "return").length !==
              0;
        }

        if (alwaysReturns) {
          checkedStmt.a = currentRet;
        }
      }

      return checkedStmt;
    }
    case "while": {
      const cond = tcExpr(s.cond, env, funcs, classes);
      if (!assignableTo(cond.a, "bool")) throwCondNotBool(cond.a);
      const body = s.body.map((s) =>
        tcStmt(s, env, funcs, currentRet, classes)
      );
      checkForInvalidReturns(body, currentRet);

      // we can *never* assume that the while returns anything, since it may
      // never execute in the first place
      return { ...s, cond, body, a: "none" };
    }
    case "pass": {
      return { ...s, a: "none" };
    }
  }
}

/**
 * Annotates a given Expression with its type, throws if not typesafe.
 *
 * @param e Expression without annotation
 * @param env variables the expr can access (global + local)
 * @param funcs global functions the expr can access
 * @returns annotated Expr
 * @throws if using a non-existant variable or function
 * @throws if performing a call with wrong number of args
 * @throws if parameter type is wrong
 * @throws if applying operator on incorrect types
 */
export function tcExpr(
  e: Expr<null>,
  env: BodyEnv,
  funcs: FuncEnv,
  classes: ClassEnv
): Expr<Type> {
  switch (e.tag) {
    case "literal":
      const value = tcLiteral(e.value);
      return { ...e, value, a: value.a };
    case "id":
      if (!env.has(e.name)) throwNotAVar(e.name);
      return { ...e, a: env.get(e.name) };
    case "call": {
      // Typechecked earlier to avoid variable/class name collisions
      if (classes.has(e.name)) {
        // Class constructor
        if (e.args.length !== 0) throwWrongNumArgs(0, e.args.length);
        return { ...e, a: { tag: "object", class: e.name } };
      }
      const args = e.args.map((a) => tcExpr(a, env, funcs, classes));
      if (e.name === "print") {
        e.name = (() => {
          switch (args[0].a) {
            case "int":
              return "print_num";
            case "bool":
              return "print_bool";
            case "none":
              return "print_none";
          }
        })();
      }
      if (!funcs.has(e.name)) throwNotAFunc(e.name);
      const [defArgs, ret] = funcs.get(e.name);
      if (defArgs.length != e.args.length)
        throwWrongNumArgs(defArgs.length, e.args.length);

      args.forEach((arg, i) => {
        if (!assignableTo(arg.a, defArgs[i]))
          throwNotExpectedTypeParam(defArgs[i], arg.a, i);
      });

      return { ...e, args, a: ret };
    }
    case "uniop": {
      const [acceptedTypes, retType] = uniOpTypes.get(e.op);
      const arg = tcExpr(e.arg, env, funcs, classes);

      if (!acceptedTypes.includes(arg.a)) throwWrongUniopArg(e.op, arg.a);

      return { ...e, arg, a: retType };
    }
    case "binop": {
      const [acceptedTypes, retType] = binopTypes.get(e.op);
      const left = tcExpr(e.left, env, funcs, classes);
      const right = tcExpr(e.right, env, funcs, classes);

      // Funky code to see if there isn't any entry that matches our left and
      // right types.
      if (!acceptedTypes.some((i) => i[0] == left.a && i[1] == right.a))
        throwWrongBinopArgs(e.op, left.a, right.a);
      return { ...e, left, right, a: retType };
    }
    case "parenthesis": {
      const expr = tcExpr(e.expr, env, funcs, classes);
      return { ...e, expr, a: expr.a };
    }
    case "getfield": {
      const obj = tcExpr(e.obj, env, funcs, classes);
      const fieldType = tcField(obj, e.field, classes);

      return { ...e, obj, a: fieldType };
    }
    case "method": {
      const obj = tcExpr(e.obj, env, funcs, classes);
      if (!isObject(obj.a)) throwNoMethod(obj.a, e.method);
      const classInfo = classes.get(obj.a.class);
      const method = classInfo.methods.find((m) => m.name === e.method);
      if (method === undefined) throwNoMethod(obj.a, e.method);

      // we DON'T need to check the first argument: it is the "self" argument.
      // if "self" was the wrong type, we wouldn't be accessing this method in
      // the first place, since we had to go through it to get here!
      const [defArgs, ret] = [
        method.params.map((p) => p.type).slice(1),
        method.ret,
      ];
      const args = e.args.map((a) => tcExpr(a, env, funcs, classes));

      if (defArgs.length != args.length)
        throwWrongNumArgs(defArgs.length, args.length);

      args.forEach((arg, i) => {
        if (!assignableTo(arg.a, defArgs[i]))
          throwNotExpectedTypeParam(defArgs[i], arg.a, i);
      });

      return { ...e, obj, args, a: ret };
    }
  }
}

/**
 * Typecheck a field access by ensuring the class has the field.
 *
 * @param obj
 * @param fieldName
 * @param classes
 * @returns
 * @throws if trying to access a field on a non-object
 * @throws if object does not have fieldname
 */
export function tcField(
  obj: Expr<Type>,
  fieldName: string,
  classes: ClassEnv
): Type {
  if (!isObject(obj.a)) {
    throwNoAttr(obj.a, fieldName);
  }
  const classInfo = classes.get(obj.a.class);
  const field = classInfo.fields.find((f) => f.typedVar.name === fieldName);
  if (field === undefined) throwNoAttr(obj.a, fieldName);
  return field.typedVar.type;
}

/**
 * Annotates a literal with its type, cannot fail.
 *
 * @param l Literal without annotation
 * @returns annotated literal
 */
export function tcLiteral(l: Literal<null>): Literal<Type> {
  switch (l.tag) {
    case "num":
      return { ...l, a: "int" };
    case "bool":
      return { ...l, a: "bool" };
    case "none":
      return { ...l, a: "none" };
  }
}
