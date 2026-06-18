import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

/**
 * Generates a styled DOCX report bundle for a given month.
 * @param churchName The name of the church
 * @param monthLabel The formatted month label (e.g. 'June 2026')
 * @param unitsData Array of unit reports and details
 * @param crossUnitSummary Cross-unit insights object
 */
export async function generateMonthlyDOCX(
  churchName: string,
  monthLabel: string,
  unitsData: any[],
  crossUnitSummary: any
): Promise<Buffer> {
  const children: any[] = [];

  // ==========================================
  // 1. COVER PAGE
  // ==========================================
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 300 },
      children: [
        new TextRun({
          text: churchName,
          bold: true,
          size: 56, // 28pt
          color: '1E1B4B'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
      children: [
        new TextRun({
          text: 'Monthly Reports Bundle',
          bold: true,
          size: 36, // 18pt
          color: '3730A3'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 3000 },
      children: [
        new TextRun({
          text: monthLabel,
          size: 28, // 14pt
          color: 'D97706'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
      children: [
        new TextRun({
          text: `Generated on: ${new Date().toLocaleDateString()}`,
          size: 20,
          color: '6B7280'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: 'Confidential — For Internal Church Administration Use Only',
          size: 16,
          italics: true,
          color: '6B7280'
        })
      ]
    })
  );

  // ==========================================
  // 2. CROSS-UNIT EXECUTIVE SUMMARY
  // ==========================================
  // Page break before summary
  children.push(
    new Paragraph({
      text: 'Cross-Unit Executive Summary',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { before: 400, after: 200 }
    })
  );

  if (crossUnitSummary) {
    children.push(
      new Paragraph({
        text: 'Overall Summary',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: crossUnitSummary.overall_summary || 'No summary text available.',
            size: 22
          })
        ]
      }),
      
      new Paragraph({
        text: 'Common Breakthroughs',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      })
    );

    if (crossUnitSummary.common_breakthroughs && crossUnitSummary.common_breakthroughs.length > 0) {
      crossUnitSummary.common_breakthroughs.forEach((item: string) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: item, size: 22 })]
          })
        );
      });
    } else {
      children.push(new Paragraph({ text: 'No common breakthroughs noted.', spacing: { after: 100 } }));
    }

    children.push(
      new Paragraph({
        text: 'Common Issues & Challenges',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      })
    );

    if (crossUnitSummary.common_issues && crossUnitSummary.common_issues.length > 0) {
      crossUnitSummary.common_issues.forEach((item: string) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: item, size: 22 })]
          })
        );
      });
    } else {
      children.push(new Paragraph({ text: 'No repeating department issues noted.', spacing: { after: 100 } }));
    }

    children.push(
      new Paragraph({
        text: 'Critical Alerts',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      })
    );

    if (crossUnitSummary.critical_alerts && crossUnitSummary.critical_alerts.length > 0) {
      crossUnitSummary.critical_alerts.forEach((item: string) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: `⚠ ${item}`, size: 22, color: 'DC2626' })]
          })
        );
      });
    } else {
      children.push(new Paragraph({ text: 'No urgent critical alerts reported.', spacing: { after: 100 } }));
    }
  } else {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'No cross-unit summaries generated for this month.',
            italics: true,
            size: 20
          })
        ]
      })
    );
  }

  // ==========================================
  // 3. UNIT REPORTS
  // ==========================================
  unitsData.forEach(unit => {
    children.push(
      new Paragraph({
        text: unit.name,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { before: 400, after: 100 }
      }),
      new Paragraph({
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: `Unit Head: ${unit.headName || 'Not Assigned'}  |  Status: ${unit.status}`,
            italics: true,
            color: '6B7280',
            size: 20
          })
        ]
      }),
      
      new Paragraph({
        text: 'Submitted Report Content',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      }),
      new Paragraph({
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: unit.content || 'No report content submitted for this month.',
            size: 20
          })
        ]
      })
    );

    if (unit.aiSummary) {
      children.push(
        new Paragraph({
          text: 'AI Generated Report Insights',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new Paragraph({
          spacing: { after: 150 },
          children: [
            new TextRun({ text: 'Overview Summary: ', bold: true, size: 20 }),
            new TextRun({ text: unit.aiSummary.summary || 'N/A', size: 20 })
          ]
        }),
        new Paragraph({
          text: 'Achievements:',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 50 }
        })
      );

      if (unit.aiSummary.breakthroughs && unit.aiSummary.breakthroughs.length > 0) {
        unit.aiSummary.breakthroughs.forEach((item: string) => {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text: item, size: 20 })]
            })
          );
        });
      } else {
        children.push(new Paragraph({ text: 'None.', spacing: { after: 50 } }));
      }

      children.push(
        new Paragraph({
          text: 'Challenges / Issues:',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 50 }
        })
      );

      if (unit.aiSummary.issues && unit.aiSummary.issues.length > 0) {
        unit.aiSummary.issues.forEach((item: string) => {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text: item, size: 20 })]
            })
          );
        });
      } else {
        children.push(new Paragraph({ text: 'None.', spacing: { after: 50 } }));
      }
    }

    if (unit.comments && unit.comments.length > 0) {
      children.push(
        new Paragraph({
          text: 'Admin Feedback',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        })
      );
      unit.comments.forEach((c: any) => {
        children.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: `${c.author} `, bold: true, size: 20 }),
              new TextRun({ text: `(${new Date(c.createdAt).toLocaleDateString()}): `, italics: true, color: '6B7280', size: 18 }),
              new TextRun({ text: c.comment, size: 20 })
            ]
          })
        );
      });
    }
  });

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children
      }
    ]
  });

  // Return generated buffer
  return await Packer.toBuffer(doc);
}
