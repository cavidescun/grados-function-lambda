require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

async function setupLambdaTokens() {
  try {
    console.log('=== CONFIGURACIÓN DE TOKENS PARA LAMBDA ===\n');
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.error('ERROR: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben estar en .env');
      process.exit(1);
    }
    
    console.log('1. Obteniendo refresh token de Google...\n');
    
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.readonly'],
      prompt: 'consent'
    });
    
    console.log('🔐 PASO 1: Autorización');
    console.log('Visita esta URL en tu navegador:');
    console.log(authUrl);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const authCode = await new Promise((resolve) => {
      rl.question('\n📋 PASO 2: Pega el código de autorización aquí: ', resolve);
    });
    rl.close();
    
    try {
      const { tokens } = await oauth2Client.getToken(authCode.trim());
      
      console.log('\n✅ Tokens obtenidos exitosamente!');
      console.log('\n📋 CONFIGURA ESTAS VARIABLES DE ENTORNO EN TU FUNCIÓN LAMBDA:');
      console.log('─'.repeat(70));
      console.log(`GOOGLE_CLIENT_ID=${clientId}`);
      console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('─'.repeat(70));
      
      // Guardar en archivo para referencia
      const fs = require('fs');
      const envContent = `
# Variables de entorno para AWS Lambda
GOOGLE_CLIENT_ID=${clientId}
GOOGLE_CLIENT_SECRET=${clientSecret}
GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}
      `.trim();
      
      fs.writeFileSync('lambda-env-variables.txt', envContent);
      
      console.log('\n💾 Variables también guardadas en: lambda-env-variables.txt');
      console.log('\n📝 INSTRUCCIONES PARA AWS LAMBDA:');
      console.log('1. Ve a tu función Lambda en AWS Console');
      console.log('2. En la pestaña "Configuration" → "Environment variables"');
      console.log('3. Agrega las 3 variables mostradas arriba');
      console.log('4. Guarda los cambios');
      console.log('\n⚠️  IMPORTANTE: NO subas lambda-env-variables.txt a control de versiones!');
      console.log('\n✅ ¡Configuración completa! Ya puedes desplegar tu función Lambda.');
      
    } catch (error) {
      console.error('❌ Error obteniendo tokens:', error.message);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupLambdaTokens();