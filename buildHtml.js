const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'output');
const outputHtmlFile = path.join(__dirname, 'output.html');

(async () => {
  try {
    // Read all files in the output directory
    const files = fs.readdirSync(outputDir).filter(file => file.endsWith('.txt'));

    // Sort files numerically by chapter number
    files.sort((a, b) => {
      const chapterA = parseInt(a.match(/\d+/)[0], 10);
      const chapterB = parseInt(b.match(/\d+/)[0], 10);
      return chapterA - chapterB;
    });

    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chapters</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
    h1, h2 { color: #333; }
    a { text-decoration: none; color: #007BFF; }
    a:hover { text-decoration: underline; }
    .toc { margin-bottom: 20px; }
    .chapter { margin-top: 40px; }
  </style>
</head>
<body>
  <h1>Table of Contents</h1>
  <div class="toc">
`;

    // Build the table of contents
    files.forEach(file => {
      const chapterNumber = file.match(/\d+/)[0];
      htmlContent += `<p><a href="#chapter-${chapterNumber}">Chapter ${chapterNumber}</a></p>\n`;
    });

    htmlContent += `</div>\n`;

    // Add content for each chapter
    files.forEach(file => {
      const chapterNumber = file.match(/\d+/)[0];
      const chapterContent = fs.readFileSync(path.join(outputDir, file), 'utf8');
      htmlContent += `
<div class="chapter" id="chapter-${chapterNumber}">
  <h2>Chapter ${chapterNumber}</h2>
  <pre>${chapterContent}</pre>
</div>
`;
    });

    htmlContent += `
</body>
</html>
`;

    // Write the HTML content to a file
    fs.writeFileSync(outputHtmlFile, htmlContent, 'utf8');
    console.log(`HTML file has been created: ${outputHtmlFile}`);
  } catch (error) {
    console.error('Error building HTML file:', error.message);
  }
})();