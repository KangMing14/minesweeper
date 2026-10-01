export interface Rng {
  next(): number;
  nextInt(maxExclusive: number): number;
}
