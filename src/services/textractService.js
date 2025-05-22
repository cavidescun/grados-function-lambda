const AWS = require('aws-sdk');
const fs = require('fs-extra');

const textract = new AWS.Textract({
  httpOptions: {
    timeout: 20000
  }
});

async function extractTextFromDocument(filePath) {
  try {
    console.log(`[TEXTRACT] Comenzando extracción para archivo: ${filePath}`);
    
    const documentBuffer = await fs.readFile(filePath);
    console.log(`[TEXTRACT] Archivo leído. Tamaño: ${documentBuffer.length} bytes`);
    
    const headerCheck = documentBuffer.slice(0, 20).toString();
    console.log(`[TEXTRACT] Header del archivo: "${headerCheck.substring(0, 10)}"`);
    
    if (headerCheck.startsWith('<!DOCTYPE') || headerCheck.startsWith('<html') || headerCheck.startsWith('<!do')) {
      console.log(`[TEXTRACT] Archivo HTML detectado. No procesable con Textract.`);
      throw new Error('HTML_FILE_DETECTED');
    }
    
    if (!headerCheck.startsWith('%PDF')) {
      console.log(`[TEXTRACT] Archivo no es PDF. Header: "${headerCheck}"`);
      
      if (documentBuffer[0] === 0xFF && documentBuffer[1] === 0xD8) {
        console.log(`[TEXTRACT] Archivo JPEG detectado, procesando...`);
      } else if (documentBuffer[0] === 0x89 && documentBuffer.slice(1, 4).toString() === 'PNG') {
        console.log(`[TEXTRACT] Archivo PNG detectado, procesando...`);
      } else {
        console.log(`[TEXTRACT] Tipo de archivo desconocido, intentando con Textract...`);
      }
    }
    
    const params = {
      Document: {
        Bytes: documentBuffer
      }
    };
    
    console.log(`[TEXTRACT] Llamando a Textract API...`);
    const startTime = Date.now();
    const result = await textract.detectDocumentText(params).promise();
    const endTime = Date.now();
    
    console.log(`[TEXTRACT] Respuesta recibida en ${endTime - startTime}ms`);
    console.log(`[TEXTRACT] Bloques detectados: ${result.Blocks ? result.Blocks.length : 0}`);
    
    let extractedText = '';
    
    if (result.Blocks && result.Blocks.length > 0) {
      result.Blocks.forEach((block, index) => {
        if (block.BlockType === 'LINE') {
          console.log(`[TEXTRACT] Línea ${index}: ${block.Text}`);
          extractedText += block.Text + ' ';
        }
      });
    }
    
    const trimmedText = extractedText.trim();
    console.log(`[TEXTRACT] Texto extraído: ${trimmedText.length} caracteres`);
    
    if (trimmedText.length === 0) {
      console.log(`[TEXTRACT] No se extrajo texto`);
      throw new Error('NO_TEXT_EXTRACTED');
    }
    
    return trimmedText;
    
  } catch (error) {
    console.error(`[TEXTRACT] Error: ${error.message}`);
    throw error;
  }
}

function validateTextWithDictionary(text, dictionary, minMatches = 2) {
  console.log(`[VALIDATE] Validando texto contra diccionario`);
  console.log(`[VALIDATE] Longitud del texto: ${text ? text.length : 0} caracteres`);
  console.log(`[VALIDATE] Tamaño del diccionario: ${dictionary ? dictionary.length : 0} palabras clave`);
  
  if (!text || !dictionary || dictionary.length === 0) {
    console.log(`[VALIDATE] Texto o diccionario inválidos`);
    return false;
  }
  
  const normalizedText = text.toLowerCase();
  let matchCount = 0;
  const matches = [];
  
  for (const keyword of dictionary) {
    const normalizedKeyword = keyword.toLowerCase().trim();
    
    if (!normalizedKeyword) continue;
    
    if (normalizedText.includes(normalizedKeyword)) {
      matchCount++;
      matches.push(normalizedKeyword);
      console.log(`[VALIDATE] Match #${matchCount}: "${normalizedKeyword}"`);
      
      if (matchCount >= minMatches) {
        console.log(`[VALIDATE] Documento validado con ${matchCount} coincidencias`);
        return true;
      }
    }
  }
  
  console.log(`[VALIDATE] Total coincidencias: ${matchCount}, requeridas: ${minMatches}`);
  return false;
}

function extractInformation(text, documentType) {
  console.log(`[EXTRACT] Extrayendo información para: ${documentType}`);
  
  if (!text) {
    return {};
  }
  
  const normalizedText = text.toLowerCase();
  const extractedInfo = {};
  
  switch (documentType) {
    case 'cedula':
      const numDocRegex = /[\d]{6,12}/g;
      const numDocMatches = normalizedText.match(numDocRegex);
      
      if (numDocMatches && numDocMatches.length > 0) {
        const numDoc = numDocMatches.reduce((a, b) => a.length > b.length ? a : b);
        extractedInfo.numDocumento = numDoc;
        console.log(`[EXTRACT] Número de documento: ${numDoc}`);
      }
      break;
      
    case 'icfes':
      const acRegex = /ac[\d]+/i;
      const acMatch = normalizedText.match(acRegex);
      if (acMatch) {
        extractedInfo.registroAC = acMatch[0].toUpperCase();
        console.log(`[EXTRACT] Registro AC: ${extractedInfo.registroAC}`);
      }
      break;
      
    case 'prueba_tt':
      const ekRegex = /ek[\d]+/i;
      const ekMatch = normalizedText.match(ekRegex);
      if (ekMatch) {
        extractedInfo.registroEK = ekMatch[0].toUpperCase();
        console.log(`[EXTRACT] Registro EK: ${extractedInfo.registroEK}`);
      }
      break;
  }
  
  return extractedInfo;
}

module.exports = {
  extractTextFromDocument,
  validateTextWithDictionary,
  extractInformation
};