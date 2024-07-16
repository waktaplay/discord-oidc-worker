export interface IKeyPair {
  publicKey: ArrayBuffer | JsonWebKey;
  privateKey: ArrayBuffer | JsonWebKey;
}
