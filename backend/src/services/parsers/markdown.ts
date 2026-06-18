/**
 * Converts a Markdown file buffer to plain text.
 * @param buffer The file buffer
 */
export async function parseMarkdown(buffer: Buffer): Promise<string> {
  try {
    return buffer.toString('utf8');
  } catch (err) {
    console.error('Error parsing Markdown document:', err);
    throw new Error('Failed to read Markdown file. Invalid text encoding.');
  }
}
