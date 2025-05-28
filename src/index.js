const { downloadDocuments } = require('./services/driveService');
const { processDocuments } = require('./services/documentService');
const { cleanupTempFiles } = require('./utils/tempStorage');
const { preloadDictionaries } = require('./services/dictionaryService');
const fs = require('fs-extra');
const path = require('path');

async function ensureDictionariesDir() {
  const dirPath = path.join(process.cwd(), 'dictionaries');
  await fs.ensureDir(dirPath);
  return dirPath;
}

async function saveDictionaries(dictionaries) {
  const dirPath = await ensureDictionariesDir();
  
  for (const [fileName, content] of Object.entries(dictionaries)) {
    const filePath = path.join(dirPath, fileName);
    await fs.writeFile(filePath, content);
  }
}

exports.handler = async (event, context) => {  
  try {
    let requestBody;
    if (typeof event.body === 'string') {
      requestBody = JSON.parse(event.body);
    } else {
      requestBody = event.body || {};
    }
    if (requestBody.dictionaries) {
      await saveDictionaries(requestBody.dictionaries);
    }
    await preloadDictionaries();
    const documentUrls = extractDocumentUrls(requestBody);
    
    if (Object.keys(documentUrls).length === 0) {
      console.warn('[MAIN] No se encontraron URLs de documentos en la solicitud');
      return formatResponse(400, { 
        error: 'No document URLs found', 
        message: 'No se encontraron URLs de documentos válidas en la solicitud',
        received_fields: Object.keys(requestBody)
      });
    }
    const startDownload = Date.now();
    
    try {
      const downloadedFiles = await downloadDocuments(Object.values(documentUrls));
      if (downloadedFiles.length === 0) {
        console.warn('[MAIN] No se descargó ningún archivo');
        return formatResponse(400, {
          error: 'No files downloaded',
          message: 'No se pudo descargar ningún archivo de las URLs proporcionadas'
        });
      }
      const startProcessing = Date.now();
      const result = await processDocuments(requestBody, downloadedFiles, documentUrls);
      return formatResponse(200, result);
      
    } catch (downloadError) {
      
      if (downloadError.message.includes('ERROR_PERMISOS_GOOGLE_DRIVE')) {
        console.log('[MAIN] Error de permisos de Google Drive detectado');
        return formatResponse(403, { 
          error: 'Google Drive Permission Error', 
          message: 'Los archivos de Google Drive no son accesibles. Verificar que sean públicos o que el sistema tenga los permisos necesarios.',
          details: downloadError.message.replace('ERROR_PERMISOS_GOOGLE_DRIVE: ', ''),
          solution: 'Asegúrese de que los archivos de Google Drive estén configurados como públicos o que el sistema tenga los permisos necesarios para acceder a ellos.'
        });
      }
      
      if (downloadError.message.includes('ERROR_TOKENS_NO_CONFIGURADOS')) {
        console.log('[MAIN] Error de tokens no configurados detectado');
        return formatResponse(500, {
          error: 'Google Drive Authentication Error',
          message: 'Los tokens de Google Drive no están configurados en AWS Parameter Store.',
          details: downloadError.message.replace('ERROR_TOKENS_NO_CONFIGURADOS: ', ''),
          solution: 'Ejecutar el script setup-lambda-tokens.js para configurar los tokens de autenticación.'
        });
      }
      
      if (downloadError.message.includes('ERROR_DESCARGA')) {
        console.log('[MAIN] Error de descarga general detectado');
        return formatResponse(400, { 
          error: 'Download Error', 
          message: 'No se pudieron descargar los archivos solicitados.',
          details: downloadError.message.replace('ERROR_DESCARGA: ', ''),
          solution: 'Verificar que las URLs de Google Drive sean válidas y que los archivos existan.'
        });
      }
      
      if (downloadError.message.includes('Could not extract file ID')) {
        console.log('[MAIN] Error de formato de URL detectado');
        return formatResponse(400, {
          error: 'Invalid URL Format',
          message: 'Una o más URLs de Google Drive tienen formato inválido.',
          details: downloadError.message,
          solution: 'Verificar que las URLs tengan el formato correcto de Google Drive.'
        });
      }
      
      console.log('[MAIN] Error de descarga no categorizado');
      return formatResponse(500, {
        error: 'Download Failed',
        message: 'Error inesperado durante la descarga de archivos.',
        details: downloadError.message
      });
    }
    
  } catch (error) {
    console.error('[MAIN] ERROR general en procesamiento:', error);
    console.error('[MAIN] Stack:', error.stack);
    
    if (error.message.includes('JSON')) {
      console.log('[MAIN] Error de parsing JSON detectado');
      return formatResponse(400, {
        error: 'Invalid JSON',
        message: 'El cuerpo de la solicitud no contiene JSON válido.',
        details: error.message
      });
    }
    
    if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
      console.log('[MAIN] Error de timeout detectado');
      return formatResponse(408, {
        error: 'Request Timeout',
        message: 'La solicitud tardó demasiado tiempo en procesarse.',
        details: error.message,
        solution: 'Intentar con menos documentos o verificar la conectividad.'
      });
    }
    
    console.log('[MAIN] Error general no categorizado');
    return formatResponse(500, { 
      error: 'Internal Server Error', 
      message: 'Error interno del servidor durante el procesamiento.',
      details: error.message,
      timestamp: new Date().toISOString()
    });
    
  } finally {
    try {
      await cleanupTempFiles();
    } catch (cleanupError) {
      console.error('[MAIN] Error durante la limpieza:', cleanupError.message);
    }
    console.log('[MAIN] Procesamiento finalizado.');
  }
};

