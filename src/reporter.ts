import ExcelJS from 'exceljs';
import { AnalysisResult, UnusedClass } from './types';
import * as path from 'path';

export class ExcelReporter {
  async generateReport(result: AnalysisResult, outputPath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    this.createSummarySheet(workbook, result);

    // Unused Classes Sheet
    this.createUnusedClassesSheet(workbook, result.unusedClasses);

    // Statistics Sheet
    this.createStatisticsSheet(workbook, result);

    // Save the workbook
    await workbook.xlsx.writeFile(outputPath);
    console.log(`\nReport generated: ${outputPath}`);
  }

  private createSummarySheet(workbook: ExcelJS.Workbook, result: AnalysisResult): void {
    const sheet = workbook.addWorksheet('Summary');

    // Set column widths
    sheet.columns = [
      { width: 30 },
      { width: 20 },
    ];

    // Title
    sheet.getCell('A1').value = 'CSS Analysis Summary';
    sheet.getCell('A1').font = { bold: true, size: 16 };

    // Metrics
    let row = 3;
    const metrics = [
      ['Total Classes Found', result.totalClasses],
      ['Used Classes', result.usedClasses],
      ['Unused Classes', result.unusedClasses.length],
      ['Usage Rate', `${((result.usedClasses / result.totalClasses) * 100).toFixed(2)}%`],
    ];

    metrics.forEach(([label, value]) => {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`A${row}`).font = { bold: true };
      sheet.getCell(`B${row}`).value = value;
      row++;
    });

    // Add breakdown by type
    row += 2;
    sheet.getCell(`A${row}`).value = 'Breakdown by Type';
    sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
    row++;

    sheet.getCell(`A${row}`).value = 'Type';
    sheet.getCell(`B${row}`).value = 'Total';
    sheet.getCell(`C${row}`).value = 'Unused';
    sheet.getCell(`D${row}`).value = 'Usage Rate';
    sheet.getRow(row).font = { bold: true };
    row++;

    Object.entries(result.stats.byType).forEach(([type, stats]) => {
      const usageRate = stats.total > 0 
        ? `${(((stats.total - stats.unused) / stats.total) * 100).toFixed(2)}%`
        : 'N/A';
      
      sheet.getCell(`A${row}`).value = type;
      sheet.getCell(`B${row}`).value = stats.total;
      sheet.getCell(`C${row}`).value = stats.unused;
      sheet.getCell(`D${row}`).value = usageRate;
      row++;
    });
  }

  private createUnusedClassesSheet(
    workbook: ExcelJS.Workbook,
    unusedClasses: UnusedClass[]
  ): void {
    const sheet = workbook.addWorksheet('Unused Classes');

    // Headers
    sheet.columns = [
      { header: 'Class Name', key: 'className', width: 30 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'File', key: 'file', width: 50 },
      { header: 'Line', key: 'line', width: 10 },
      { header: 'Confidence', key: 'confidence', width: 15 },
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data
    unusedClasses.forEach((unusedClass) => {
      sheet.addRow({
        className: unusedClass.className,
        type: unusedClass.type,
        file: unusedClass.definedIn,
        line: unusedClass.line,
        confidence: `${(unusedClass.confidence * 100).toFixed(1)}%`,
      });
    });

    // Add filters
    sheet.autoFilter = {
      from: 'A1',
      to: 'E1',
    };

    // Freeze header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private createStatisticsSheet(workbook: ExcelJS.Workbook, result: AnalysisResult): void {
    const sheet = workbook.addWorksheet('Statistics');

    sheet.columns = [
      { width: 50 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];

    // By File Statistics
    sheet.getCell('A1').value = 'Statistics by File';
    sheet.getCell('A1').font = { bold: true, size: 14 };

    let row = 3;
    sheet.getCell(`A${row}`).value = 'File';
    sheet.getCell(`B${row}`).value = 'Total Classes';
    sheet.getCell(`C${row}`).value = 'Unused';
    sheet.getCell(`D${row}`).value = 'Usage Rate';
    sheet.getRow(row).font = { bold: true };
    row++;

    // Sort files by unused count (descending)
    const fileStats = Object.entries(result.stats.byFile).sort(
      ([, a], [, b]) => b.unused - a.unused
    );

    fileStats.forEach(([file, stats]) => {
      const usageRate = stats.total > 0
        ? `${(((stats.total - stats.unused) / stats.total) * 100).toFixed(2)}%`
        : 'N/A';
      
      sheet.getCell(`A${row}`).value = file;
      sheet.getCell(`B${row}`).value = stats.total;
      sheet.getCell(`C${row}`).value = stats.unused;
      sheet.getCell(`D${row}`).value = usageRate;
      row++;
    });
  }
}

