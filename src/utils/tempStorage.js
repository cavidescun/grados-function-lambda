const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const tempDirectories = [];

async function createTempDirectory() {
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const tempDir = path.join(os.tmpdir(), `pdf-processor-${uniqueId}`);
  
  await fs.ensureDir(tempDir);
  tempDirectories.push(tempDir);
  console.log(`[TEMP] Created temporary directory: ${tempDir}`);
  return tempDir;
}

async function cleanupTempFiles() {
  for (const dir of tempDirectories) {
    try {
      await fs.remove(dir);
      console.log(`[TEMP] Cleaned up temporary directory: ${dir}`);
    } catch (error) {
      console.error(`[TEMP] Error cleaning up directory ${dir}:`, error);
    }
  }
}

module.exports = {
  createTempDirectory,
  cleanupTempFiles
};