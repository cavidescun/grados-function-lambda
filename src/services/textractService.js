// ============================================================================
// src/services/textractService.js - COMPLETAMENTE SILENCIOSO excepto TyT
// ============================================================================

const AWS = require('aws-sdk');
const fs = require('fs-extra');
const { getCUNInstitutionsDictionary } = require('./dictionaryService');

const textract = new AWS.Textract({
  httpOptions: {
    timeout: 30000,
    retries: 3
  }
});

async function extractTextFromDocument(filePath) {
  try {
    const documentBuffer = await fs.readFile(filePath);
    const headerCheck = documentBuffer.slice(0, 20).toString();
    
    if (headerCheck.startsWith('<!DOCTYPE') || headerCheck.startsWith('<html') || headerCheck.startsWith('<!do')) {
      throw new Error('HTML_FILE_DETECTED');
    }
    
    const params = {
      Document: {
        Bytes: documentBuffer
      }
    };
    
    const result = await textract.detectDocumentText(params).promise();
    
    let extractedText = '';
    if (result.Blocks && result.Blocks.length > 0) {
      result.Blocks.forEach((block) => {
        if (block.BlockType === 'LINE') {
          extractedText += block.Text + ' ';
        }
      });
    }
    
    const trimmedText = extractedText.trim();
    if (trimmedText.length === 0) {
      throw new Error('NO_TEXT_EXTRACTED');
    }
    
    return trimmedText;
    
  } catch (error) {
    throw error;
  }
}

function validateTextWithDictionary(text, dictionary, minMatches = 2) {
  if (!text || !dictionary || dictionary.length === 0) {
    return false;
  }
  
  const normalizedText = text.toLowerCase();
  let matchCount = 0;
  
  for (const keyword of dictionary) {
    const normalizedKeyword = keyword.toLowerCase().trim();
    if (normalizedKeyword && normalizedText.includes(normalizedKeyword)) {
      matchCount++;
      if (matchCount >= minMatches) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Extracción TyT - ÚNICOS LOGS EN TODO EL SISTEMA
 */
async function extractTyTInformationFocused(text) {
  console.log(`[TYT] 🎯 INICIANDO EXTRACCIÓN TyT`);
  
  if (!text) {
    console.log(`[TYT] ❌ Texto vacío`);
    return {};
  }
  
  console.log(`[TYT] 📄 Texto (primeros 400 chars): "${text.substring(0, 400)}"`);
  
  const extractedData = {};
  
  // 1. NÚMERO DE DOCUMENTO
  console.log(`[TYT] 🔍 Buscando número de documento...`);
  const docPatterns = [
    /identificación:\s*c\.c\s*(\d{6,12})/gi,
    /identificación:\s*(\d{6,12})/gi,
    /c\.c\s*(\d{6,12})/gi,
    /cédula:\s*(\d{6,12})/gi
  ];
  
  for (let i = 0; i < docPatterns.length; i++) {
    const pattern = docPatterns[i];
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      extractedData.numDocumento = match[1];
      console.log(`[TYT] ✅ DOCUMENTO: ${extractedData.numDocumento} (patrón ${i+1})`);
      break;
    }
  }
  
  if (!extractedData.numDocumento) {
    console.log(`[TYT] ❌ Documento NO encontrado`);
    const allNumbers = text.match(/\d{6,12}/g);
    console.log(`[TYT] 🔢 Números candidatos:`, allNumbers?.slice(0, 5));
  }
  
  // 2. CÓDIGO EK
  console.log(`[TYT] 🔍 Buscando código EK...`);
  const ekPatterns = [
    /número\s+de\s+registro:\s*([A-Z]*\d+)/gi,
    /registro:\s*([A-Z]*\d+)/gi,
    /\bEK\s*(\d+)/gi
  ];
  
  for (let i = 0; i < ekPatterns.length; i++) {
    const pattern = ekPatterns[i];
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      let ek = match[1];
      if (!ek.startsWith('EK') && /^\d+$/.test(ek)) {
        ek = `EK${ek}`;
      }
      extractedData.registroEK = ek;
      console.log(`[TYT] ✅ EK: ${extractedData.registroEK} (patrón ${i+1})`);
      break;
    }
  }
  
  if (!extractedData.registroEK) {
    console.log(`[TYT] ❌ EK NO encontrado`);
    const ekCandidates = text.match(/EK\w*|registro\w*/gi);
    console.log(`[TYT] 📋 Candidatos EK:`, ekCandidates?.slice(0, 3));
  }
  
  // 3. INSTITUCIÓN
  console.log(`[TYT] 🔍 Buscando institución...`);
  const instPatterns = [
    /institución\s+de\s+educación\s+superior:\s*([^\n\r]+?)(?=programa|$)/gi,
    /(corporación\s+unificada\s+nacional[^\n\r]*)/gi,
    /institución:\s*([^\n\r]+?)(?=programa|$)/gi
  ];
  
  for (let i = 0; i < instPatterns.length; i++) {
    const pattern = instPatterns[i];
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      extractedData.institucion = match[1].trim();
      console.log(`[TYT] ✅ INSTITUCIÓN: ${extractedData.institucion} (patrón ${i+1})`);
      break;
    }
  }
  
  if (!extractedData.institucion) {
    console.log(`[TYT] ❌ Institución NO encontrada`);
    const cunKeywords = text.match(/corporaci[oó]n|unificada|nacional|cun/gi);
    console.log(`[TYT] 🏢 Keywords CUN:`, cunKeywords?.slice(0, 3));
  }
  
  // 4. PROGRAMA
  console.log(`[TYT] 🔍 Buscando programa...`);
  const progPatterns = [
    /programa\s+académico:\s*([^\n\r]+?)(?=2\.|reporte|$)/gi,
    /programa:\s*([^\n\r]+?)(?=2\.|reporte|$)/gi,
    /(técnico\s+profesional[^\n\r]*)/gi
  ];
  
  for (let i = 0; i < progPatterns.length; i++) {
    const pattern = progPatterns[i];
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      extractedData.programa = match[1].trim();
      console.log(`[TYT] ✅ PROGRAMA: ${extractedData.programa} (patrón ${i+1})`);
      break;
    }
  }
  
  if (!extractedData.programa) {
    console.log(`[TYT] ❌ Programa NO encontrado`);
    const progCandidates = text.match(/técnico|profesional|programa/gi);
    console.log(`[TYT] 📚 Keywords programa:`, progCandidates?.slice(0, 3));
  }
  
  // 5. FECHA
  console.log(`[TYT] 🔍 Buscando fecha...`);
  const datePatterns = [
    /aplicación\s+del\s+examen:\s*([^\n\r]+?)(?=publicación|$)/gi,
    /fecha\s+de\s+aplicación:\s*([^\n\r]+?)(?=publicación|$)/gi,
    /aplicado\s+el:\s*([^\n\r]+?)(?=publicación|$)/gi
  ];
  
  for (let i = 0; i < datePatterns.length; i++) {
    const pattern = datePatterns[i];
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      extractedData.fechaPresentacion = match[1].trim();
      console.log(`[TYT] ✅ FECHA: ${extractedData.fechaPresentacion} (patrón ${i+1})`);
      break;
    }
  }
  
  if (!extractedData.fechaPresentacion) {
    console.log(`[TYT] ❌ Fecha NO encontrada`);
    const dateCandidates = text.match(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g);
    console.log(`[TYT] 📅 Fechas candidatas:`, dateCandidates?.slice(0, 3));
  }
  
  // RESUMEN
  console.log(`[TYT] 📊 RESULTADO FINAL: ${Object.keys(extractedData).length}/5 campos extraídos`);
  console.log(`[TYT] 📋 DATOS EXTRAÍDOS:`, JSON.stringify(extractedData, null, 2));
  
  return extractedData;
}

