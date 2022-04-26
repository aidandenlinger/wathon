import { run } from "./runner";
import { defaultImports } from "./constants";

document.addEventListener("DOMContentLoaded", async () => {
  function display(arg: string) {
    const output = document.getElementById("output");
    output.textContent += arg + "\n";
  }

  const importObject = {
    imports: {
      ...defaultImports,
      print_num: (arg: any) => {
        console.log("Logging num from WASM: ", arg);
        display(String(arg));
        return arg;
      },
      print_bool: (arg: any) => {
        const val = arg === 1 ? "True" : "False";
        console.log("Logging bool from WASM: ", val);
        display(val);
        return arg;
      },
      print_none: (arg: any) => {
        console.log("Logging NONE from WASM");
        display("None");
        return arg;
      },
      abs: Math.abs,
      min: Math.min,
      max: Math.max,
      pow: Math.pow,
    },
  };

  // stop the form from any default behaviors
  document
    .getElementById("code-form")
    .addEventListener("submit", (e) => e.preventDefault());

  const generatedCodeBox = document.getElementById("generated-code");
  const output = document.getElementById("output");
  const generatedCodeLabels = Array.from(
    document.getElementsByClassName(
      "output label"
    ) as HTMLCollectionOf<HTMLElement>
  );
  const line = document.getElementById("line");

  document.getElementById("run").addEventListener("click", function () {
    const program = (
      document.getElementById("user-code") as HTMLTextAreaElement
    ).value;

    // reset output so it can be printed to - generatedCodeBox is dealt with separately
    output.innerHTML = "";

    run(program, { importObject })
      .then((r) => {
        line.hidden = false;
        generatedCodeLabels.forEach((label) => (label.hidden = false));
        generatedCodeBox.innerText = r.source;
        output.textContent += `Final return value: ${r.ans}`;
        output.setAttribute("style", "color:black");
        console.log("run finished");
      })
      .catch((e) => {
        line.hidden = true;
        generatedCodeLabels.forEach((label) => (label.hidden = true));
        generatedCodeBox.innerHTML = "";
        output.textContent = String(e);
        output.setAttribute("style", "color:red");
        console.log("run failed", e);
      });
  });
});
