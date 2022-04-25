export const defaultImports = {
  print_num: (arg: any) => {
    console.log("Logging int from WASM: ", arg);
  },
  print_bool: (arg: any) => {
    console.log("Logging bool from WASM: ", arg == "1" ? "true" : "false");
  },
  print_none: () => {
    console.log("Logging NONE from WASM");
  },
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
};