function extractDocumentUrls(inputData) {
  const documentUrls = {};
  
  const documentFields = [
    { field: 'Copia_de_cedula', key: 'cedula' },
    { field: 'Diploma_y_acta_de_bachiller', key: 'diploma_bachiller' },
    { field: 'Icfes', key: 'icfes' },
    { field: 'diploma_tecnico', key: 'diploma_tecnico' },
    { field: 'diploma_tecnologo', key: 'diploma_tecnologo' },
    { field: 'Titulo_profesional', key: 'titulo_profesional' },
    { field: 'Prueba_T_T', key: 'prueba_tt' },
    { field: 'Soporte_de_encuesta_momento_0', key: 'encuesta_m0' },
    { field: 'Acta_de_homologacion', key: 'acta_homologacion' },
    { field: 'Recibo_de_pago_derechos_de_grado', key: 'recibo_pago' }
  ];
  
  // SOLO verificar TyT
  const pruebaT_T_value = inputData['Prueba_T_T'];
  if (pruebaT_T_value) {
    console.log(`[TYT] 🎯 CAMPO Prueba_T_T ENCONTRADO: ${pruebaT_T_value.substring(0, 60)}...`);
  } else {
    console.log(`[TYT] ❌ CAMPO Prueba_T_T NO ENCONTRADO`);
    console.log(`[TYT] 📋 Campos disponibles:`, Object.keys(inputData));
    return {}; // Si no hay TyT, no procesar nada
  }
  
  for (const doc of documentFields) {
    const fieldValue = inputData[doc.field];
    
    if (fieldValue && typeof fieldValue === 'string') {
      if (fieldValue.includes('drive.google.com') || fieldValue.includes('docs.google.com')) {
        documentUrls[doc.key] = fieldValue;
        
        // SOLO log para TyT
        if (doc.key === 'prueba_tt') {
          console.log(`[TYT] ✅ URL TyT MAPEADA CORRECTAMENTE`);
        }
      }
    }
  }
  
  // Verificar mapeo final de TyT
  if (documentUrls.prueba_tt) {
    console.log(`[TYT] ✅ TyT INCLUIDO EN DOCUMENTOS A PROCESAR`);
  } else {
    console.log(`[TYT] ❌ TyT NO INCLUIDO EN DOCUMENTOS A PROCESAR`);
  }
  
  return documentUrls;
}

function formatResponse(statusCode, body) {
  const response = {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'X-Request-Time': new Date().toISOString()
    },
    body: JSON.stringify(body, null, statusCode >= 400 ? 2 : 0)
  };
  
  return response;
}