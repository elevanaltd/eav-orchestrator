// EAV Orchestrator Content Processor Library
// Critical Path Item 2 - Browser-compatible TipTap content processing

// Critical-Engineer: consulted for final architecture validation (leader election, transactional edge function)

/**
 * Browser-Compatible TipTap Content Processing Service
 * 
 * Provides deterministic projections from TipTap JSON to plain text
 * with semantic hashing for change detection and content validation.
 * 
 * CRITICAL CHANGES FROM REFERENCE-OLD:
 * - Replaced Node.js crypto with browser SubtleCrypto (async)
 * - Fixed semantic hashing to include full TipTap JSON structure 
 * - Optimized for collaborative editing with Yjs integration
 * - Zero external dependencies beyond @tiptap/core
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ContentProcessorResult {
  plainText: string
  semanticHash: string
  wordCount: number
  characterCount: number
  estimatedDuration: number // seconds
  validationErrors: string[]
}

export interface TipTapValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface ContentDiff {
  hasChanges: boolean
  oldHash: string
  newHash: string
  oldWordCount: number
  newWordCount: number
  wordCountDelta: number
}

// TipTap JSONContent interface (minimal definition for zero dependencies)
export interface JSONContent {
  type?: string
  content?: JSONContent[]
  text?: string
  attrs?: Record<string, unknown>
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

// ============================================================================
// CONTENT VALIDATION
// ============================================================================

export function validateTipTapContent(content: unknown): TipTapValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if content is valid JSON
  if (!content || typeof content !== 'object') {
    errors.push('Content must be a valid JSON object')
    return { isValid: false, errors, warnings }
  }

  const jsonContent = content as JSONContent

  // Validate required TipTap document structure
  if (jsonContent.type !== 'doc') {
    errors.push('Root element must be of type "doc"')
  }

  if (!Array.isArray(jsonContent.content)) {
    errors.push('Document must have a content array')
  }

  // Check for empty content
  if (!jsonContent.content || jsonContent.content.length === 0) {
    warnings.push('Document has no content')
  }

  // Validate content nodes
  if (jsonContent.content) {
    for (let i = 0; i < jsonContent.content.length; i++) {
      const node = jsonContent.content[i]
      if (!node || !node.type) {
        errors.push(`Content node at index ${i} missing type`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// ============================================================================
// DETERMINISTIC TEXT EXTRACTION
// ============================================================================

/**
 * Extract plain text from TipTap JSON content deterministically
 * 
 * CRITICAL: This function must produce identical output for identical input
 * across all environments to support optimistic locking and content comparison.
 */
export function extractPlainText(content: JSONContent): string {
  if (!content) {
    return ''
  }

  let text = ''

  // Handle text nodes
  if (content.type === 'text') {
    return content.text || ''
  }

  // Handle hard breaks (inline elements that produce newlines)
  if (content.type === 'hardBreak') {
    return '\n'
  }

  // Handle content arrays recursively
  if (content.content && Array.isArray(content.content)) {
    for (const child of content.content) {
      const childText = extractPlainText(child)
      text += childText
    }
  }

  // Add appropriate spacing for content-bearing blocks only
  if (isContentBlock(content.type)) {
    text += '\n'
  }

  return text
}

/**
 * Determine if a TipTap node type should generate content spacing
 * 
 * Structural elements (lists, list items) don't generate spacing
 * Content elements (paragraphs, headings) do generate spacing
 */
function isContentBlock(nodeType?: string): boolean {
  const contentBlocks = [
    'paragraph',
    'heading', 
    'blockquote',
    'codeBlock',
    'horizontalRule'
    // Note: bulletList, orderedList, listItem are structural, not content
  ]
  
  return contentBlocks.includes(nodeType || '')
}

// ============================================================================
// CONTENT CANONICALIZATION
// ============================================================================

/**
 * Normalize text content for consistent hashing
 * 
 * - Trims whitespace
 * - Collapses multiple spaces
 * - Normalizes Unicode (NFKC)
 * - Preserves paragraph boundaries for 1:1 VO/scene mapping
 */
export function canonicalizeText(text: string): string {
  return text
    .normalize('NFKC')              // Unicode normalization
    .replace(/\r\n/g, '\n')         // Normalize line endings
    .replace(/[ \t]+/g, ' ')        // Collapse horizontal whitespace ONLY (preserve newlines)
    .replace(/\n{3,}/g, '\n\n')     // Max 2 consecutive newlines (paragraph boundary)
    .replace(/[ \t]+\n/g, '\n')     // Strip trailing spaces
    .replace(/\n[ \t]+/g, '\n')     // Strip leading spaces after newline
    .trim()                         // Remove leading/trailing whitespace
}

