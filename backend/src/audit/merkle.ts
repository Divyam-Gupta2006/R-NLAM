/**
 * Merkle trees over audit-entry hashes, in the RFC 6962 (Certificate
 * Transparency) shape: leaf = SHA-256(0x00 ‖ data), node = SHA-256(0x01 ‖ L ‖ R),
 * split at the largest power of two below n. Domain separation means a leaf
 * can never be passed off as an internal node.
 *
 * Leaves are the audit entries' own chain hashes (hex), taken as bytes.
 */
import * as crypto from 'crypto';

const sha = (...parts: Buffer[]) => crypto.createHash('sha256').update(Buffer.concat(parts)).digest();

export function leafHash(entryHashHex: string): Buffer {
  return sha(Buffer.from([0x00]), Buffer.from(entryHashHex, 'hex'));
}

export function nodeHash(left: Buffer, right: Buffer): Buffer {
  return sha(Buffer.from([0x01]), left, right);
}

function largestPow2Below(n: number): number {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

function mth(leaves: Buffer[]): Buffer {
  if (leaves.length === 0) return sha(Buffer.alloc(0));
  if (leaves.length === 1) return leaves[0];
  const k = largestPow2Below(leaves.length);
  return nodeHash(mth(leaves.slice(0, k)), mth(leaves.slice(k)));
}

/** Merkle root (hex) of the given entry hashes, in order. */
export function merkleRoot(entryHashes: string[]): string {
  return mth(entryHashes.map(leafHash)).toString('hex');
}

/** RFC 6962 audit path for leaf `index`: sibling hashes from the leaf up. */
export function inclusionProof(entryHashes: string[], index: number): string[] {
  if (index < 0 || index >= entryHashes.length) throw new RangeError('index out of range');
  const path = (leaves: Buffer[], m: number): Buffer[] => {
    if (leaves.length <= 1) return [];
    const k = largestPow2Below(leaves.length);
    return m < k ? [...path(leaves.slice(0, k), m), mth(leaves.slice(k))] : [...path(leaves.slice(k), m - k), mth(leaves.slice(0, k))];
  };
  return path(entryHashes.map(leafHash), index).map((b) => b.toString('hex'));
}

/**
 * Verify an inclusion proof (RFC 9162 §2.1.3.2): recompute the root from the
 * entry hash, its index, the tree size and the audit path.
 */
export function verifyInclusion(entryHashHex: string, index: number, treeSize: number, path: string[], rootHex: string): boolean {
  if (index >= treeSize) return false;
  let fn = index;
  let sn = treeSize - 1;
  let r = leafHash(entryHashHex);
  for (const p of path) {
    const sib = Buffer.from(p, 'hex');
    if (sn === 0) return false;
    if (fn % 2 === 1 || fn === sn) {
      r = nodeHash(sib, r);
      if (fn % 2 === 0) {
        while (fn % 2 === 0 && fn !== 0) {
          fn >>= 1;
          sn >>= 1;
        }
      }
    } else {
      r = nodeHash(r, sib);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && r.toString('hex') === rootHex;
}

/** Roots are chained too: chainHash_n = SHA-256(chainHash_{n-1} ‖ root_n). */
export function chainRoot(prevChainHex: string, rootHex: string): string {
  return sha(Buffer.from(prevChainHex, 'hex'), Buffer.from(rootHex, 'hex')).toString('hex');
}
