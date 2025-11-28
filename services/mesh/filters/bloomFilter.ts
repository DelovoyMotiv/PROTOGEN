/**
 * Scalable Bloom Filter Implementation
 * 
 * Production-grade probabilistic data structure for membership testing.
 * Uses SHA-256 based hashing with configurable false positive rate.
 * Implements scalable bloom filter with automatic segment creation.
 * 
 * Mathematical foundation:
 * - Optimal bit array size: m = -n * ln(p) / (ln(2)^2)
 * - Optimal hash functions: k = (m/n) * ln(2)
 * Where n = expected elements, p = false positive rate
 * 
 * For p=0.01 (1%), k≈7 hash functions
 */

import * as crypto from 'crypto';
import { IScalableBloomFilter } from './interfaces';

export class BloomFilter implements IScalableBloomFilter {
  private segments: BloomFilterSegment[];
  private readonly targetFalsePositiveRate: number;
  private readonly elementsPerSegment: number;
  private currentSegment: BloomFilterSegment;
  private totalElements: number;

  constructor(
    expectedElements: number = 1000,
    falsePositiveRate: number = 0.01
  ) {
    if (falsePositiveRate <= 0 || falsePositiveRate >= 1) {
      throw new Error('False positive rate must be between 0 and 1');
    }
    if (expectedElements <= 0) {
      throw new Error('Expected elements must be positive');
    }

    this.targetFalsePositiveRate = falsePositiveRate;
    this.elementsPerSegment = expectedElements;
    this.totalElements = 0;
    this.segments = [];
    
    // Create initial segment
    this.currentSegment = new BloomFilterSegment(
      expectedElements,
      falsePositiveRate
    );
    this.segments.push(this.currentSegment);
  }

  /**
   * Add hash to bloom filter
   * Automatically creates new segment if current is full
   */
  public add(hash: string): void {
    if (!this.isValidHash(hash)) {
      throw new Error('Invalid hash format. Expected 64-character hex string');
    }

    if (this.needsNewSegment()) {
      this.createSegment();
    }

    this.currentSegment.add(hash);
    this.totalElements++;
  }

