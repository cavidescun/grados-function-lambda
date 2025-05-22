const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { createTempDirectory } = require('../utils/tempStorage');

let GoogleAuthService;
if (process.env.AWS_EXECUTION_ENV) {
  GoogleAuthService = require('./googleAuthLambda');
} else {
  try {
    GoogleAuthService = require('./googleAuthService');
  } catch (error) {
    console.log('[DRIVE] googleAuthService no disponible en este entorno');
    GoogleAuthService = require('./googleAuthLambda');
  }
}

function extractFileIdFromUrl(url) {
  console.log(`[DRIVE] Procesando URL: ${url.substring(0, 50)}...`);
  
  const regexPatterns = [
    /\/file\/d\/([^/]+)/,
    /id=([^&]+)/,
    /\/d\/([^/]+)/
  ];
  
  for (const regex of regexPatterns) {
    const match = url.match(regex);
    if (match && match[1]) {
      console.log(`[DRIVE] File ID extraído: ${match[1]}`);
      return match[1];
    }
  }
  
  throw new Error(`No se pudo extraer el File ID de la URL: ${url}`);
}

async function downloadFileFromDriveWithAuth(fileId, tempDir, oauth2Client) {
  try {
    console.log(`[DRIVE-AUTH] Descargando archivo autenticado: ${fileId}`);
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'name,mimeType,size'
    });
    
    console.log(`[DRIVE-AUTH] Archivo encontrado: ${fileMetadata.data.name}`);
    console.log(`[DRIVE-AUTH] Tipo MIME: ${fileMetadata.data.mimeType}`);
    
    const fileName = fileMetadata.data.name || `${fileId}.pdf`;
    const filePath = path.join(tempDir, fileName);
    
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    }, { responseType: 'stream' });
    
    const writer = fs.createWriteStream(filePath);
    
    return new Promise((resolve, reject) => {
      response.data.on('error', reject);
      writer.on('error', reject);
      writer.on('finish', () => {
        console.log(`[DRIVE-AUTH] Archivo descargado: ${fileName}`);
        resolve(filePath);
      });
      response.data.pipe(writer);
    });
    
  } catch (error) {
    console.error(`[DRIVE-AUTH] Error descargando ${fileId}:`, error.message);
    
    if (error.code === 403) {
      throw new Error(`PERMISSION_DENIED: No tienes permisos para acceder al archivo ${fileId}`);
    }
    
    if (error.code === 404) {
      throw new Error(`FILE_NOT_FOUND: El archivo ${fileId} no existe o no es accesible`);
    }
    
    throw new Error(`AUTH_DOWNLOAD_ERROR: ${error.message}`);
  }
}

