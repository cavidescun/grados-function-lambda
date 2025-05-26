# PDF Processor Lambda

Una función AWS Lambda para procesar documentos PDF de Google Drive, extraer información y validar documentos para trámites académicos.

## Funcionalidades

- Descarga documentos PDF desde Google Drive
- Valida varios tipos de documentos (cédula, diplomas, resultados de pruebas, etc.)
- Extrae información relevante de los documentos
- Genera un informe estructurado en formato JSON

## Requisitos

- Node.js 18+
- AWS Lambda
- Cuenta de Google Cloud con API de Google Drive habilitada

## Estructura del Proyecto
```
pdf-processor-lambda/
├── src/
│   ├── index.js                 // Punto de entrada de la función Lambda
│   ├── services/
│   │   ├── documentService.js   // Manejo de validación y extracción de PDF
│   │   ├── driveService.js      // Interacción con Google Drive
│   │   ├── googleAuthLambda.js  // Autenticación Google para Lambda
│   │   ├── dictionaryService.js // Manejo de diccionarios de validación
│   │   └── textractService.js   // Integración con AWS Textract
│   └── utils/
│       └── tempStorage.js       // Manejo de almacenamiento temporal
├── dictionaries/                // Diccionarios de validación por tipo de documento
├── package.json
├── build-lambda.js              // Script de construcción para despliegue
├── setup-lambda-tokens.js       // Script de configuración de tokens Google
└── README.md
```

## Configuración

### 1. Configurar Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google Drive
4. Ve a "Credenciales" → "Crear credenciales" → "ID de cliente OAuth 2.0"
5. Configura como "Aplicación de escritorio"
6. Descarga las credenciales y guarda `client_id` y `client_secret`

### 2. Configurar Variables de Entorno Locales

Crea un archivo `.env` en el directorio raíz:

```bash
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
```

### 3. Generar Refresh Token

Ejecuta el script de configuración:

```bash
npm run setup-tokens
```

Este script:
1. Te pedirá autorizar la aplicación en tu navegador
2. Generará un refresh token
3. Creará un archivo `lambda-env-variables.txt` con las variables necesarias

### 4. Configurar Variables de Entorno en AWS Lambda

En tu función Lambda, configura estas variables de entorno:

```bash
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
GOOGLE_REFRESH_TOKEN=tu_refresh_token_aqui
```

## Despliegue

### 1. Construir el paquete

```bash
npm run build
```

Esto generará `lambda-deployment.zip` listo para subir a AWS Lambda.

### 2. Configurar AWS Lambda

1. **Runtime**: `nodejs18.x`
2. **Handler**: `src/index.handler`
3. **Timeout**: 300 segundos (5 minutos)
4. **Memoria**: 1024 MB o más
5. **Variables de entorno**: Las 3 variables de Google configuradas arriba

### 3. Permisos IAM

Tu función Lambda necesita estos permisos:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "textract:DetectDocumentText"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

## Uso

La función Lambda espera recibir un objeto JSON con la siguiente estructura:

```json
{
  "ID": 2521,
  "Hora_agregado": "08-Apr-2025 17:28:08",
  "Direccion_IP": "186.86.49.45",
  "Nombre_completo": "NOMBRE, APELLIDO",
  "Tipo_de_documento": "CC Cédula de ciudadanía",
  "Numero_de_Documento": "1234567890",
  "Correo_electronico_institucional": "correo@institucion.edu.co",
  "Correo_electronico_personal": "correo@personal.com",
  "Numero_de_Telefono_celular": "1234567890",
  "Nivel_de_formacion_del_cual_esta_solicitando_grado": "Técnico Profesional",
  "Programa_del_cual_esta_solicitando_grado": "NOMBRE DEL PROGRAMA",
  "Modalidad": "Virtual",
  "Copia_de_cedula": "https://drive.google.com/file/d/ID/view",
  "Diploma_y_acta_de_bachiller": "https://drive.google.com/file/d/ID/view",
  "Icfes": "https://drive.google.com/file/d/ID/view",
  "Prueba_T_T": "https://drive.google.com/file/d/ID/view",
  "Soporte_de_encuesta_momento_0": "https://drive.google.com/file/d/ID/view",
  "Autorizacion_tratamiento_de_datos": "Agreed"
}
```

### Tipos de Documentos Soportados

