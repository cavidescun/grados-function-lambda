const fs = require('fs-extra');
const path = require('path');

const dictionaryMapping = {
  'cedula': 'Diccionario_Documentos_Identidad.txt',
  'diploma_bachiller': 'DiccionarioActayDiplomaBachiller.txt',
  'diploma_tecnico': 'DiccionarioActayDiplomaTecnico.txt',
  'diploma_tecnologo': 'DiccionarioActayDiplomaTecnologo.txt',
  'titulo_profesional': 'DiccionarioActayDiplomaPregrado.txt',
  'prueba_tt': 'DiccionarioTYT.txt',
  'icfes': 'DiccionarioIcfes.txt',
  'recibo_pago': 'DiccionarioPagoDerechosDeGrado.txt',
  'encuesta_m0': 'DiccionarioEncuestaSeguimiento.txt',
  'acta_homologacion': 'DiccionarioActaHomologacion.txt',
  'cun_institutions': 'DiccionarioCUN.txt'
};

const dictionaryCache = {};

async function loadDictionary(dictionaryFileName) {
  try {
    
    if (dictionaryCache[dictionaryFileName]) {
      return dictionaryCache[dictionaryFileName];
    }
    
    const dictionaryPath = path.join(process.cwd(), 'dictionaries', dictionaryFileName);
    if (!await fs.pathExists(dictionaryPath)) {
      return getEmbeddedDictionary(dictionaryFileName);
    }
    
    const content = await fs.readFile(dictionaryPath, 'utf8');
    const keywords = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    dictionaryCache[dictionaryFileName] = keywords;

    
    return keywords;
  } catch (error) {
    return getEmbeddedDictionary(dictionaryFileName);
  }
}

async function getDictionaryForDocumentType(documentType) {
  
  const dictionaryFileName = dictionaryMapping[documentType];
  
  if (!dictionaryFileName) {
    console.warn(`[DICT] No se encontró mapeo de diccionario para el tipo: ${documentType}`);
    return [];
  }
  return await loadDictionary(dictionaryFileName);
}

async function getCUNInstitutionsDictionary() {
  return await loadDictionary('DiccionarioCUN.txt');
}

function getEmbeddedDictionary(dictionaryFileName) {  
  const embeddedDictionaries = {
    'Diccionario_Documentos_Identidad.txt': [
      'Cédula de Ciudadania', 'Cedula de Ciudadania', 'Cédula', 'Cedula',
      'Pasaporte', 'República de Colombia', 'Republica de Colombia',
      'Tarjeta', 'Identidad', 'Registrador', 'Colombia'
    ],
    'DiccionarioActayDiplomaBachiller.txt': [
      'Bachiller académico', 'Bachiller Técnico', 'Bachiller', 'Diploma',
      'institución', 'Colegio', 'Acta'
    ],
    'DiccionarioActayDiplomaTecnico.txt': [
      'Técnico', 'Técnica', 'Tecnico', 'Tecnica'
    ],
    'DiccionarioActayDiplomaTecnologo.txt': [
      'Tecnólogo', 'Tecnología', 'Tecnologo', 'Tecnologia'
    ],
    'DiccionarioActayDiplomaPregrado.txt': [
      'Ingeniería', 'Licenciado', 'Administrador', 'Abogado',
      'Profesional', 'Diploma', 'Acta', 'Grado'
    ],
    'DiccionarioTYT.txt': [
      'Saber TyT', 'Saber T', 'Técnico', 'Tecnólogo', 'Icfes',
      'Puntaje Global', 'Percentil', 'Pruebas'
    ],
    'DiccionarioIcfes.txt': [
      'Saber 11', 'educación superior', 'Icfes', 'Registro',
      'Puntaje', 'Reporte De Resultados'
    ],
    'DiccionarioPagoDerechosDeGrado.txt': [
      'Aprobado', 'pago', 'transaccion', 'banco', 'total', 'pagado',
      'exitoso', 'detalle del pago', 'referencia'
    ],
    'DiccionarioEncuestaSeguimiento.txt': [
      'Constancia', 'Mejoramiento', 'Observatorio', 'Laboral',
      'Encuesta', 'Seguimiento', 'Graduados', 'SNIES'
    ],
    'DiccionarioActaHomologacion.txt': [
      'Homologación', 'Homologacion', 'Materias', 'asignaturas',
      'créditos', 'creditos', 'equivalencia'
    ],
    'DiccionarioCUN.txt': [
      'Corporación Unificada Nacional de Educación Superior',
      'Corporacion Unificada Nacional de Educacion Superior',
      'CUN', 'C.U.N.',
      'Corporación Unificada N. de E. Superior',
      'Corporación Unificada Nacional de E. Superior',
      'Corporación Unificada Nacional de Educación Sup.',
      'Corporación Unificada Nacional de Educ. Superior',
      'Corporacion Unificada Nacional de Educacion Sup.',
      'Corporacion Unificada N. de E. Superior',
      'Corporacion Unificada Nacional de E. Superior',
      'Corporacion Unificada Nacional de Educación Sup.',
      'Corporacion Unificada Nacional de Educ. Superior',
      'Corporacion Unificada Nacional De Educacion Superior-Cun-Bogotá D.C.',
      'Corporacion Unificada Nacional De Educacion Superior-Cun',
      'Corporacion Unificada Nacional',
      'Corporacion Unificada',
      'CORPORACION UNIFICADA NACIONAL',
      'Nacional De Educacion Superior',
      'cun'
    ]
  };
  
  const dictionary = embeddedDictionaries[dictionaryFileName] || [];
  
  return dictionary;
}

async function preloadDictionaries() {
  
  for (const dictionaryFile of Object.values(dictionaryMapping)) {
    await loadDictionary(dictionaryFile);
  }
}

module.exports = {
  getDictionaryForDocumentType,
  getCUNInstitutionsDictionary,
  preloadDictionaries
};