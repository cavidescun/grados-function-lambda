require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

async function getTokens() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('ERROR: Necesitas GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env');
    process.exit(1);
  }
  
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
  
  console.log('\n🔐 PASO 1: Autorización');
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
    console.log('\n📋 COPIA ESTOS VALORES para las variables de entorno de Lambda:');
    console.log('─'.repeat(70));
    console.log('GOOGLE_ACCESS_TOKEN=' + tokens.access_token);
    console.log('GOOGLE_REFRESH_TOKEN=' + (tokens.refresh_token || ''));
    console.log('GOOGLE_TOKEN_EXPIRY=' + (tokens.expiry_date || Date.now() + 3600000));
    console.log('─'.repeat(70));
    
    // Guardar en archivo para referencia
    const fs = require('fs');
    fs.writeFileSync('tokens-backup.txt', `
GOOGLE_ACCESS_TOKEN=${tokens.access_token}
GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || ''}
GOOGLE_TOKEN_EXPIRY=${tokens.expiry_date || Date.now() + 3600000}
    `.trim());
    
    console.log('\n💾 Tokens también guardados en: tokens-backup.txt');
    console.log('⚠️  NO subas este archivo a control de versiones!');
    
  } catch (error) {
    console.error('❌ Error obteniendo tokens:', error.message);
  }
}

getTokens().catch(console.error);
