# PDF Processor Lambda

Una función AWS Lambda para procesar documentos PDF de Google Drive, extraer información y validar documentos para trámites académicos.

## Funcionalidades

- Descarga documentos PDF desde Google Drive
- Valida varios tipos de documentos (cédula, diplomas, resultados de pruebas, etc.)
- Extrae información relevante de los documentos
- Genera un informe estructurado en formato JSON

## Requisitos

- Node.js 22+
- AWS Lambda
- Permisos para acceder a archivos en Google Drive

## Estructura del Proyecto
pdf-processor-lambda/
├── src/
│   ├── index.js                 // Punto de entrada de la función Lambda
│   ├── services/
│   │   ├── documentService.js   // Manejo de validación y extracción de PDF
│   │   └── driveService.js      // Interacción con Google Drive
│   └── utils/
│       └── tempStorage.js       // Manejo de almacenamiento temporal
├── package.json
├── serverless.yml               // Configuración de despliegue
└── README.md

## Configuración

Antes de desplegar la función, necesitarás:

1. Credenciales de API de Google
   - Client ID
   - Client Secret

2. Configurar Variables de Entorno:
   - `GOOGLE_CLIENT_ID`: Tu Client ID de Google
   - `GOOGLE_CLIENT_SECRET`: Tu Client Secret de Google

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
  "Autorizacion_tratamiento_de_datos": "Agreed",
  "googleCredentials": {
    "client_id": "tu_client_id",
    "client_secret": "tu_client_secret"
  }
}