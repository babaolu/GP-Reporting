import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { supabaseAdmin } from '../services/supabase';
import { generateMonthlyPDF } from '../services/export/pdf';
import { generateMonthlyDOCX } from '../services/export/docx';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const churchName = process.env.CHURCH_NAME || 'Grace Place';

// Protect routes for admins only
router.use(requireAuth);
router.use(requireAdmin);

/**
 * POST /api/export/monthly
 * Generates and uploads a PDF or DOCX monthly report bundle.
 * Returns download URL.
 */
router.post('/monthly', async (req: AuthenticatedRequest, res: Response) => {
  const { month, format } = req.body;

  if (!month || !format) {
    return res.status(400).json({ error: 'month and format (pdf or docx) are required' });
  }

  const fileFormat = format.toLowerCase();
  if (fileFormat !== 'pdf' && fileFormat !== 'docx') {
    return res.status(400).json({ error: 'format must be either pdf or docx' });
  }

  try {
    // 1. Fetch cross-unit monthly summary
    const { data: crossUnitSummary } = await supabaseAdmin
      .from('monthly_summaries')
      .select('*')
      .eq('month', month)
      .maybeSingle();

    // 2. Fetch all units in alphabetical order
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('*')
      .order('name', { ascending: true });

    if (unitsError || !units) {
      console.error('Error fetching units for export:', unitsError);
      return res.status(500).json({ error: 'Failed to retrieve units data' });
    }

    // 3. Compile report data for all units
    const unitsData: any[] = [];
    for (const unit of units) {
      // Get unit head profile
      const { data: headProfile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('unit_id', unit.id)
        .eq('role', 'unit_head')
        .maybeSingle();

      // Get latest report for this month
      const { data: report } = await supabaseAdmin
        .from('reports')
        .select('*')
        .eq('unit_id', unit.id)
        .eq('month', month)
        .eq('is_latest', true)
        .maybeSingle();

      let commentsData: any[] = [];
      if (report) {
        // Fetch comments for this report
        const { data: comments } = await supabaseAdmin
          .from('report_comments')
          .select('*, profiles(full_name)')
          .eq('report_id', report.id)
          .order('created_at', { ascending: true });

        if (comments) {
          commentsData = comments.map(c => ({
            author: c.profiles?.full_name || 'Admin',
            comment: c.comment,
            createdAt: c.created_at
          }));
        }
      }

      unitsData.push({
        name: unit.name,
        headName: headProfile?.full_name || null,
        status: unit.status,
        content: report ? (report.content_text || report.parsed_text || '') : null,
        aiSummary: report ? report.ai_summary : null,
        comments: commentsData
      });
    }

    // Format month year for title block (e.g. 'June 2026')
    const parts = month.split('-');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthLabel = `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0]}`;

    // 4. Generate document buffer
    let buffer: Buffer;
    let contentType = '';
    
    if (fileFormat === 'pdf') {
      buffer = await generateMonthlyPDF(churchName, monthLabel, unitsData, crossUnitSummary);
      contentType = 'application/pdf';
    } else {
      buffer = await generateMonthlyDOCX(churchName, monthLabel, unitsData, crossUnitSummary);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    // 5. Upload buffer to Supabase Storage bucket ('reports' bucket, 'exports' folder)
    const exportFileName = `exports/Monthly_Report_${month.replace(/-/g, '_')}_${Date.now()}.${fileFormat}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('reports')
      .upload(exportFileName, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Failed to upload export file to Supabase Storage:', uploadError);
      return res.status(500).json({ error: 'Failed to upload export document to storage' });
    }

    // Get signed URL or public URL
    // Public URL is perfect if the bucket is public, otherwise signed URL is needed.
    // Let's create a signed url with 1 hour expiration for security.
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from('reports')
      .createSignedUrl(exportFileName, 3600); // 1 hour

    if (signedError || !signedData?.signedUrl) {
      console.error('Failed to generate signed download URL:', signedError);
      return res.status(500).json({ error: 'Failed to generate download link' });
    }

    return res.status(200).json({
      message: 'Export bundle generated successfully',
      downloadUrl: signedData.signedUrl
    });

  } catch (err) {
    console.error('Unexpected error during monthly report export:', err);
    return res.status(500).json({ error: 'Internal Server Error during document generation' });
  }
});

export default router;
