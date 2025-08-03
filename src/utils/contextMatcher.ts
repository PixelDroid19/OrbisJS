import type { ToolbarContext } from '../components/FloatingToolbar';
import type { ToolbarContextFilter, ContextMatcher } from '../types/toolbar';

export class ToolbarContextMatcher implements ContextMatcher {
  /**
   * Checks if a toolbar context matches the given filter
   */
  matches(context: ToolbarContext, filter: ToolbarContextFilter): boolean {
    // File type matching
    if (filter.fileType && filter.fileType !== context.fileType) {
      return false;
    }

    // Selection state matching
    if (filter.hasSelection !== undefined && filter.hasSelection !== context.hasSelection) {
      return false;
    }

    // Read-only state matching
    if (filter.isReadOnly !== undefined && filter.isReadOnly !== context.isReadOnly) {
      return false;
    }

    // Line count range matching
    if (filter.lineCountRange) {
      const { min, max } = filter.lineCountRange;
      if (min !== undefined && context.lineCount < min) {
        return false;
      }
      if (max !== undefined && context.lineCount > max) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculates a match score for prioritizing configurations
   * Higher scores indicate better matches
   */
  getMatchScore(context: ToolbarContext, filter: ToolbarContextFilter): number {
    if (!this.matches(context, filter)) {
      return 0;
    }

    let score = 1; // Base score for any match

    // More specific matches get higher scores
    if (filter.fileType) {
      score += 10; // File type is highly specific
    }

    if (filter.hasSelection !== undefined) {
      score += 5; // Selection state is moderately specific
    }

    if (filter.isReadOnly !== undefined) {
      score += 3; // Read-only state is less specific
    }

    if (filter.lineCountRange) {
      score += 2; // Line count range is least specific
      
      // Bonus for exact range matches
      const { min, max } = filter.lineCountRange;
      if (min !== undefined && max !== undefined) {
        const rangeSize = max - min;
        if (rangeSize <= 10) {
          score += 3; // Very specific range
        } else if (rangeSize <= 100) {
          score += 1; // Moderately specific range
        }
      }
    }

    return score;
  }

  /**
   * Finds the best matching configuration from a list
   */
  findBestMatch<T extends { context: ToolbarContextFilter }>(
    context: ToolbarContext,
    candidates: T[]
  ): T | null {
    let bestMatch: T | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = this.getMatchScore(context, candidate.context);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    return bestMatch;
  }
}

export const contextMatcher = new ToolbarContextMatcher();