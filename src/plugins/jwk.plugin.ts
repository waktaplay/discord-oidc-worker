import {IAlgorithm, IAlgorithmBase} from '../types/algorithm';
import {IKeyPair} from '../types/keyPair';

export class JwtPlugin {
  declare algorithm: IAlgorithm;
  declare importAlgo: IAlgorithmBase;

  constructor() {
    this.algorithm = {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: {name: 'SHA-256'},
    };

    this.importAlgo = {
      name: 'RSASSA-PKCS1-v1_5',
      hash: {name: 'SHA-256'},
    };
  }

  async loadOrGenerateKeyPair(KV: KVNamespace) {
    let keyPair: CryptoKeyPair = {} as CryptoKeyPair;

    const keyPairJson = await KV.get<IKeyPair>('keys', {type: 'json'});

    if (keyPairJson !== null) {
      keyPair.publicKey = await crypto.subtle.importKey(
        'jwk',
        keyPairJson.publicKey,
        this.importAlgo,
        true,
        ['verify']
      );

      keyPair.privateKey = await crypto.subtle.importKey(
        'jwk',
        keyPairJson.privateKey,
        this.importAlgo,
        true,
        ['sign']
      );

      return keyPair;
    } else {
      keyPair = (await crypto.subtle.generateKey(this.algorithm, true, [
        'sign',
        'verify',
      ])) as CryptoKeyPair;

      await KV.put(
        'keys',
        JSON.stringify({
          privateKey: await crypto.subtle.exportKey('jwk', keyPair.privateKey),
          publicKey: await crypto.subtle.exportKey('jwk', keyPair.publicKey),
        })
      );

      return keyPair;
    }
  }
}