- **Copia_de_cedula**: Cédula de ciudadanía
- **Diploma_y_acta_de_bachiller**: Diploma de bachillerato
- **diploma_tecnico**: Diploma técnico
- **diploma_tecnologo**: Diploma tecnólogo  
- **Titulo_profesional**: Título profesional universitario
- **Icfes**: Resultados ICFES Saber 11
- **Prueba_T_T**: Resultados Saber TyT
- **Soporte_de_encuesta_momento_0**: Encuesta de seguimiento
- **Acta_de_homologacion**: Acta de homologación
- **Recibo_de_pago_derechos_de_grado**: Recibo de pago

## Respuesta

La función retorna un JSON estructurado con el estado de validación de cada documento:

```json
{
  "ID": 2521,
  "NombreCompleto": "NOMBRE, APELLIDO",
  "TipoDocumento": "CC Cédula de ciudadanía",
  "NumeroDocumento": "1234567890",
  "FotocopiaDocumento": "Valido",
  "DiplomayActaGradoBachiller": "Valido",
  "ExamenIcfes_11": "Valido",
  "ResultadoSaberProDelNivelParaGrado": "Valido",
  "Encuesta_M0": "N/A",
  "EK": "EK123456789",
  "Num_Documento_Extraido": "1234567890",
  "Num_Doc_Valido": "SI"
}
```

### Estados Posibles

- **"Valido"**: El documento fue procesado exitosamente y es válido
- **"Revision Manual"**: El documento requiere revisión manual por un operador  
- **"N/A"**: No se proporcionó URL para este tipo de documento

## Scripts Disponibles

### `npm run build`
Construye el paquete ZIP para despliegue en AWS Lambda.

### `npm run setup-tokens`
Configura los tokens de Google Drive necesarios para la autenticación.

### `npm run clean`
Limpia archivos temporales y de build.

### `npm run validate`
Valida la sintaxis del código JavaScript.

## Solución de Problemas

### Error: "ERROR_TOKENS_NO_CONFIGURADOS"
**Causa**: Las variables de entorno de Google no están configuradas.
**Solución**: 
1. Ejecutar `npm run setup-tokens`
2. Configurar las variables de entorno en AWS Lambda

### Error: "ERROR_PERMISOS_GOOGLE_DRIVE"
**Causa**: Los archivos de Google Drive no son accesibles.
**Soluciones**:
1. Verificar que los archivos sean públicos
2. Verificar que las URLs sean correctas
3. Verificar que los tokens tengan permisos adecuados

### Error: "HTML_FILE_DETECTED"
**Causa**: Google Drive devolvió una página HTML en lugar del archivo.
**Solución**: El sistema implementa validación por tamaño como alternativa.

### Timeout en Lambda
**Causa**: Procesamiento de muchos documentos o archivos grandes.
**Soluciones**:
1. Aumentar el timeout de Lambda (máximo 15 minutos)
2. Aumentar la memoria asignada
3. Procesar menos documentos por invocación

## Arquitectura

### Flujo de Procesamiento

1. **Recepción**: Lambda recibe solicitud con URLs de Google Drive
2. **Autenticación**: Se autentica con Google Drive usando refresh token
3. **Descarga**: Descarga archivos desde Google Drive
4. **Extracción**: Usa AWS Textract para extraer texto de documentos
5. **Validación**: Compara texto extraído con diccionarios específicos
6. **Respuesta**: Retorna resultados estructurados

### Métodos de Validación

1. **Por contenido**: Extrae texto con Textract y valida contra diccionarios
2. **Por tamaño**: Para archivos no procesables, valida basándose en tamaño mínimo
3. **Híbrido**: Combina ambos métodos para mayor robustez

### Manejo de Errores

- **Categorización automática** de tipos de error
- **Fallback a descarga pública** si la autenticación falla
- **Cleanup automático** de archivos temporales
- **Logging detallado** para debugging

## Seguridad

- **Tokens OAuth2** con renovación automática
- **Cleanup automático** de archivos temporales
- **Variables de entorno** para credenciales sensibles
- **Permisos mínimos** requeridos en AWS

## Limitaciones

- **Tamaño máximo de archivo**: Limitado por AWS Textract (5 MB para síncronos)
- **Tipos de archivo**: Principalmente PDF, JPEG, PNG
- **Timeout**: Máximo 15 minutos en AWS Lambda
- **Memoria**: Dependiente de los archivos procesados

## Contribución

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.