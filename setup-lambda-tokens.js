require('dotenv').config();
const AWS = require('aws-sdk');
const GoogleAuthService = require('./src/services/googleAuthService');
const readline = require('readline');

// Configurar AWS
AWS.config.update({ region: 'us-east-1' }); // Cambia por tu región
const ssm = new AWS.SSM();

async function setupLambdaTokens() {
  try {
    console.log('=== CONFIGURACIÓN DE TOKENS PARA LAMBDA ===\n');
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.error('ERROR: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben estar en .env');
      process.exit(1);
    }
    
    console.log('1. Obteniendo tokens de Google...\n');
    
    const authService = new GoogleAuthService(clientId, clientSecret);
    
    // Verificar si ya tenemos tokens locales
    let tokens;
    try {
      const credentials = await authService.initializeAuth();
      tokens = await authService.loadTokens();
      console.log('✅ Tokens locales encontrados');
    } catch (error) {
      if (error.message.includes('AUTHORIZATION_REQUIRED')) {
        console.log('🔐 Se requiere autorización...\n');
        
        const authUrl = await authService.getAuthUrl();
        console.log('Visita esta URL:', authUrl);
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        
        const authCode = await new Promise((resolve) => {
          rl.question('\nPega el código de autorización: ', resolve);
        });
        rl.close();
        
        tokens = await authService.exchangeCodeForTokens(authCode.trim());
        console.log('✅ Tokens obtenidos');
      } else {
        throw error;
      }
    }
    
    console.log('\n2. Subiendo tokens a AWS Parameter Store...\n');
    
    // Subir tokens a Parameter Store
    const parameterPromises = [
      ssm.putParameter({
        Name: '/google-drive/access-token',
        Value: tokens.access_token,
        Type: 'SecureString',
        Overwrite: true,
        Description: 'Google Drive Access Token para Lambda'
      }).promise(),
      
      ssm.putParameter({
        Name: '/google-drive/refresh-token',
        Value: tokens.refresh_token || '',
        Type: 'SecureString',
        Overwrite: true,
        Description: 'Google Drive Refresh Token para Lambda'
      }).promise(),
      
      ssm.putParameter({
        Name: '/google-drive/token-expiry',
        Value: tokens.expiry_date.toString(),
        Type: 'String',
        Overwrite: true,
        Description: 'Google Drive Token Expiry para Lambda'
      }).promise()
    ];
    
    await Promise.all(parameterPromises);
    
    console.log('✅ Tokens subidos a AWS Parameter Store:');
    console.log('   - /google-drive/access-token');
    console.log('   - /google-drive/refresh-token');
    console.log('   - /google-drive/token-expiry');
    
    console.log('\n3. Configurando variables de entorno para Lambda...\n');
    console.log('Agrega estas variables de entorno a tu función Lambda:');
    console.log(`GOOGLE_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
    
    console.log('\n✅ ¡Configuración completa!');
    console.log('Ya puedes desplegar tu función Lambda.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupLambdaTokens();