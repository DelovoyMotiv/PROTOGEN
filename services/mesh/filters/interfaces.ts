/**
 * Bloom Filter Interfaces
 */

export interface IBloomFilter {
  /**
   * Add hash to bloom filter
   */
  add(hash: string): void;

  /**
   * Check if hash might be in filter
   */
  has(hash: string): boolean;

  /**
   * Serialize filter to binary
   */
  serialize(): Uint8Array;

  /**
   * Get current size in bytes
   */
  size(): number;

  /**
   * Get number of elements added
   */
  count(): number;

  /**
   * Get false positive rate
   */
  getFalsePositiveRate(): number;

  /**
   * Clear all elements
   */
  clear(): void;
}

export interface IScalableBloomFilter extends IBloomFilter {
  /**
   * Check if new segment needed
   */
  needsNewSegment(): boolean;

  /**
   * Create new segment
   */
  createSegment(): void;

  /**
   * Get number of segments
   */
  segmentCount(): number;
}
