const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const EXTENSION_ID = 'beepaenfejnphdgnkmccjcfiieihhogl';
const VERSION = '130.0.0.0'; // Chrome version to request modern manifest v3 CRX
const downloadUrl = `https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&prodversion=${VERSION}&x=id%3D${EXTENSION_ID}%26installsource%3Dondemand%26uc`;

const backendDir = __dirname;
const zipPath = path.join(backendDir, 'extension.zip');
const extractDir = path.join(backendDir, 'extension');

async function downloadAndExtract() {
  console.log(`Downloading CheckVisaSlots extension from Chrome Web Store...`);
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: Status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Find the ZIP file magic signature: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
    const zipMagic = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
    const zipStartIndex = buffer.indexOf(zipMagic);

    if (zipStartIndex === -1) {
      throw new Error("Could not find ZIP payload signature (PK magic) in the downloaded CRX file.");
    }

    console.log(`Found ZIP signature at offset ${zipStartIndex}. Stripping CRX headers...`);
    const zipBuffer = buffer.subarray(zipStartIndex);

    // Save as standard ZIP file
    fs.writeFileSync(zipPath, zipBuffer);
    console.log(`Saved extension as ZIP at: ${zipPath}`);

    // Create target extraction directory
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    // Use native macOS unzip utility to extract the extension ZIP
    console.log(`Extracting extension to: ${extractDir}...`);
    exec(`unzip -o "${zipPath}" -d "${extractDir}"`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Unzip failed: ${err.message}`);
        console.error(stderr);
        return;
      }
      console.log(`Successfully extracted CheckVisaSlots extension!`);
      // Cleanup the zip file
      try {
        fs.unlinkSync(zipPath);
      } catch (_) {}
    });

  } catch (error) {
    console.error(`Failed to download and extract extension: ${error.message}`);
  }
}

downloadAndExtract();
