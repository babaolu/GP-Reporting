import mammoth from 'mammoth';

/**
 * Extracts plain text from a DOCX file buffer.
 * @param buffer The DOCX file buffer
 */
export async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (err) {
    console.error('Error parsing DOCX document:', err);
    throw new Error('Failed to parse DOCX document. It might be corrupted.');
  }
}