async function downloadFileFromDrive(fileId, tempDir, googleCredentials = null) {
  if (googleCredentials && googleCredentials.client_id && googleCredentials.client_secret) {
    try {
      console.log(`[DRIVE] Intentando descarga autenticada para: ${fileId}`);
      
      const oauth2Client = new google.auth.OAuth2(
        googleCredentials.client_id,
        googleCredentials.client_secret,
        'urn:ietf:wg:oauth:2.0:oob'
      );
      
      if (googleCredentials.access_token) {
        oauth2Client.setCredentials({ 
          access_token: googleCredentials.access_token,
          refresh_token: googleCredentials.refresh_token 
        });
        
        return await downloadFileFromDriveWithAuth(fileId, tempDir, oauth2Client);
      } else {
        console.log(`[DRIVE] No hay access_token en las credenciales`);
      }
      
    } catch (authError) {
      console.log(`[DRIVE] Descarga autenticada falló: ${authError.message}`);
      console.log(`[DRIVE] Intentando descarga pública como respaldo...`);
    }
  }
  
  const downloadUrls = [
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.google.com/u/0/uc?id=${fileId}&export=download&confirm=t`
  ];
  
  let lastError = null;
  
  for (let i = 0; i < downloadUrls.length; i++) {
    const downloadUrl = downloadUrls[i];
    console.log(`[DRIVE] Intentando URL pública ${i + 1}: ${downloadUrl.substring(0, 60)}...`);
    
    try {
      const response = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });
      
      const contentBuffer = Buffer.from(response.data);
      
      if (isGoogleDriveErrorPage(contentBuffer.slice(0, 500).toString(), response.headers)) {
        console.log(`[DRIVE] URL pública ${i + 1} devolvió página de error`);
        continue;
      }
      
      if (contentBuffer.length < 1000) {
        console.log(`[DRIVE] URL pública ${i + 1} devolvió archivo muy pequeño`);
        continue;
      }
      
      const fileName = `${fileId}.pdf`;
      const filePath = path.join(tempDir, fileName);
      await fs.writeFile(filePath, contentBuffer);
      
      console.log(`[DRIVE] Descarga pública exitosa: ${fileName}`);
      return filePath;
      
    } catch (urlError) {
      console.log(`[DRIVE] Error con URL pública ${i + 1}: ${urlError.message}`);
      lastError = urlError;
    }
  }
  
  throw new Error(`No se pudo descargar el archivo ${fileId}: ${lastError?.message || 'Todos los métodos fallaron'}`);
}

function isGoogleDriveErrorPage(content, headers) {
  const contentType = headers['content-type'] || '';
  
  if (contentType.includes('text/html')) {
    return true;
  }
  
  if (content.includes('<!DOCTYPE') || content.includes('<html')) {
    return true;
  }
  
  return false;
}

async function downloadDocuments(fileUrls, googleCredentials = null) {
  const tempDir = await createTempDirectory();
  const downloadedFiles = [];
  const failedFiles = [];
  
  console.log(`[DRIVE] Iniciando descarga de ${fileUrls.length} archivos`);
  console.log(`[DRIVE] Entorno: ${process.env.AWS_EXECUTION_ENV ? 'Lambda' : 'Local'}`);
  
  if (!googleCredentials && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      console.log(`[DRIVE] Intentando autenticación automática...`);
      const authService = new GoogleAuthService(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
      googleCredentials = await authService.initializeAuth();
      console.log(`[DRIVE] Autenticación automática exitosa`);
    } catch (authError) {
      console.log(`[DRIVE] Autenticación automática falló: ${authError.message}`);
      if (authError.message.includes('NO_TOKENS_FOUND')) {
        throw new Error(`ERROR_TOKENS_NO_CONFIGURADOS: Los tokens de Google Drive no están configurados en AWS Parameter Store. Ejecutar script de configuración.`);
      }
    }
  }
  
  console.log(`[DRIVE] Credenciales Google disponibles: ${googleCredentials ? 'Sí' : 'No'}`);
  
  for (const url of fileUrls) {
    try {
      const fileId = extractFileIdFromUrl(url);
      const filePath = await downloadFileFromDrive(fileId, tempDir, googleCredentials);
      
      const stats = await fs.stat(filePath);
      
      downloadedFiles.push({
        originalUrl: url,
        fileId,
        path: filePath,
        fileName: path.basename(filePath),
        size: stats.size
      });
      
      console.log(`[DRIVE] Éxito: ${path.basename(filePath)} (${stats.size} bytes)`);
      
    } catch (error) {
      console.error(`[DRIVE] Error procesando ${url}:`, error.message);
      
      let errorType = 'DOWNLOAD_ERROR';
      if (error.message.includes('PERMISSION_DENIED')) {
        errorType = 'PERMISSION_ERROR';
      } else if (error.message.includes('FILE_NOT_FOUND')) {
        errorType = 'NOT_FOUND_ERROR';
      }
      
      failedFiles.push({ 
        url, 
        error: error.message,
        errorType: errorType
      });
    }
  }
  
  console.log(`[DRIVE] Descarga completa: ${downloadedFiles.length} exitosos, ${failedFiles.length} fallidos`);
  
  if (downloadedFiles.length === 0 && failedFiles.length > 0) {
    const permissionErrors = failedFiles.filter(f => f.errorType === 'PERMISSION_ERROR');
    
    if (permissionErrors.length > 0) {
      throw new Error(`ERROR_PERMISOS_GOOGLE_DRIVE: No se pudo acceder a ningún archivo. Verificar permisos. Errores: ${permissionErrors.map(e => e.error).join(', ')}`);
    }
    
    throw new Error(`ERROR_DESCARGA: No se pudo descargar ningún archivo. Errores: ${failedFiles.map(e => e.error).join(', ')}`);
  }
  
  return downloadedFiles;
}

module.exports = {
  downloadDocuments
};