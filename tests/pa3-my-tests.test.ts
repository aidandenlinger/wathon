import {
  assertPrint,
  assertFail,
  assertTCFail,
  assertTC,
} from "./asserts.test";
import { NUM, BOOL, NONE, CLASS } from "./helpers.test";

describe("basic class parsing", () => {
  it("works", () => {
    assertPrint("basic test", `print(1)`, ["1"]);
  });
});
