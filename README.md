# Wathon: A Python-to-WebAssembly Compiler _(cse231-pa3)_

A ChocoPy-to-Wasm compiler written in Typescript for the browser.

## Background
This was an assignment for UCSD's [CSE231: Advanced Compiler Design, Spring
2022, taught by Joe Politz.](https://ucsd-cse231-s22.github.io/) It compiles
[ChocoPy](https://chocopy.org/) (a small subset of the [Python](https://www.python.org/)
programming language) into [WebAssembly](https://webassembly.org/), a portible
compilation target that can be run within the browser.

## Install
This repo uses the [`pnpm`](https://pnpm.io/) package manager. With `pnpm`
installed:
- clone the repository
- run `pnpm i` to install the needed dependencies
- run `pnpm build-web` to build the web interface in the `build` folder,
  or run `pnpm build-cli` to build a cli program in the `cli` folder.

## Usage

### Web Interface
Run `pnpm build-web` to build the web interface. This will create a `build`
folder containing an `index.html` file and the needed javascript. To access
this, I'd recommend going into the `build` folder and running
`python -m http.server` if you have python3 installed on your system. This
will launch a local web server, and you can access the compiler at
`localhost:8000`.

### Command Line Interface
Run `pnpm build-cli` to build a command line program. This will generate files
in the `cli` folder. Once in the `cli` folder, you can run commands such as
`node node-main.js "1+1"` to compile the program "1+1" and see the compiled
program in console output.

### Tests
Run `pnpm test` to run the test suite.

## Assignment 3 Writeup

**Due Friday, April 29th, at 11:59pm**

In this PA, you will design and implement a compiler for classes in ChocoPy. You
should not discuss your code and implementation with anyone.

You _can_:

- Ask for clarifications of the specification (though most of our answers will
be “check what ChocoPy does”)
- Ask for help with PA2 code/implementation (from us or other students)
- Ask for help/clarification on concepts from lecture handouts, readings, etc (with us or other students)
- Use any code we've provided or code from class
- Use online resources to help you understand WASM and Typescript
- Start from code from a PA2 submission (whether you reviewed it or not). **If
you do this** you agree to not share your code publicly, so that we aren't
pressuring people from the class to make their code public. If you write all of
your own code, you're welcome to publish it after the deadline (e.g. as part of
something you might share for job interviews, etc). Credit code you use, and use
your judgment – if you just learned a neat trick from code you saw, probably fine
to use and share, but don't copy paste large blocks of code and make public.

re won't answer questions about your PA3 implementation, or help with debugging
it (we will answer questions about the specification, just not help with your
code). The purpose of this PA is to evaluate how well you learned material from
the first half of the course; you might learn a lot from it, but there should be
no new or surprising material. So this is one of few truly
**individual assessments** in this course.
j
## Language Specification

You'll be implementing the following subset of ChocoPy:

```
program := <var_def | class_def>* <stmt>*
class_def := class <name>(object):
                  <var_def | method_def>+
var_def := <typed_var> = <literal>
typed_var := <name> : <type>
method_def := def <name>(self: <type> [, <typed_var>]*) [-> <type>]?: <method_body>
method_body := <var_def>* <stmt>+
stmt := <name> = <expr>
      | <expr>.<name> = <expr>
      | if <expr>: <stmt>+ else: <stmt>+
      | return <expr>?
      | <expr>
      | pass
expr := <literal>
      | <name>
      | <uniop> <expr>
      | <expr> <binop> <expr>
      | ( <expr> )
      | print(<expr>)
      | <name>()
      | <expr>.<name>
      | <expr>.<name>([<expr> [, <expr>]*]?)
uniop := not | -
binop := + | - | * | // | % | == | != | <= | >= | < | > | is
literal := None
         | True
         | False
         | <number>
type := int | bool | <name>
number := 32-bit integer literals
name := Python identifiers other than `print` or keywords
```

We will explicitly _exclude_ inheritance from the subset we implement. We
also limit the subset beyond the limitations in PA2:

- There are no function definitions (but there are method definitions, which
are quite similar)
- If-else statements always have a then branch and an else branch, with no
`elif`
- There are no `while` loops
- As with PA2, there are no lists, strings, for loops, nested functions, or
global/nonlocal declarations

The behavior of a program in the subset described above is specified to be the
behavior of ChocoPy on that program. Programs outside the subset of the grammar
defined can have any behavior, so if you have a compiler you want to start from
that implements more of PA2, feel free, and in particular you don't have to
report parse errors for programs outside this grammar (we prefer it if you have
some sensible parse errors, but it's too hard to specify what “sensible” means
there, so we leave it open).

Note that by “behavior” we mean both the static and dynamic behavior. So if
ChocoPy fails to compile a program with a type error, your compiler should as
well. Error messages don't need to match ChocoPy exactly, but should use the
same important keywords in the same cases so that it's recognizably close.

## Interfaces

To automatically test your compiler, we will need your implementation to respect
the requirements at
[https://github.com/ucsd-cse231-s22/pa3-tests](https://github.com/ucsd-cse231-s22/pa3-tests)

The testing strategy in that repository will be used in the autograder to test
your implementation for this PA. For reference, `run` should compile and
evaluate a given program, and we'll rely on the output of `print` to test its
behavior. `typeCheck` should type-check a given program and return the _type_ of
the last statement in the body of the program.

Make sure you're able to `npm test` locally before uploading to the autograder.

## Recommendations, Starting Points, and Resources

There is no official starter code for the project; feel free to use any of the
resources outlined above or provided from class to start.

You are also free to use the internet, books, other course resources, and any
programming tools. The only constraint is that you can't have communication
with others (inside or outside the class) to help complete your
implementation.

If you were unhappy with your PA2, it's not a bad idea to either start from a
compiler you think is pretty good, or just start from scratch. You might be
surprised how much you've learned and how much progress you can make starting
from a blank slate for PA3, and how much you have to modify a PA2
implementation to get to PA3.

## Grading and Handin

A number of automated tests will be run on your compiler in order to assess it.
We will run a more extensive set of tests that we do not share that will also be
a part of your grade.

You will submit your code to Gradescope (available on Friday), and you should
see immediate feedback on which tests you passed and failed from the subset
we've shared.
