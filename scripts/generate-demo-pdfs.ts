/**
 * Generates sample demo PDF documents for presentation
 */
import * as fs from 'fs';
import * as path from 'path';

const demoDir = path.resolve(__dirname, '../demo-files');
if (!fs.existsSync(demoDir)) {
  fs.mkdirSync(demoDir, { recursive: true });
}

function createSimplePdf(title: string, body1: string, body2: string, body3: string): Buffer {
  const content = `BT
/F1 18 Tf
50 720 Td
(${title}) Tj
/F2 12 Tf
0 -40 Td
(${body1}) Tj
0 -30 Td
(${body2}) Tj
0 -30 Td
(${body3}) Tj
ET`;

  const streamLength = Buffer.byteLength(content, 'utf8');

  const pdf = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 612 792]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica-Bold
      >>
      /F2 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica
      >>
    >>
  >>
>>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${content}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000318 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
${400 + streamLength}
%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

// 1. Original Rahul Experience Letter from Company A
const originalPdf = createSimplePdf(
  'Company A Ltd - Official Experience Letter',
  'This certifies that Rahul Sharma worked as Junior Developer from 2024 to 2026.',
  'Issued under authorized EIP-712 digital key on Polygon PoS.',
  'Credential ID: 0x7e8b9104c9e82103f8a4bc1265893a90ef56321478cdbe3290124589abcdef12'
);
fs.writeFileSync(path.join(demoDir, '1_Original_Rahul_Experience_Letter.pdf'), originalPdf);

// 2. Tampered Experience Letter (Altered designation & dates)
const tamperedPdf = createSimplePdf(
  'Company A Ltd - Official Experience Letter',
  'This certifies that Rahul Sharma worked as Senior Developer from 2023 to 2026.',
  'Issued under authorized EIP-712 digital key on Polygon PoS.',
  'Credential ID: 0x7e8b9104c9e82103f8a4bc1265893a90ef56321478cdbe3290124589abcdef12'
);
fs.writeFileSync(path.join(demoDir, '2_Tampered_Rahul_Experience_Letter.pdf'), tamperedPdf);

// 3. Original Academic Degree from University
const degreePdf = createSimplePdf(
  'State Technical University - Degree Certificate',
  'This confers upon Alice Smith the Degree of Bachelor of Science in Computer Science.',
  'Graduation Year: 2024 | First Class with Distinction.',
  'Credential ID: 0x4f128d8b901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c'
);
fs.writeFileSync(path.join(demoDir, '3_University_Degree_Alice.pdf'), degreePdf);

console.log('Successfully created demo PDF files in demo-files/:');
console.log(' - 1_Original_Rahul_Experience_Letter.pdf');
console.log(' - 2_Tampered_Rahul_Experience_Letter.pdf');
console.log(' - 3_University_Degree_Alice.pdf');

