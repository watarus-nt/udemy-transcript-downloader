const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Apply stealth plugin to avoid detection
puppeteerExtra.use(StealthPlugin());

// Initialize readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '../output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Main function
async function main() {
  // Check if URL is provided
  if (process.argv.length < 3) {
    console.error('Please provide a Udemy course URL as a parameter');
    console.error('Example: npm start https://metruyencv.com/truyen/<book-name>');
    process.exit(1);
  }

  // Get course URL from command line argument
  let bookUrl = process.argv[2];

  // Make sure URL ends with a trailing slash
  if (!bookUrl.endsWith('/')) {
    bookUrl += '/';
  }

  console.log(`Course URL: ${bookUrl}`);

  const starter = await new Promise((resolve) => {
    rl.question(`Starting index (default is 0) [0]: `, (answer) => {
      const normalized = answer.trim();
      resolve(normalized ? parseInt(normalized, 10) : 0);
    });
  });

  const tabCount = await new Promise((resolve) => {
    rl.question(`How many tabs do you want to use for downloading transcripts? (default is 5) [5]: `, (answer) => {
      const normalized = answer.trim();
      resolve(normalized ? parseInt(normalized, 10) : 5);
    });
  });

  // Launch browser in headless mode
  console.log('Launching browser...');
  const browser = await puppeteerExtra.launch({
    headless: 'new', // Use the new headless mode
    defaultViewport: null,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', // Path to Edge browser
    userDataDir: 'C:\\Users\\tmhun\\AppData\\Local\\Microsoft\\Edge\\User Data',
    // userDataDir: 'F:\\data\\User Data', // Path to your Edge user profile  
    args: [
      '--window-size=1280,720',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox'
    ],
    dumpio: false, // Enable browser logs
    protocolTimeout: 300000
  });

  try {
    const page = await browser.newPage();
    await new Promise(resolve => setTimeout(resolve, 1000));

    let courseJson = null;
    const maxAttempts = 3;
    let chapterLinks = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Attempt ${attempt} to fetch chapter content...`);
      try {
        // Navigate to table of content link
        console.log(`Navigating to table of content: ${bookUrl}`);
        await page.goto(bookUrl, { waitUntil: 'networkidle2' });

        // Click the "Mục Lục" button
        await page.waitForSelector('button', { timeout: 10000 }); // Wait for the span element to appear
        const mucLucButton = await page.evaluateHandle(() => {
          return Array.from(document.querySelectorAll("span")).find(el => el.textContent.trim() === "Mục Lục");
        });
        if (mucLucButton) {
          await mucLucButton.click();
          console.log('Clicked "Mục Lục" button.');
        } else {
          throw new Error('"Mục Lục" button not found.');
        }
    
        
        // Wait for chapter links to load
        await page.waitForSelector("a[data-x-bind='ChapterItem(index)']", { timeout: 10000 });

        
        // Extract all chapter links
        chapterLinks = await page.evaluate(() => {
          const links = [];
          document.querySelectorAll("a[data-x-bind='ChapterItem(index)']").forEach((a) => {
            links.push(a.href);
          });
          return links;
        });

        console.log(`Found ${chapterLinks.length} chapter links.`);
        break;
      } catch (err) {
        console.warn(`[Attempt ${attempt}] Failed to fetch course content: ${err.message}`);
        if (attempt < maxAttempts) {
          console.log('Retrying in 5 seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          throw new Error('Could not retrieve course content. Make sure you have access to this course and try again.');
        }
      }
    }

    // Filter chapter links based on the starter index
    if (chapterLinks) {
      let originalCount = chapterLinks.length;
      chapterLinks = chapterLinks.filter(link => {
          const chapterNumber = parseInt(extractChapterNumber(link), 10);
          return chapterNumber >= starter;
      });

      console.log(`Filtering complete. Keeping ${chapterLinks.length} links (Chapter number >= ${starter}).`);
      if (chapterLinks.length === 0 && originalCount > 0) {
            console.warn("WARNING: All chapters were filtered out. Check your starting index.");
      } else if (chapterLinks.length === 0) {
            console.warn("WARNING: No chapters found after filtering.");
      }
  } else {
      throw new Error('No chapter links were found to start the download process.');
  }

    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Download transcripts
    console.log('Downloading transcripts...');
    await downloadContents(browser, chapterLinks, tabCount, starter);

    console.log('All transcripts have been downloaded successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Close browser
    await browser.close();
    rl.close();
  }
}



/**
 * Extracts the chapter number from a given URL.
 * @param {string} url - The URL of the chapter.
 * @returns {string} - The chapter number.
 */
function extractChapterNumber(url) {
  try {
    const parts = url.split('/');
    const lastSegment = parts[parts.length - 1]; // Get the last part of the URL
    const chapterNumber = lastSegment.substring(lastSegment.lastIndexOf('-') + 1); // Get the string after the last "-"
    return chapterNumber;
  } catch (error) {
    console.error('Error extracting chapter number:', error.message);
    return null;
  }
}


// Download transcripts
async function downloadContents(browser, chapterLinks, tabCount = 5, starter = 0) {
  
  // Split into chunks
  function chunkArray(arr, chunkCount) {
    const chunks = Array.from({ length: chunkCount }, () => []);
    arr.forEach((item, index) => {
      chunks[index % chunkCount].push(item);
    });
    return chunks;
  }

  const chunks = chunkArray(chapterLinks, tabCount);

  // Launch tabs and process in parallel
  await Promise.all(chunks.map(async (chunk, tabIndex) => {
    const page = await browser.newPage();
    console.log(`Tab ${tabIndex + 1} processing ${chunk.length} lectures...`);

    for (let i = 0; i < chunk.length; i++) {
      const chapterNumber = extractChapterNumber(chunk[i]);

      // Open chapter page
      const chapterPage = await browser.newPage();
      await chapterPage.goto(chunk[i], { waitUntil: 'networkidle2' });
      console.log(`Opened chapter ${chunk[i]}`);

      // Extract chapter content
      const content = await chapterPage.evaluate(() => {
        const contentElement = document.querySelector('#chapter-content');
        return contentElement ? contentElement.innerText : 'No content found.';
      });

      // Save content to a text file
      const fileName = `Chapter_${chapterNumber}.txt`;
      const filePath = path.join(outputDir, fileName);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Saved chapter ${chapterNumber} to ${fileName}.`);

      await chapterPage.close();
    }


    await page.close();
    console.log(`Tab ${tabIndex + 1} done.`);
  }));
}


// Run the main function
main().catch(err => {
  console.error('Fatal error occurred:', err.message || err);
  process.exit(1);
});

