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
  'acta_homologacion': 'DiccionarioActaHomologacion.txt'
};

const dictionaryCache = {};

async function loadDictionary(dictionaryFileName) {
  try {
    console.log(`[DICT] Cargando diccionario: ${dictionaryFileName}`);
    
    if (dictionaryCache[dictionaryFileName]) {
      console.log(`[DICT] Utilizando diccionario en caché para: ${dictionaryFileName}`);
      return dictionaryCache[dictionaryFileName];
    }
    
    const dictionaryPath = path.join(process.cwd(), 'dictionaries', dictionaryFileName);
    console.log(`[DICT] Ruta al diccionario: ${dictionaryPath}`);
    
    if (!await fs.pathExists(dictionaryPath)) {
      console.warn(`[DICT] Archivo de diccionario no encontrado: ${dictionaryPath}`);
      console.log(`[DICT] Usando diccionario embebido como alternativa`);
      return getEmbeddedDictionary(dictionaryFileName);
    }
    
    const content = await fs.readFile(dictionaryPath, 'utf8');
    const keywords = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    dictionaryCache[dictionaryFileName] = keywords;
    
    console.log(`[DICT] Diccionario cargado: ${dictionaryFileName} con ${keywords.length} palabras clave`);
    console.log(`[DICT] Primeras 5 palabras clave: ${keywords.slice(0, 5).join(', ')}`);
    
    return keywords;
  } catch (error) {
    console.error(`[DICT] Error cargando diccionario ${dictionaryFileName}:`, error);
    console.log(`[DICT] Usando diccionario embebido como respaldo`);
    return getEmbeddedDictionary(dictionaryFileName);
  }
}

async function getDictionaryForDocumentType(documentType) {
  console.log(`[DICT] Solicitando diccionario para tipo de documento: ${documentType}`);
  
  const dictionaryFileName = dictionaryMapping[documentType];
  
  if (!dictionaryFileName) {
    console.warn(`[DICT] No se encontró mapeo de diccionario para el tipo: ${documentType}`);
    return [];
  }
  
  console.log(`[DICT] Usando archivo de diccionario: ${dictionaryFileName}`);
  return await loadDictionary(dictionaryFileName);
}

function getEmbeddedDictionary(dictionaryFileName) {
  console.log(`[DICT] Generando diccionario embebido para: ${dictionaryFileName}`);
  
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
    ]
  };
  
  const dictionary = embeddedDictionaries[dictionaryFileName] || [];
  console.log(`[DICT] Diccionario embebido generado con ${dictionary.length} palabras clave`);
  
  return dictionary;
}

async function preloadDictionaries() {
  console.log(`[DICT] Precargando todos los diccionarios...`);
  
  for (const dictionaryFile of Object.values(dictionaryMapping)) {
    console.log(`[DICT] Precargando: ${dictionaryFile}`);
    await loadDictionary(dictionaryFile);
  }
  
  console.log(`[DICT] Precarga completa de ${Object.values(dictionaryMapping).length} diccionarios`);
}

module.exports = {
  getDictionaryForDocumentType,
  preloadDictionaries
};