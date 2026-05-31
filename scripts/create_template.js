const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, HeadingLevel } = require('docx');

async function main() {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                // Title
                new Paragraph({
                    heading: HeadingLevel.TITLE,
                    children: [
                        new TextRun({
                            text: "Template Contoh Soal Ujian - Format Rushless",
                            bold: true,
                            size: 32,
                            font: "Arial"
                        })
                    ],
                    spacing: { after: 200 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Petunjuk: Dokumen ini berisi contoh dari berbagai jenis soal yang didukung oleh platform Rushless Exam. Anda dapat mengedit file ini dan mengunggahnya langsung ke sistem.",
                            italics: true,
                            size: 20,
                            font: "Arial"
                        })
                    ],
                    spacing: { after: 400 }
                }),

                // Section 1: Pilihan Ganda
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "[Pilihan Ganda]",
                            bold: true,
                            size: 24,
                            font: "Arial",
                            color: "1D4ED8" // Blue
                        })
                    ],
                    spacing: { before: 200, after: 120 }
                }),

                // Q1: Standard Multiple Choice with Bold & Italic
                new Paragraph({
                    children: [
                        new TextRun({ text: "1. [BOBOT: 1.0] Manakah dari pilihan berikut yang merupakan ", font: "Arial", size: 22 }),
                        new TextRun({ text: "ibukota negara Indonesia", bold: true, font: "Arial", size: 22 }),
                        new TextRun({ text: " secara resmi?", font: "Arial", size: 22 })
                    ],
                    spacing: { before: 120, after: 80 }
                }),
                new Paragraph({ children: [new TextRun({ text: "A. Jakarta", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "B. Bandung", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "C. Surabaya", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "D. Medan", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 80 } }),
                new Paragraph({ children: [new TextRun({ text: "Ans: A", bold: true, font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 200 } }),

                // Q2: PGK (Multiple Choice Complex) with Alignment (Center)
                new Paragraph({
                    children: [
                        new TextRun({ text: "2. [BOBOT: 2.0] [PGK_STRICT] Di antara organel sel berikut, manakah yang ", font: "Arial", size: 22 }),
                        new TextRun({ text: "hanya ditemukan", italics: true, font: "Arial", size: 22 }),
                        new TextRun({ text: " pada sel tumbuhan? (Pilih semua yang benar)", font: "Arial", size: 22 })
                    ],
                    spacing: { before: 120, after: 80 }
                }),
                new Paragraph({
                    children: [new TextRun({ text: "[[ALIGN:center]] (Perhatikan gambar atau struktur sel di bawah ini)", italics: true, font: "Arial", size: 18 })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 80 }
                }),
                new Paragraph({ children: [new TextRun({ text: "A. Dinding Sel", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "B. Kloroplas", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "C. Lisosom", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "D. Sentriol", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 80 } }),
                new Paragraph({ children: [new TextRun({ text: "Ans: A, B", bold: true, font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 200 } }),

                // Q3: True/False with styled Table
                new Paragraph({
                    children: [
                        new TextRun({ text: "3. [BOBOT: 1.0] Berdasarkan tabel hasil pengamatan di bawah ini, apakah pernyataan bahwa zat X memiliki titik didih tertinggi benar?", font: "Arial", size: 22 })
                    ],
                    spacing: { before: 120, after: 120 }
                }),
                // Table
                new Table({
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nama Zat", bold: true, font: "Arial", size: 20 })] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Titik Didih (°C)", bold: true, font: "Arial", size: 20 })] })] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Zat X", font: "Arial", size: 20 })] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "78", font: "Arial", size: 20 })] })] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Zat Y", font: "Arial", size: 20 })] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "100", font: "Arial", size: 20 })] })] })
                            ]
                        })
                    ],
                    spacing: { after: 120 }
                }),
                new Paragraph({ children: [new TextRun({ text: "A. Benar", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "B. Salah", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 80 } }),
                new Paragraph({ children: [new TextRun({ text: "Ans: B", bold: true, font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 200 } }),

                // Section 2: Menjodohkan
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "[Menjodohkan]",
                            bold: true,
                            size: 24,
                            font: "Arial",
                            color: "1D4ED8" // Blue
                        })
                    ],
                    spacing: { before: 200, after: 120 }
                }),

                // Q4: Matching
                new Paragraph({
                    children: [
                        new TextRun({ text: "4. [BOBOT: 3.0] Jodohkanlah negara-negara berikut dengan ibukotanya masing-masing secara tepat!", font: "Arial", size: 22 })
                    ],
                    spacing: { before: 120, after: 80 }
                }),
                new Paragraph({ children: [new TextRun({ text: "1. Jepang", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "2. Prancis", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "3. Indonesia", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 80 } }),
                new Paragraph({ children: [new TextRun({ text: "A. Jakarta", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "B. Tokyo", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "C. Paris", font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 80 } }),
                new Paragraph({ children: [new TextRun({ text: "Ans: 1-B, 2-C, 3-A", bold: true, font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 200 } }),

                // Section 3: Esai
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "[Esai]",
                            bold: true,
                            size: 24,
                            font: "Arial",
                            color: "1D4ED8" // Blue
                        })
                    ],
                    spacing: { before: 200, after: 120 }
                }),

                // Q5: Essay with [ESSAY_ANY]
                new Paragraph({
                    children: [
                        new TextRun({ text: "5. [BOBOT: 2.0] [ESSAY_ANY] Sebutkan organ utama sistem peredaran darah pada manusia!", font: "Arial", size: 22 })
                    ],
                    spacing: { before: 120, after: 80 }
                }),
                new Paragraph({ children: [new TextRun({ text: "Ans: jantung, pembuluh darah, paru-paru", bold: true, font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 200 } }),

                // Q6: Essay with [ESSAY_STRICT]
                new Paragraph({
                    children: [
                        new TextRun({ text: "6. [BOBOT: 5.0] [ESSAY_STRICT] Tuliskan persamaan reaksi kimia fotosintesis lengkap dengan rumus molekulnya!", font: "Arial", size: 22 })
                    ],
                    spacing: { before: 120, after: 80 }
                }),
                new Paragraph({ children: [new TextRun({ text: "Ans: 6CO2, 6H2O, C6H12O6, 6O2", bold: true, font: "Arial", size: 22 })], indent: { left: 720 }, spacing: { after: 200 } })
            ]
        }]
    });

    const outPath = path.join(__dirname, '../public/Template Soal Rushless.docx');
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outPath, buffer);
    console.log("Template generated successfully at " + outPath);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
