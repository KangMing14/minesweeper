export type Action =
  | { readonly type: "reveal"; readonly x: number; readonly y: number }
  | { readonly type: "flag"; readonly x: number; readonly y: number }
  | { readonly type: "chord"; readonly x: number; readonly y: number };
