import PDFDocument from 'pdfkit';

/**
 * Generates a styled PDF report bundle for a given month.
 * @param churchName The name of the church
 * @param monthLabel The formatted month label (e.g. 'June 2026')
 * @param unitsData Array of unit reports and details
 * @param crossUnitSummary Cross-unit insights object
 */
export async function generateMonthlyPDF(
  churchName: string,
  monthLabel: string,
  unitsData: any[],
  crossUnitSummary: any
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // ==========================================
      // 1. COVER PAGE
      // ==========================================
      doc.moveDown(4);
      doc.fontSize(30).font('Helvetica-Bold').fillColor('#1E1B4B').text(churchName, { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(22).font('Helvetica').fillColor('#3730A3').text('Monthly Reports Bundle', { align: 'center' });
      doc.fontSize(18).text(monthLabel, { align: 'center' });
      
      // Accent bar
      doc.moveDown(1);
      doc.rect(100, doc.y, 400, 3).fill('#D97706');
      
      doc.moveDown(8);
      doc.fontSize(12).font('Helvetica').fillColor('#6B7280').text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.text('Confidential — For Internal Church Administration Use Only', { align: 'center' });

      // ==========================================
      // 2. TABLE OF CONTENTS
      // ==========================================
      doc.addPage();
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#1E1B4B').text('Table of Contents');
      doc.moveDown(1.5);
      
      let pageCounter = 3;
      doc.fontSize(12).font('Helvetica').fillColor('#1E1B4B');
      doc.text(`1. Cross-Unit Executive Summary .............................................................. Page 2`);
      
      unitsData.forEach((unit, idx) => {
        const dotLeader = '.'.repeat(70 - unit.name.length);
        doc.text(`${idx + 2}. ${unit.name} Department Report ${dotLeader} Page ${pageCounter}`);
        pageCounter += 1;
      });

      // ==========================================
      // 3. CROSS-UNIT SUMMARY
      // ==========================================
      doc.addPage();
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#1E1B4B').text('Cross-Unit Executive Summary');
      doc.moveDown(1);

      if (crossUnitSummary) {
        // Overall Summary
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#3730A3').text('Overall Summary');
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica').fillColor('#1E1B4B').text(crossUnitSummary.overall_summary || 'No summary text available.', { align: 'justify' });
        doc.moveDown(1.5);

        // Common Breakthroughs
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#16A34A').text('Common Breakthroughs');
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica').fillColor('#1E1B4B');
        if (crossUnitSummary.common_breakthroughs && crossUnitSummary.common_breakthroughs.length > 0) {
          crossUnitSummary.common_breakthroughs.forEach((item: string) => {
            doc.text(`• ${item}`);
          });
        } else {
          doc.text('No common breakthroughs noted.');
        }
        doc.moveDown(1.5);

        // Common Issues
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#D97706').text('Common Issues & Challenges');
        doc.moveDown(0.3);
        if (crossUnitSummary.common_issues && crossUnitSummary.common_issues.length > 0) {
          crossUnitSummary.common_issues.forEach((item: string) => {
            doc.text(`• ${item}`);
          });
        } else {
          doc.text('No repeating department issues noted.');
        }
        doc.moveDown(1.5);

        // Critical Alerts
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#DC2626').text('Critical Alerts');
        doc.moveDown(0.3);
        if (crossUnitSummary.critical_alerts && crossUnitSummary.critical_alerts.length > 0) {
          crossUnitSummary.critical_alerts.forEach((item: string) => {
            doc.text(`⚠ ${item}`);
          });
        } else {
          doc.text('No urgent critical alerts reported.');
        }
      } else {
        doc.fontSize(12).font('Helvetica-Oblique').text('No cross-unit summaries generated for this month.');
      }

      // ==========================================
      // 4. UNIT-BY-UNIT REPORTS
      // ==========================================
      unitsData.forEach(unit => {
        doc.addPage();
        
        // Header
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#3730A3').text(unit.name);
        doc.fontSize(11).font('Helvetica').fillColor('#6B7280').text(`Unit Head: ${unit.headName || 'Not Assigned'}  |  Status: ${unit.status}`);
        
        doc.moveDown(0.5);
        doc.rect(50, doc.y, 495, 1).fill('#E5E7EB');
        doc.moveDown(1.5);

        // Report Text
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E1B4B').text('Submitted Report Content');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').fillColor('#1E1B4B').text(unit.content || 'No report content submitted for this month.', { align: 'left' });
        doc.moveDown(2);

        // AI Summary
        if (unit.aiSummary) {
          doc.fontSize(14).font('Helvetica-Bold').fillColor('#3730A3').text('AI Generated Report Insights');
          doc.moveDown(0.5);

          doc.fontSize(11).font('Helvetica-Bold').fillColor('#1E1B4B').text('Overview Summary:');
          doc.fontSize(10).font('Helvetica').text(unit.aiSummary.summary || 'N/A');
          doc.moveDown(0.5);

          doc.fontSize(11).font('Helvetica-Bold').text('Achievements:');
          if (unit.aiSummary.breakthroughs && unit.aiSummary.breakthroughs.length > 0) {
            unit.aiSummary.breakthroughs.forEach((item: string) => doc.text(`- ${item}`));
          } else {
            doc.text('None.');
          }
          doc.moveDown(0.5);

          doc.fontSize(11).font('Helvetica-Bold').text('Challenges / Issues:');
          if (unit.aiSummary.issues && unit.aiSummary.issues.length > 0) {
            unit.aiSummary.issues.forEach((item: string) => doc.text(`- ${item}`));
          } else {
            doc.text('None.');
          }
          doc.moveDown(0.5);
        }

        // Admin Comments
        if (unit.comments && unit.comments.length > 0) {
          doc.moveDown(1.5);
          doc.fontSize(14).font('Helvetica-Bold').fillColor('#D97706').text('Admin Feedback');
          doc.moveDown(0.5);
          unit.comments.forEach((c: any) => {
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E1B4B').text(`${c.author}: `, { continued: true })
              .font('Helvetica-Oblique').fillColor('#6B7280').text(`(${new Date(c.createdAt).toLocaleDateString()})`)
              .font('Helvetica').fillColor('#1E1B4B').text(c.comment);
            doc.moveDown(0.5);
          });
        }
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
