// TDD FAILING TEST: Content Processor Library Integration
// Critical Path Item 2 - Zero dependencies browser-compatible implementation

// Context7: consulted for vitest
import { describe, it, expect, beforeEach } from 'vitest'
import { 
  processTipTapContent,
  validateTipTapContent,
  extractPlainText,
  canonicalizeText,
  generateSemanticHash,
  hasContentChanged,
  generateContentDiff,
  calculateWordCount,
  estimateDuration,
  type ContentProcessorResult,
  type TipTapValidationResult,
  type ContentDiff
} from '../../../src/lib/content/content-processor'

describe('Content Processor Library', () => {
  // Sample TipTap JSON content for testing
  const sampleTipTapDoc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello world! This is a test document.' }
        ]
      },
      {
        type: 'paragraph', 
        content: [
          { type: 'text', text: 'Second paragraph with more content.' }
        ]
      }
    ]
  }

  const emptyTipTapDoc = {
    type: 'doc',
    content: []
  }

  const formattedTipTapDoc = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Main Title' }]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'This is ' },
          { 
            type: 'text', 
            text: 'bold text', 
            marks: [{ type: 'bold' }] 
          },
          { type: 'text', text: ' with formatting.' }
        ]
      }
    ]
  }

  describe('validateTipTapContent', () => {
    it('should validate correct TipTap document structure', () => {
      const result: TipTapValidationResult = validateTipTapContent(sampleTipTapDoc)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid content structure', () => {
      const invalidDoc = { type: 'invalid', content: null }
      const result: TipTapValidationResult = validateTipTapContent(invalidDoc)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should warn about empty documents', () => {
      const result: TipTapValidationResult = validateTipTapContent(emptyTipTapDoc)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Document has no content')
    })
  })

  describe('extractPlainText', () => {
    it('should extract plain text from TipTap document', () => {
      const plainText = extractPlainText(sampleTipTapDoc)
      
      expect(plainText).toContain('Hello world! This is a test document.')
      expect(plainText).toContain('Second paragraph with more content.')
    })

    it('should handle empty documents', () => {
      const plainText = extractPlainText(emptyTipTapDoc)
      
      expect(plainText).toBe('')
    })

    it('should preserve structure for formatted content', () => {
      const plainText = extractPlainText(formattedTipTapDoc)
      
      expect(plainText).toContain('Main Title')
      expect(plainText).toContain('This is bold text with formatting.')
    })
  })

  describe('canonicalizeText', () => {
    it('should normalize whitespace and Unicode', () => {
      const messy = '  Hello   world!  \n\n\n  Second   line  \t\t '
      const clean = canonicalizeText(messy)
      
      expect(clean).toBe('Hello world!\n\nSecond line')
    })

    it('should preserve paragraph boundaries', () => {
      const text = 'First paragraph\n\nSecond paragraph\n\nThird paragraph'
      const canonical = canonicalizeText(text)
      
      expect(canonical).toBe('First paragraph\n\nSecond paragraph\n\nThird paragraph')
    })

    it('should handle Unicode normalization', () => {
      const unicode = 'café' // composed é
      const normalized = canonicalizeText(unicode)
      
      expect(normalized).toBe('café')
    })
  })

  describe('generateSemanticHash', () => {
    it('should generate consistent SHA-256 hash for same content', async () => {
      const text = 'Hello world!'
      const hash1 = await generateSemanticHash(text)
      const hash2 = await generateSemanticHash(text)
      
      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex format
    })

    it('should generate different hashes for different content', async () => {
      const text1 = 'Hello world!'
      const text2 = 'Hello world?'
      
      const hash1 = await generateSemanticHash(text1)
      const hash2 = await generateSemanticHash(text2)
      
      expect(hash1).not.toBe(hash2)
    })

    it('should generate same hash for canonically equivalent content', async () => {
      const text1 = '  Hello   world!  '
      const text2 = 'Hello world!'
      
      const hash1 = await generateSemanticHash(text1)
      const hash2 = await generateSemanticHash(text2)
      
      expect(hash1).toBe(hash2)
    })
  })

  describe('calculateWordCount', () => {
    it('should count words correctly', () => {
      const text = 'Hello world! This is a test.'
      const count = calculateWordCount(text)
      
      expect(count).toBe(6)
    })

    it('should handle empty text', () => {
      const count = calculateWordCount('')
      
      expect(count).toBe(0)
    })

    it('should handle multiple whitespace', () => {
      const text = 'Hello    world!   This   is   a   test.'
      const count = calculateWordCount(text)
      
      expect(count).toBe(6)
    })
  })

  describe('estimateDuration', () => {
    it('should estimate duration based on 155 WPM', () => {
      const wordCount = 155 // Should be 60 seconds
      const duration = estimateDuration(wordCount)
      
      expect(duration).toBe(60)
    })

    it('should handle zero words', () => {
      const duration = estimateDuration(0)
      
      expect(duration).toBe(0)
    })

    it('should round to nearest second', () => {
      const wordCount = 77 // Should be ~30 seconds (77/155 * 60 = 29.8)
      const duration = estimateDuration(wordCount)
      
      expect(duration).toBe(30)
    })
  })

  describe('processTipTapContent', () => {
    it('should process complete TipTap document', async () => {
      const result: ContentProcessorResult = await processTipTapContent(sampleTipTapDoc)
      
      expect(result.plainText).toContain('Hello world!')
      expect(result.semanticHash).toMatch(/^[a-f0-9]{64}$/)
      expect(result.wordCount).toBeGreaterThan(0)
      expect(result.characterCount).toBeGreaterThan(0)
      expect(result.estimatedDuration).toBeGreaterThan(0)
      expect(result.validationErrors).toHaveLength(0)
    })

    it('should handle validation errors', async () => {
      const invalidDoc = { type: 'invalid', content: null }
      const result: ContentProcessorResult = await processTipTapContent(invalidDoc as any)
      
      expect(result.validationErrors.length).toBeGreaterThan(0)
    })
  })

  describe('hasContentChanged', () => {
    it('should detect content changes', async () => {
      const doc1 = sampleTipTapDoc
      const doc2 = {
        ...sampleTipTapDoc,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Different content' }]
          }
        ]
      }
      
      const changed = await hasContentChanged(doc1, doc2)
      expect(changed).toBe(true)
    })

    it('should detect no changes for identical content', async () => {
      const changed = await hasContentChanged(sampleTipTapDoc, sampleTipTapDoc)
      expect(changed).toBe(false)
    })

    it('should detect formatting changes in document structure', async () => {
      const doc1 = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }]
          }
        ]
      }
      
      const doc2 = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Hello world' }]
          }
        ]
      }
      
      const changed = await hasContentChanged(doc1, doc2)
      expect(changed).toBe(true) // Structure change should be detected
    })
  })

  describe('generateContentDiff', () => {
    it('should generate diff information', async () => {
      const doc1 = sampleTipTapDoc
      const doc2 = {
        ...sampleTipTapDoc,
        content: [
          ...sampleTipTapDoc.content,
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Additional content.' }]
          }
        ]
      }
      
      const diff: ContentDiff = await generateContentDiff(doc1, doc2)
      
      expect(diff.hasChanges).toBe(true)
      expect(diff.oldHash).not.toBe(diff.newHash)
      expect(diff.newWordCount).toBeGreaterThan(diff.oldWordCount)
      expect(diff.wordCountDelta).toBeGreaterThan(0)
    })
  })
})