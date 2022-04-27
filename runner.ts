// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from "wabt";
import { compile } from "./compiler";
import { parse } from "./parser";
import { tcProgram } from "./tc";

// NOTE(joe): This is a hack to get the CLI Repl to run. WABT registers a global
// uncaught exn handler, and this is not allowed when running the REPL
// (https://nodejs.org/api/repl.html#repl_global_uncaught_exceptions). No reason
// is given for this in the docs page, and I haven't spent time on the domain
// module to figure out what's going on here. It doesn't seem critical for WABT
// to have this support, so we patch it away.
if (typeof process !== "undefined") {
  const oldProcessOn = process.on;
  process.on = (...args: any): any => {
    if (args[0] === "uncaughtException") {
      return;
    } else {
      return oldProcessOn.apply(process, args);
    }
  };
}

export async function run(
  source: string,
  config: any
): Promise<{ ans: number; source: string; mem: number[] }> {
  // If empty body, don't panic, just don't do anything
  if (source === "") {
    return { ans: undefined, source: "", mem: [] };
  }

  // Initalize memory in the importObject
  config.importObject.js = {
    mem: new WebAssembly.Memory({
      initial: 10,
      maximum: 100,
    }),
  };

  const wabtInterface = await wabt();
  const parsed = parse(source);

  const typeChecked = tcProgram(parsed);
  const compiled = compile(typeChecked);

  const importObject = config.importObject;
  const myModule = wabtInterface.parseWat("test.wat", compiled.wasmSource);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  const result = (wasmModule.instance.exports.exported_func as any)();
  const mem = (() => {
    let i32 = new Uint32Array(config.importObject.js.mem.buffer);
    return Array.from(i32);
  })();

  console.log(`Memory:`);
  for (let i = 1; i < 11; i++) {
    console.log(`${i * 4}\t${mem[i]}`);
  }

  return { ans: result, source: compiled.wasmSource, mem };
}