/**
 * Create canonical representation of TipTap JSON for structural hashing
 * 
 * CRITICAL FIX: Hash the full document structure, not just text content
 * This ensures formatting changes are detected for proper collaboration
 */
function canonicalizeJSON(content: JSONContent): string {
  // Sort object keys to ensure consistent serialization
  const sortKeys = (obj: unknown): unknown => {
    if (Array.isArray(obj)) {
      return obj.map(sortKeys)
    } else if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj as Record<string, unknown>)
        .sort()
        .reduce((result: Record<string, unknown>, key) => {
          result[key] = sortKeys((obj as Record<string, unknown>)[key])
          return result
        }, {})
    }
    return obj
  }

  return JSON.stringify(sortKeys(content))
}

/**
 * Generate semantic hash from canonical TipTap JSON structure
 * 
 * BROWSER-COMPATIBLE: Uses SubtleCrypto instead of Node.js crypto
 * CRITICAL FIX: Hashes full JSON structure to detect formatting changes
 */
export async function generateSemanticHash(content: string | JSONContent): Promise<string> {
  let canonical: string
  
  if (typeof content === 'string') {
    canonical = canonicalizeText(content)
  } else {
    canonical = canonicalizeJSON(content)
  }

  // Browser-compatible SHA-256 using SubtleCrypto
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  
  // Convert buffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================================
// CONTENT ANALYSIS
// ============================================================================

/**
 * Calculate word count from text
 */
export function calculateWordCount(text: string): number {
  const canonical = canonicalizeText(text)
  if (!canonical) return 0
  
  return canonical.split(/\s+/).length
}

/**
 * Estimate duration in seconds based on word count
 * 
 * Based on average speaking pace of 150-160 words per minute
 * for instructional content (slightly slower than conversational)
 */
export function estimateDuration(wordCount: number): number {
  const wordsPerMinute = 155 // Conservative estimate for instructional content
  const durationMinutes = wordCount / wordsPerMinute
  return Math.round(durationMinutes * 60) // Convert to seconds
}

// ============================================================================
// MAIN PROCESSOR FUNCTION
// ============================================================================

/**
 * Process TipTap content into all required formats
 * 
 * This is the main function that components should use for content processing.
 * It provides all derived data needed for the script component system.
 */
export async function processTipTapContent(content: JSONContent): Promise<ContentProcessorResult> {
  const validationErrors: string[] = []

  // Validate content structure
  const validation = validateTipTapContent(content)
  if (!validation.isValid) {
    validationErrors.push(...validation.errors)
  }

  // Extract and process text
  const rawText = extractPlainText(content)
  const plainText = canonicalizeText(rawText)
  
  // Generate derived data
  const semanticHash = await generateSemanticHash(content) // Hash full JSON structure
  const wordCount = calculateWordCount(plainText)
  const characterCount = plainText.length
  const estimatedDuration = estimateDuration(wordCount)

  return {
    plainText,
    semanticHash,
    wordCount,
    characterCount,
    estimatedDuration,
    validationErrors
  }
}

// ============================================================================
// CONTENT COMPARISON
// ============================================================================

/**
 * Compare two TipTap documents for content changes
 * 
 * Returns true if the semantic content has changed
 * (including both text and structure changes)
 */
export async function hasContentChanged(
  oldContent: JSONContent,
  newContent: JSONContent
): Promise<boolean> {
  const oldHash = await generateSemanticHash(oldContent)
  const newHash = await generateSemanticHash(newContent)
  
  return oldHash !== newHash
}

/**
 * Generate diff information between two content versions
 * 
 * Useful for conflict resolution and audit trails
 */
export async function generateContentDiff(
  oldContent: JSONContent,
  newContent: JSONContent
): Promise<ContentDiff> {
  const oldProcessed = await processTipTapContent(oldContent)
  const newProcessed = await processTipTapContent(newContent)
  
  return {
    hasChanges: oldProcessed.semanticHash !== newProcessed.semanticHash,
    oldHash: oldProcessed.semanticHash,
    newHash: newProcessed.semanticHash,
    oldWordCount: oldProcessed.wordCount,
    newWordCount: newProcessed.wordCount,
    wordCountDelta: newProcessed.wordCount - oldProcessed.wordCount
  }
}

// ============================================================================
// EXPORT DEFAULT PROCESSOR
// ============================================================================

export default {
  processTipTapContent,
  validateTipTapContent,
  extractPlainText,
  canonicalizeText,
  generateSemanticHash,
  hasContentChanged,
  generateContentDiff,
  calculateWordCount,
  estimateDuration
}