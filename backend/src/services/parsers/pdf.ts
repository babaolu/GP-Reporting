import pdfParse from 'pdf-parse';

/**
 * Extracts plain text from a PDF file buffer.
 * @param buffer The PDF file buffer
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    console.error('Error parsing PDF document:', err);
    throw new Error('Failed to parse PDF document. It might be corrupted or password protected.');
  }
}
