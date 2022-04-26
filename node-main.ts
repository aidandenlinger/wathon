import { run } from "./runner";

function cli() {
  const importObject = {
    imports: {
      // we typically define print to mean logging to the console. To make testing
      // the compiler easier, we define print so it logs to a string object.
      //  We can then examine output to see what would have been printed in the
      //  console.
      print_num: (arg: any) => {
        console.log(arg);
        return arg;
      },
      print_bool: (arg: any) => {
        if (arg !== 0) {
          console.log("True");
        } else {
          console.log("False");
        }
      },
      print_none: () => {
        console.log("None");
      },
      abs: Math.abs,
      pow: Math.pow,
      min: Math.min,
      max: Math.max,
    },

    output: "",
  };

  // command to run:
  // node node-main.js 987
  const input = process.argv[2];
  const config = { importObject };
  run(input, config).then((value) => {
    console.log(value.ans);
  });
}

cli();
