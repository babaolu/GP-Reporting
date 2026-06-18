import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { parsePDF } from '../services/parsers/pdf';
import { parseDOCX } from '../services/parsers/docx';
import { parseMarkdown } from '../services/parsers/markdown';

const router = Router();

// Require authentication for text parsing
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { fileUrl, fileType } = req.body;

  if (!fileUrl || !fileType) {
    return res.status(400).json({ error: 'fileUrl and fileType are required' });
  }

  try {
    // 1. Download file buffer from Supabase Storage
    // Extract the relative path in the bucket (e.g. from a full URL or storage path)
    let storagePath = fileUrl;
    if (fileUrl.includes('/storage/v1/object/public/reports/')) {
      storagePath = fileUrl.split('/storage/v1/object/public/reports/')[1];
    } else if (fileUrl.includes('reports/')) {
      storagePath = fileUrl.replace(/^reports\//, '');
    }

    const { data, error } = await supabaseAdmin.storage
      .from('reports')
      .download(storagePath);

    if (error || !data) {
      console.error('Failed to download file from Supabase Storage:', error);
      return res.status(400).json({
        error: "We couldn't read your file from storage. Please re-upload or paste your report into the text editor."
      });
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Parse text based on document type
    let extractedText = '';
    if (fileType === 'pdf') {
      extractedText = await parsePDF(buffer);
    } else if (fileType === 'docx') {
      extractedText = await parseDOCX(buffer);
    } else if (fileType === 'md') {
      extractedText = await parseMarkdown(buffer);
    } else if (fileType === 'text') {
      extractedText = buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Use pdf, docx, or md.' });
    }

    return res.status(200).json({
      message: 'Document parsed successfully',
      parsedText: extractedText
    });

  } catch (err: any) {
    console.error('Text extraction failed:', err);
    return res.status(500).json({
      error: "We couldn't read your file. Please re-upload or paste your report into the text editor."
    });
  }
});

export default router;