  /**
   * Check if hash might be in filter
   * Returns true if hash might exist (with false positive rate)
   * Returns false if hash definitely does not exist
   */
  public has(hash: string): boolean {
    if (!this.isValidHash(hash)) {
      return false;
    }

    // Check all segments (hash could be in any segment)
    for (const segment of this.segments) {
      if (segment.has(hash)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Serialize all segments to binary format
   */
  public serialize(): Uint8Array {
    // Format: [segment_count: 4 bytes][segment1_size: 4 bytes][segment1_data][segment2_size: 4 bytes][segment2_data]...
    const buffers: Buffer[] = [];
    
    // Write segment count
    const countBuffer = Buffer.allocUnsafe(4);
    countBuffer.writeUInt32BE(this.segments.length, 0);
    buffers.push(countBuffer);

    // Write each segment
    for (const segment of this.segments) {
      const segmentData = segment.serialize();
      const sizeBuffer = Buffer.allocUnsafe(4);
      sizeBuffer.writeUInt32BE(segmentData.length, 0);
      buffers.push(sizeBuffer);
      buffers.push(Buffer.from(segmentData));
    }

    return new Uint8Array(Buffer.concat(buffers));
  }

  /**
   * Deserialize from binary format
   */
  public static deserialize(data: Uint8Array): BloomFilter {
    const buffer = Buffer.from(data);
    let offset = 0;

    // Read segment count
    const segmentCount = buffer.readUInt32BE(offset);
    offset += 4;

    if (segmentCount === 0) {
      throw new Error('Invalid serialized data: no segments');
    }

    // Create filter with first segment's parameters
    const firstSegmentSize = buffer.readUInt32BE(offset);
    offset += 4;
    const firstSegmentData = new Uint8Array(buffer.subarray(offset, offset + firstSegmentSize));
    offset += firstSegmentSize;

    const firstSegment = BloomFilterSegment.deserialize(firstSegmentData);
    const filter = new BloomFilter(firstSegment.capacity, firstSegment.targetFPR);
    filter.segments[0] = firstSegment;
    filter.currentSegment = firstSegment;

    // Read remaining segments
    for (let i = 1; i < segmentCount; i++) {
      const segmentSize = buffer.readUInt32BE(offset);
      offset += 4;
      const segmentData = new Uint8Array(buffer.subarray(offset, offset + segmentSize));
      offset += segmentSize;

      const segment = BloomFilterSegment.deserialize(segmentData);
      filter.segments.push(segment);
      filter.currentSegment = segment;
    }

    // Recalculate total elements
    filter.totalElements = filter.segments.reduce((sum, seg) => sum + seg.count(), 0);

    return filter;
  }

  /**
   * Get current size in bytes
   */
  public size(): number {
    return this.segments.reduce((sum, segment) => sum + segment.size(), 0);
  }

  /**
   * Get number of elements added
   */
  public count(): number {
    return this.totalElements;
  }

  /**
   * Get measured false positive rate
   */
  public getFalsePositiveRate(): number {
    // Weighted average of segment FPRs
    if (this.segments.length === 0) return 0;
    
    const totalWeight = this.segments.reduce((sum, seg) => sum + seg.count(), 0);
    if (totalWeight === 0) return 0;

    const weightedSum = this.segments.reduce(
      (sum, seg) => sum + seg.getFalsePositiveRate() * seg.count(),
      0
    );

    return weightedSum / totalWeight;
  }

  /**
   * Clear all elements
   */
  public clear(): void {
    this.segments = [];
    this.currentSegment = new BloomFilterSegment(
      this.elementsPerSegment,
      this.targetFalsePositiveRate
    );
    this.segments.push(this.currentSegment);
    this.totalElements = 0;
  }

  /**
   * Check if new segment needed
   */
  public needsNewSegment(): boolean {
    return this.currentSegment.count() >= this.elementsPerSegment;
  }

  /**
   * Create new segment
   */
  public createSegment(): void {
    this.currentSegment = new BloomFilterSegment(
      this.elementsPerSegment,
      this.targetFalsePositiveRate
    );
    this.segments.push(this.currentSegment);
  }

  /**
   * Get number of segments
   */
  public segmentCount(): number {
    return this.segments.length;
  }

  /**
   * Validate hash format (64-character hex string)
   */
  private isValidHash(hash: string): boolean {
    return /^[0-9a-f]{64}$/i.test(hash);
  }
}

/**
 * Single Bloom Filter Segment
 * Implements standard bloom filter with optimal parameters
 */
class BloomFilterSegment {
  private bitArray: Uint8Array;
  private readonly numBits: number;
  private readonly numHashFunctions: number;
  public readonly capacity: number;
  public readonly targetFPR: number;
  private elementCount: number;

  constructor(expectedElements: number, falsePositiveRate: number) {
    this.capacity = expectedElements;
    this.targetFPR = falsePositiveRate;
    this.elementCount = 0;

    // Calculate optimal bit array size
    // m = -n * ln(p) / (ln(2)^2)
    this.numBits = Math.ceil(
      (-expectedElements * Math.log(falsePositiveRate)) / (Math.LN2 * Math.LN2)
    );

    // Calculate optimal number of hash functions
    // k = (m/n) * ln(2)
    this.numHashFunctions = Math.max(
      1,
      Math.round((this.numBits / expectedElements) * Math.LN2)
    );

    // Allocate bit array (round up to nearest byte)
    const numBytes = Math.ceil(this.numBits / 8);
    this.bitArray = new Uint8Array(numBytes);
  }

  public add(hash: string): void {
    const indices = this.getHashIndices(hash);
    for (const index of indices) {
      this.setBit(index);
    }
    this.elementCount++;
  }

  public has(hash: string): boolean {
    const indices = this.getHashIndices(hash);
    for (const index of indices) {
      if (!this.getBit(index)) {
        return false;
      }
    }
    return true;
  }

  public serialize(): Uint8Array {
    // Format: [numBits: 4 bytes][numHashFunctions: 4 bytes][elementCount: 4 bytes][bitArray]
    const header = Buffer.allocUnsafe(12);
    header.writeUInt32BE(this.numBits, 0);
    header.writeUInt32BE(this.numHashFunctions, 4);
    header.writeUInt32BE(this.elementCount, 8);

    return new Uint8Array(Buffer.concat([header, Buffer.from(this.bitArray)]));
  }

  public static deserialize(data: Uint8Array): BloomFilterSegment {
    const buffer = Buffer.from(data);
    
    const numBits = buffer.readUInt32BE(0);
    const numHashFunctions = buffer.readUInt32BE(4);
    const elementCount = buffer.readUInt32BE(8);
    const bitArray = new Uint8Array(buffer.subarray(12));

    // Reconstruct segment
    const expectedElements = Math.ceil(numBits / (numHashFunctions / Math.LN2));
    const falsePositiveRate = Math.exp(
      -(numBits * Math.LN2 * Math.LN2) / expectedElements
    );

    const segment = new BloomFilterSegment(expectedElements, falsePositiveRate);
    segment.bitArray = bitArray;
    segment.elementCount = elementCount;

    return segment;
  }

  public size(): number {
    return this.bitArray.length + 12; // bit array + header
  }

  public count(): number {
    return this.elementCount;
  }

  public getFalsePositiveRate(): number {
    // Actual FPR based on current fill ratio
    // p = (1 - e^(-kn/m))^k
    const fillRatio = this.elementCount / this.capacity;
    const exponent = -this.numHashFunctions * fillRatio;
    return Math.pow(1 - Math.exp(exponent), this.numHashFunctions);
  }

  /**
   * Generate k hash indices using SHA-256
   * Uses double hashing technique: h_i(x) = h1(x) + i * h2(x)
   */
  private getHashIndices(hash: string): number[] {
    // Use first 32 bytes of hash as seed for h1
    const h1 = this.hashToNumber(hash.substring(0, 32));
    // Use last 32 bytes of hash as seed for h2
    const h2 = this.hashToNumber(hash.substring(32, 64));

    const indices: number[] = [];
    for (let i = 0; i < this.numHashFunctions; i++) {
      // Double hashing: h_i(x) = (h1 + i * h2) mod m
      const index = (h1 + i * h2) % this.numBits;
      indices.push(Math.abs(index));
    }

    return indices;
  }

  /**
   * Convert hex string to number using SHA-256
   */
  private hashToNumber(hexString: string): number {
    const hash = crypto.createHash('sha256').update(hexString, 'hex').digest();
    // Use first 8 bytes as 64-bit number
    const bigIntValue = hash.readBigUInt64BE(0) % BigInt(this.numBits);
    return Number(bigIntValue);
  }

  /**
   * Set bit at index
   */
  private setBit(index: number): void {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    this.bitArray[byteIndex] |= 1 << bitIndex;
  }

  /**
   * Get bit at index
   */
  private getBit(index: number): boolean {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    return (this.bitArray[byteIndex] & (1 << bitIndex)) !== 0;
  }
}

// Export singleton factory
export function createBloomFilter(
  expectedElements: number = 1000,
  falsePositiveRate: number = 0.01
): BloomFilter {
  return new BloomFilter(expectedElements, falsePositiveRate);
}
