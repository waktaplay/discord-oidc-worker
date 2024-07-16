export interface IAlgorithmBase {
  name: string;
  hash: {
    name: string;
  };
}

export interface IAlgorithm extends IAlgorithmBase {
  modulusLength: number;
  publicExponent: Uint8Array;
}
