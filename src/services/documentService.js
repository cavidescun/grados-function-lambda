const fs = require('fs-extra');
const path = require('path');
const { extractTextFromDocument, validateTextWithDictionary, extractInformation, validateCUNInstitution } = require('./textractService');
const { getDictionaryForDocumentType } = require('./dictionaryService');

async function processDocuments(inputData, downloadedFiles, documentUrls) {
  
  const output = {
    ID: inputData.ID,
    NombreCompleto: inputData.Nombre_completo || '',
    TipoDocumento: inputData.Tipo_de_documento || '',
    NumeroDocumento: inputData.Numero_de_Documento || '',
    Modalidad: inputData.Modalidad || '',
    NivelDeFormacionSolicitadoParaGrado: inputData.Nivel_de_formacion_del_cual_esta_solicitando_grado || '',
    ProgramaDelCualSolicita: inputData.Programa_del_cual_esta_solicitando_grado || '',
    CorreoInsitucional: inputData.Correo_electronico_institucional || '',
    CorreoPersonal: inputData.Correo_electronico_personal || '',
    FotocopiaDocumento: "N/A",
    DiplomayActaGradoBachiller: "N/A",
    DiplomayActaGradoTecnico: "N/A",
    DiplomayActaGradoTecnologo: "N/A",
    DiplomayActaGradoPregrado: "N/A",
    ResultadoSaberProDelNivelParaGrado: "N/A",
    ExamenIcfes_11: "N/A",
    RecibiDePagoDerechosDeGrado: "N/A",
    Encuesta_M0: "N/A",
    Acta_Homologacion: "N/A",
    
    EK: "Extraccion Manual",
    Autorización_tratamiento_de_datos: inputData.Autorizacion_tratamiento_de_datos || '',
    Num_Documento_Extraido: "Extraccion Manual",
    Institucion_Extraida: "Extraccion Manual",
    Programa_Extraido: "Extraccion Manual",
    Fecha_Presentacion_Extraida: "Extraccion Manual",
    Institucion_Valida: "N/A",
    Num_Doc_Valido: "N/A"
  };
  
  const documentMap = {};
  for (const file of downloadedFiles) {
    for (const [docType, url] of Object.entries(documentUrls)) {
      if (file.originalUrl === url) {
        documentMap[docType] = file;
        break;
      }
    }
  }
  
  await processDocumentType(documentMap, 'cedula', output, 'FotocopiaDocumento', inputData);
  await processDocumentType(documentMap, 'diploma_bachiller', output, 'DiplomayActaGradoBachiller', inputData);
  await processDocumentType(documentMap, 'diploma_tecnico', output, 'DiplomayActaGradoTecnico', inputData);
  await processDocumentType(documentMap, 'diploma_tecnologo', output, 'DiplomayActaGradoTecnologo', inputData);
  await processDocumentType(documentMap, 'titulo_profesional', output, 'DiplomayActaGradoPregrado', inputData);
  await processDocumentType(documentMap, 'prueba_tt', output, 'ResultadoSaberProDelNivelParaGrado', inputData);
  await processDocumentType(documentMap, 'icfes', output, 'ExamenIcfes_11', inputData);
  await processDocumentType(documentMap, 'recibo_pago', output, 'RecibiDePagoDerechosDeGrado', inputData);
  await processDocumentType(documentMap, 'encuesta_m0', output, 'Encuesta_M0', inputData);
  await processDocumentType(documentMap, 'acta_homologacion', output, 'Acta_Homologacion', inputData);
  return output;
}

async function processDocumentType(documentMap, docType, output, outputField, inputData) {

  if (!documentMap[docType]) {
    return; 
  }
  
  try {
    const file = documentMap[docType];
    
    if (!await fileExists(file.path)) {
      output[outputField] = "Revision Manual";
      return;
    }
    
    const validationResult = await validateDocument(file, docType, inputData);

    output[outputField] = mapDocumentStatus(validationResult.status);
    
    if (validationResult.extractedInfo) {
      await updateExtractedInformation(output, docType, validationResult.extractedInfo, inputData);
    }

  } catch (error) {
    console.error(`[DOC] Error procesando ${docType}:`, error);
    output[outputField] = "Revision Manual";
  }
}

function mapDocumentStatus(originalStatus) {
  
  switch (originalStatus) {
    case "Documento Valido":
      return "Valido";
    case "Revisión Manual":
    case "Revision Manual":
      return "Revision Manual";
    case "Documento no adjunto":
      return "N/A";
    default:
      console.warn(`[STATUS-MAP] Estado desconocido: ${originalStatus}, usando Revision Manual`);
      return "Revision Manual";
  }
}

