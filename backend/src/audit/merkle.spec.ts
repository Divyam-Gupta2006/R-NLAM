import * as crypto from 'crypto';
import { inclusionProof, leafHash, merkleRoot, nodeHash, verifyInclusion } from './merkle';

const h = (i: number) => crypto.createHash('sha256').update(`entry-${i}`).digest('hex');
const hashes = (n: number) => Array.from({ length: n }, (_, i) => h(i));

describe('Merkle (RFC 6962 shape)', () => {
  it('one leaf: the root is the leaf hash', () => {
    expect(merkleRoot([h(0)])).toBe(leafHash(h(0)).toString('hex'));
  });

  it('two leaves: root = node(leaf0, leaf1)', () => {
    expect(merkleRoot([h(0), h(1)])).toBe(nodeHash(leafHash(h(0)), leafHash(h(1))).toString('hex'));
  });

  it('three leaves split 2 + 1 (largest power of two below n)', () => {
    const expected = nodeHash(nodeHash(leafHash(h(0)), leafHash(h(1))), leafHash(h(2))).toString('hex');
    expect(merkleRoot(hashes(3))).toBe(expected);
  });

  it.each([1, 2, 3, 5, 7, 8, 13, 100, 257])('every leaf of a %s-leaf tree has a valid inclusion proof', (n) => {
    const hs = hashes(n);
    const root = merkleRoot(hs);
    for (let i = 0; i < n; i++) {
      expect(verifyInclusion(hs[i], i, n, inclusionProof(hs, i), root)).toBe(true);
    }
  });

  it('a proof fails for a different entry, index or root', () => {
    const hs = hashes(13);
    const root = merkleRoot(hs);
    const proof = inclusionProof(hs, 6);
    expect(verifyInclusion(h(99), 6, 13, proof, root)).toBe(false);
    expect(verifyInclusion(hs[6], 7, 13, proof, root)).toBe(false);
    expect(verifyInclusion(hs[6], 6, 13, proof, merkleRoot(hashes(12)))).toBe(false);
  });

  it('changing any one entry changes the root', () => {
    const hs = hashes(50);
    const root = merkleRoot(hs);
    const altered = [...hs];
    altered[31] = h(1000);
    expect(merkleRoot(altered)).not.toBe(root);
  });

  it('a proof is logarithmic in size', () => {
    expect(inclusionProof(hashes(1000), 500).length).toBeLessThanOrEqual(10);
  });
});
