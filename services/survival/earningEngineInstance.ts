/**
 * Earning Engine Singleton Instance
 * Separate file to avoid Rollup tree-shaking issues
 */

import { EarningEngine } from './earningEngine';

export const earningEngine = new EarningEngine();
