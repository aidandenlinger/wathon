// TODO: returning in main body
export type Program<A> = {
  a?: A;
  vars: VarDef<A>[];
  funcs: FunDef<A>[];
  classes: ClassDef<A>[];
  body: Stmt<A>[];
};

export type ClassDef<A> = {
  name: string;
  fields: VarDef<A>[];
  methods: FunDef<A>[];
};

export type VarDef<A> = { a?: A; typedVar: TypedVar<A>; value: Literal<A> };

export type TypedVar<A> = { a?: A; name: string; type: Type };

// TODO: functions that return none
export type FunDef<A> = {
  a?: A;
  name: string;
  params: TypedVar<A>[];
  ret: Type;
  inits: VarDef<A>[];
  body: Stmt<A>[];
};

export type Stmt<A> =
  | { a?: A; tag: "assign"; name: string; value: Expr<A> }
  | {
      a?: A;
      tag: "if";
      cond: Expr<A>;
      body: Stmt<A>[];
      elif?: { cond: Expr<A>; body: Stmt<A>[] };
      else?: Stmt<A>[];
    }
  | { a?: A; tag: "while"; cond: Expr<A>; body: Stmt<A>[] }
  | { a?: A; tag: "pass" }
  | { a?: A; tag: "return"; expr?: Expr<A> }
  | { a?: A; tag: "expr"; expr: Expr<A> };

export type Expr<A> =
  | { a?: A; tag: "literal"; value: Literal<A> }
  | { a?: A; tag: "id"; name: string }
  | { a?: A; tag: "uniop"; op: UniOp; arg: Expr<A> }
  | { a?: A; tag: "binop"; op: BinOp; left: Expr<A>; right: Expr<A> }
  | { a?: A; tag: "parenthesis"; expr: Expr<A> }
  | { a?: A; tag: "call"; name: string; args: Expr<A>[] };

export enum UniOp {
  NOT = "not",
  NEG = "-",
}

// TODO: is
export enum BinOp {
  ADD = "+",
  SUB = "-",
  MUL = "*",
  DIV = "//",
  MOD = "%",
  EQ = "==",
  NE = "!=",
  LT = "<",
  LE = "<=",
  GT = ">",
  GE = ">=",
  IS = "is",
}

export type Literal<A> =
  | { a?: A; tag: "none" }
  | { a?: A; tag: "bool"; value: boolean }
  | { a?: A; tag: "num"; value: number };

export type Type = "int" | "bool" | "none";