async function validateDocument(file, docType, inputData) {

  const fileStats = await fs.stat(file.path);
  
  if (fileStats.size < 1000) {
    return { status: "Revisión Manual" };
  }
  
  try {
    const documentBuffer = await fs.readFile(file.path);
    const headerCheck = documentBuffer.slice(0, 20).toString();
    
    if (headerCheck.startsWith('<!DOCTYPE') || headerCheck.startsWith('<html') || headerCheck.startsWith('<!do')) {
      
      const isValidBySize = validateBySize(fileStats.size, docType);
      
      if (isValidBySize) {
        return { 
          status: "Documento Valido",
          validationMethod: "size-html",
          note: "HTML file with valid size - assuming Google Drive serving issue"
        };
      } else {
        return { status: "Revisión Manual" };
      }
    }
    
    const extractedText = await extractTextFromDocument(file.path);
    const dictionary = await getDictionaryForDocumentType(docType);
    
    const isValidByText = validateTextWithDictionary(extractedText, dictionary);
    
    if (isValidByText) {
      const extractedInfo = await extractInformation(extractedText, docType);
      return { 
        status: "Documento Valido", 
        extractedInfo: extractedInfo,
        validationMethod: "textract"
      };
    } else {
      return await alternativeValidation(file, docType, fileStats);
    }
    
  } catch (error) {
    return await alternativeValidation(file, docType, fileStats);
  }
}

function validateBySize(fileSize, docType) {

  const minSizes = {
    'cedula': 50000,
    'diploma_bachiller': 100000,
    'icfes': 80000,
    'prueba_tt': 80000,
    'encuesta_m0': 30000,
    'recibo_pago': 20000,
    'diploma_tecnico': 100000,
    'diploma_tecnologo': 100000,
    'titulo_profesional': 100000,
    'acta_homologacion': 50000
  };
  
  const minSize = minSizes[docType] || 25000;
  const isValid = fileSize >= minSize;
  
  return isValid;
}

async function alternativeValidation(file, docType, fileStats) {

  if (validateBySize(fileStats.size, docType)) {
    return { 
      status: "Documento Valido", 
      validationMethod: "alternative-size" 
    };
  }

  return { status: "Revisión Manual" };
}

async function updateExtractedInformation(output, docType, extractedInfo, inputData) {
  if (docType === 'cedula' && extractedInfo.numDocumento) {
    output.Num_Documento_Extraido = extractedInfo.numDocumento;
    
    const inputDocNum = (output.NumeroDocumento || '').replace(/\D/g, '');
    output.Num_Doc_Valido = (extractedInfo.numDocumento === inputDocNum) ? "SI" : "NO";
  }
  
  if (docType === 'icfes') {
    if (extractedInfo.institucion) {
      output.Institucion_Extraida = extractedInfo.institucion;
    }
    if (extractedInfo.registroAC) {
      const inputAC = inputData.Registro_AC_Numero_de_identificacion_de_las_pruebas_saber_11;
      output.Institucion_Valida = (extractedInfo.registroAC === inputAC) ? "SI" : "NO";
    }
  }
  
  if (docType === 'prueba_tt') {
    console.log(`[UPDATE] Procesando información específica de TyT`);

    if (extractedInfo.registroEK) {
      output.EK = extractedInfo.registroEK;
      console.log(`[UPDATE] EK extraído: ${extractedInfo.registroEK}`);
    }

    if (extractedInfo.numDocumento) {
      output.Num_Documento_Extraido = extractedInfo.numDocumento;
      console.log(`[UPDATE] Número documento extraído: ${extractedInfo.numDocumento}`);

      const inputDocNum = (output.NumeroDocumento || '').replace(/\D/g, '');
      const extractedDocNum = extractedInfo.numDocumento.replace(/\D/g, '');
      output.Num_Doc_Valido = (extractedDocNum === inputDocNum) ? "SI" : "NO";
    }

    if (extractedInfo.institucion) {
      output.Institucion_Extraida = extractedInfo.institucion;
      console.log(`[UPDATE] Institución extraída: ${extractedInfo.institucion}`);

      output.Institucion_Valida = await validateCUNInstitution(extractedInfo.institucion);
      console.log(`[UPDATE] Institución válida (CUN): ${output.Institucion_Valida}`);
    }

    if (extractedInfo.programa) {
      output.Programa_Extraido = extractedInfo.programa;
      console.log(`[UPDATE] Programa extraído: ${extractedInfo.programa}`);
    }

    if (extractedInfo.fechaPresentacion) {
      output.Fecha_Presentacion_Extraida = extractedInfo.fechaPresentacion;
      console.log(`[UPDATE] Fecha presentación extraída: ${extractedInfo.fechaPresentacion}`);
    }
  }
}

async function fileExists(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile() && stats.size > 0;
  } catch (error) {
    return false;
  }
}

module.exports = {
  processDocuments
};