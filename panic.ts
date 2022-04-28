/**
 * Handler for WASM Runtime errors. When an error occurs, WASM will call this
 * function which will interpret the error code and return the necessary error.
 *
 * @param errorCode Error code returned from Wasm
 * @returns the error associated with the error code
 */
export function panic(errorCode: any): never {
  switch (errorCode) {
    case RuntimeErrors.OperationOnNone:
      throw new Error(`RUNTIME ERROR: Operation on None`);
  }
  throw new Error(`Unidentified error code`);
}

export enum RuntimeErrors {
  OperationOnNone,
}
