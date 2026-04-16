/**
 * Cost Export Endpoint
 * POST /api/cost/export - Export cost data as CSV or PDF
 * 
 * Request Body:
 * - format: 'csv' or 'pdf'
 * - dateFrom: Start date (ISO 8601)
 * - dateTo: End date (ISO 8601)
 * 
 * Returns:
 * - CSV: Plain text with comma-separated values
 * - PDF: Binary PDF file
 * 
 * Requirements: 9.1, 9.9, 9.10
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCostRecords } from '@/lib/cost-tracking';
import { CostRecordFilter } from '@/lib/db/schema';

interface ExportRequest {
  format: 'csv' | 'pdf';
  dateFrom?: string;
  dateTo?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from request headers
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    // Parse request body
    const body: ExportRequest = await request.json();

    // Validate format
    if (!body.format || !['csv', 'pdf'].includes(body.format)) {
      return NextResponse.json(
        { error: { code: 'INVALID_FORMAT', message: 'Format must be "csv" or "pdf"' } },
        { status: 400 }
      );
    }

    // Build filter
    const filter: CostRecordFilter = {
      startDate: body.dateFrom ? new Date(body.dateFrom) : undefined,
      endDate: body.dateTo ? new Date(body.dateTo) : undefined,
      limit: 10000, // Get all records for export
      offset: 0,
    };

    // Get cost records
    const records = await getCostRecords(tenantId, filter);

    if (body.format === 'csv') {
      return exportAsCSV(records);
    } else {
      return exportAsPDF(records);
    }
  } catch (error) {
    console.error('Error exporting cost data:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

/**
 * Export records as CSV
 */
function exportAsCSV(records: any[]): NextResponse {
  // CSV headers
  const headers = [
    'Date',
    'Provider ID',
    'Gate',
    'Topic ID',
    'Tokens Used',
    'Cost (USD)',
    'Cost (PKR)',
    'Conversation ID',
  ];

  // CSV rows
  const rows = records.map(record => [
    new Date(record.createdAt).toISOString(),
    record.providerId || '',
    record.gateNumber || '',
    record.topicId || '',
    record.tokensUsed || 0,
    record.costUsd || 0,
    record.costPkr || 0,
    record.conversationId || '',
  ]);

  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row
        .map(cell => {
          // Escape quotes and wrap in quotes if contains comma
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(',')
    ),
  ].join('\n');

  // Return CSV file
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cost-report-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}

/**
 * Export records as PDF
 * Note: For MVP, we'll return a simple text-based PDF using basic PDF generation
 * In production, use a library like pdfkit or puppeteer
 */
function exportAsPDF(records: any[]): NextResponse {
  // For MVP, return a simple PDF with basic formatting
  // In production, use a proper PDF library

  const pdfContent = generateSimplePDF(records);

  return new NextResponse(pdfContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cost-report-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  });
}

/**
 * Generate a simple PDF content (text-based)
 * In production, use a proper PDF library like pdfkit
 */
function generateSimplePDF(records: any[]): Buffer {
  // For MVP, create a basic PDF structure
  // This is a simplified version - in production use pdfkit or similar

  const title = 'Cost Intelligence Report';
  const generatedDate = new Date().toISOString();
  const totalRecords = records.length;
  const totalCostUsd = records.reduce((sum, r) => sum + (r.costUsd || 0), 0);
  const totalCostPkr = records.reduce((sum, r) => sum + (r.costPkr || 0), 0);

  // Create a simple text representation
  let content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 500 >>
stream
BT
/F1 24 Tf
50 750 Td
(${title}) Tj
0 -30 Td
/F1 12 Tf
(Generated: ${generatedDate}) Tj
0 -20 Td
(Total Records: ${totalRecords}) Tj
0 -15 Td
(Total Cost USD: $${totalCostUsd.toFixed(4)}) Tj
0 -15 Td
(Total Cost PKR: Rs${totalCostPkr.toFixed(2)}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
0000000764 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
850
%%EOF`;

  return Buffer.from(content, 'utf-8');
}