async function extractInformation(text, documentType) {
  if (!text) {
    return {};
  }

  if (documentType === 'prueba_tt') {
    console.log(`[TYT] 🎯 PROCESANDO DOCUMENTO TyT`);
    return await extractTyTInformationFocused(text);
  }

  // Procesamiento silencioso para otros tipos
  const normalizedText = text.toLowerCase();
  const extractedInfo = {};
  
  switch (documentType) {
    case 'cedula':
      const numDocRegex = /[\d]{6,12}/g;
      const numDocMatches = normalizedText.match(numDocRegex);
      if (numDocMatches && numDocMatches.length > 0) {
        const numDoc = numDocMatches.reduce((a, b) => a.length > b.length ? a : b);
        extractedInfo.numDocumento = numDoc;
      }
      break;
      
    case 'icfes':
      const acRegex = /ac[\d]+/i;
      const acMatch = normalizedText.match(acRegex);
      if (acMatch) {
        extractedInfo.registroAC = acMatch[0].toUpperCase();
      }
      break;
  }
  
  return extractedInfo;
}

async function validateCUNInstitution(extractedInstitution) {
  if (!extractedInstitution || extractedInstitution === "Revision Manual") {
    return "NO";
  }
  
  try {
    const cunInstitutions = await getCUNInstitutionsDictionary();
    const normalizedExtracted = extractedInstitution.toLowerCase();
    
    for (const cunVariant of cunInstitutions) {
      if (normalizedExtracted.includes(cunVariant.toLowerCase()) || 
          cunVariant.toLowerCase().includes(normalizedExtracted)) {
        console.log(`[TYT] ✅ INSTITUCIÓN CUN VÁLIDA: ${cunVariant}`);
        return "SI";
      }
    }
    
    console.log(`[TYT] ❌ NO ES INSTITUCIÓN CUN VÁLIDA`);
    return "NO";
  } catch (error) {
    return "NO";
  }
}

module.exports = {
  extractTextFromDocument,
  validateTextWithDictionary,
  extractInformation,
  validateCUNInstitution
};