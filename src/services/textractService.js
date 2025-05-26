const AWS = require('aws-sdk');
const fs = require('fs-extra');
const { getCUNInstitutionsDictionary } = require('./dictionaryService');

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

async function extractTyTInformation(text) {
  console.log(`[EXTRACT-TYT] Extrayendo información específica de TyT`);
  
  if (!text) {
    console.log(`[EXTRACT-TYT] Texto vacío`);
    return {};
  }
  
  const extractedInfo = {};
  console.log(`[EXTRACT-TYT] Buscando código EK...`);
  const ekRegex = /EK\s*[\d]+/gi;
  const ekMatches = text.match(ekRegex);
  if (ekMatches && ekMatches.length > 0) {
    extractedInfo.registroEK = ekMatches[0].replace(/\s+/g, '').toUpperCase();
    console.log(`[EXTRACT-TYT] EK encontrado: ${extractedInfo.registroEK}`);
  } else {
    console.log(`[EXTRACT-TYT] No se encontró código EK`);
  }
  console.log(`[EXTRACT-TYT] Buscando número de documento...`);
  const docRegex = /(?:documento|identificación|cedula|c\.c|cc|id)[\s:]*(\d{6,12})/gi;
  const docMatches = text.match(docRegex);
  if (docMatches && docMatches.length > 0) {
    const numDocMatch = docMatches[0].match(/(\d{6,12})/);
    if (numDocMatch) {
      extractedInfo.numDocumento = numDocMatch[1];
      console.log(`[EXTRACT-TYT] Número de documento encontrado: ${extractedInfo.numDocumento}`);
    }
  } else {
    const numRegex = /\b\d{8,12}\b/g;
    const numMatches = text.match(numRegex);
    if (numMatches && numMatches.length > 0) {
      extractedInfo.numDocumento = numMatches[0];
      console.log(`[EXTRACT-TYT] Posible número de documento encontrado: ${extractedInfo.numDocumento}`);
    } else {
      console.log(`[EXTRACT-TYT] No se encontró número de documento`);
    }
  }
  console.log(`[EXTRACT-TYT] Buscando institución...`);
  try {
    const cunInstitutions = await getCUNInstitutionsDictionary();
    const normalizedText = text.toLowerCase();
    let institutionFound = false;
    
    for (const institution of cunInstitutions) {
      const normalizedInstitution = institution.toLowerCase();
      if (normalizedText.includes(normalizedInstitution)) {
        extractedInfo.institucion = institution;
        institutionFound = true;
        console.log(`[EXTRACT-TYT] Institución encontrada: ${institution}`);
        break;
      }
    }
    
    if (!institutionFound) {
      extractedInfo.institucion = "Revision Manual";
      console.log(`[EXTRACT-TYT] No se encontró institución CUN válida`);
    }
  } catch (error) {
    console.error(`[EXTRACT-TYT] Error cargando diccionario CUN:`, error.message);
    extractedInfo.institucion = "Revision Manual";
  }

  console.log(`[EXTRACT-TYT] Buscando programa...`);
  const programRegex = /(?:programa|carrera|título)[\s:]*([^.\n\r]{10,100})/gi;
  const programMatches = text.match(programRegex);
  if (programMatches && programMatches.length > 0) {
    let programa = programMatches[0].replace(/(?:programa|carrera|título)[\s:]*/gi, '').trim();
    programa = programa.split(/[.\n\r]/)[0].trim();
    if (programa.length > 5) {
      extractedInfo.programa = programa;
      console.log(`[EXTRACT-TYT] Programa encontrado: ${programa}`);
    }
  } else {
    const techRegex = /(?:técnico|tecnico|tecnólogo|tecnologo|profesional)\s+en\s+([^.\n\r]{5,80})/gi;
    const techMatches = text.match(techRegex);
    if (techMatches && techMatches.length > 0) {
      extractedInfo.programa = techMatches[0].trim();
      console.log(`[EXTRACT-TYT] Programa técnico encontrado: ${extractedInfo.programa}`);
    } else {
      console.log(`[EXTRACT-TYT] No se encontró programa específico`);
    }
  }

  console.log(`[EXTRACT-TYT] Buscando fecha de presentación...`);
  const dateRegex = /(?:fecha|presentación|aplicación|realización)[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/gi;
  const dateMatches = text.match(dateRegex);
  if (dateMatches && dateMatches.length > 0) {
    const fechaMatch = dateMatches[0].match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/);
    if (fechaMatch) {
      extractedInfo.fechaPresentacion = fechaMatch[1];
      console.log(`[EXTRACT-TYT] Fecha de presentación encontrada: ${extractedInfo.fechaPresentacion}`);
    }
  } else {
    const generalDateRegex = /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/g;
    const generalDates = text.match(generalDateRegex);
    if (generalDates && generalDates.length > 0) {
      extractedInfo.fechaPresentacion = generalDates[0];
      console.log(`[EXTRACT-TYT] Posible fecha encontrada: ${extractedInfo.fechaPresentacion}`);
    } else {
      console.log(`[EXTRACT-TYT] No se encontró fecha de presentación`);
    }
  }
  
  return extractedInfo;
}

async function extractInformation(text, documentType) {
  console.log(`[EXTRACT] Extrayendo información para: ${documentType}`);
  
  if (!text) {
    return {};
  }

  if (documentType === 'prueba_tt') {
    return await extractTyTInformation(text);
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
  }
  
  return extractedInfo;
}

async function validateCUNInstitution(extractedInstitution) {
  console.log(`[VALIDATE-CUN] Validando institución: ${extractedInstitution}`);
  
  if (!extractedInstitution || extractedInstitution === "Revision Manual") {
    console.log(`[VALIDATE-CUN] Institución requiere revisión manual`);
    return "NO";
  }
  
  try {
    const cunInstitutions = await getCUNInstitutionsDictionary();
    const normalizedExtracted = extractedInstitution.toLowerCase();
    
    for (const cunVariant of cunInstitutions) {
      if (normalizedExtracted.includes(cunVariant.toLowerCase()) || 
          cunVariant.toLowerCase().includes(normalizedExtracted)) {
        console.log(`[VALIDATE-CUN] Institución válida encontrada: ${cunVariant}`);
        return "SI";
      }
    }
    
    console.log(`[VALIDATE-CUN] Institución no es CUN válida`);
    return "NO";
  } catch (error) {
    console.error(`[VALIDATE-CUN] Error validando institución:`, error.message);
    return "NO";
  }
}

module.exports = {
  extractTextFromDocument,
  validateTextWithDictionary,
  extractInformation,
  validateCUNInstitution
};