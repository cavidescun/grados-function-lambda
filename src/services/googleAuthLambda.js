const { google } = require('googleapis');
const AWS = require('aws-sdk');

class GoogleAuthLambda {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.parameterStore = new AWS.SSM();
    
    this.scopes = [
      'https://www.googleapis.com/auth/drive.readonly'
    ];
  }
  
  async getStoredTokens() {
    try {
      console.log('[LAMBDA-AUTH] Obteniendo tokens de AWS Parameter Store...');
      
      const promises = [
        this.parameterStore.getParameter({
          Name: '/google-drive/access-token',
          WithDecryption: true
        }).promise(),
        
        this.parameterStore.getParameter({
          Name: '/google-drive/refresh-token',
          WithDecryption: true
        }).promise(),
        
        this.parameterStore.getParameter({
          Name: '/google-drive/token-expiry',
          WithDecryption: false
        }).promise()
      ];
      
      const [accessTokenParam, refreshTokenParam, expiryParam] = await Promise.all(promises);
      
      const tokens = {
        access_token: accessTokenParam.Parameter.Value,
        refresh_token: refreshTokenParam.Parameter.Value,
        expiry_date: parseInt(expiryParam.Parameter.Value)
      };
      
      console.log('[LAMBDA-AUTH] Tokens obtenidos de Parameter Store exitosamente');
      return tokens;
      
    } catch (error) {
      console.log('[LAMBDA-AUTH] No se encontraron tokens almacenados:', error.message);
      return null;
    }
  }
  
  async storeTokens(tokens) {
    try {
      console.log('[LAMBDA-AUTH] Guardando tokens en AWS Parameter Store...');
      
      const promises = [
        this.parameterStore.putParameter({
          Name: '/google-drive/access-token',
          Value: tokens.access_token,
          Type: 'SecureString',
          Overwrite: true
        }).promise(),
        
        this.parameterStore.putParameter({
          Name: '/google-drive/refresh-token',
          Value: tokens.refresh_token || '',
          Type: 'SecureString',
          Overwrite: true
        }).promise(),
        
        this.parameterStore.putParameter({
          Name: '/google-drive/token-expiry',
          Value: tokens.expiry_date.toString(),
          Type: 'String',
          Overwrite: true
        }).promise()
      ];
      
      await Promise.all(promises);
      console.log('[LAMBDA-AUTH] Tokens guardados exitosamente en Parameter Store');
      
    } catch (error) {
      console.error('[LAMBDA-AUTH] Error guardando tokens:', error.message);
      throw error;
    }
  }
  
  async isTokenValid(tokens) {
    if (!tokens || !tokens.access_token) {
      return false;
    }
    
    const expiryTime = new Date(tokens.expiry_date);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    const isValid = expiryTime > fiveMinutesFromNow;
    console.log(`[LAMBDA-AUTH] Token válido: ${isValid} (expira: ${expiryTime.toISOString()})`);
    
    return isValid;
  }
  
  async refreshAccessToken(refreshToken) {
    try {
      console.log('[LAMBDA-AUTH] Renovando access token...');
      
      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        'urn:ietf:wg:oauth:2.0:oob'
      );
      
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      console.log('[LAMBDA-AUTH] Access token renovado exitosamente');
      
      await this.storeTokens(credentials);
      return credentials;
      
    } catch (error) {
      console.error('[LAMBDA-AUTH] Error renovando token:', error.message);
      throw new Error(`Error renovando access token: ${error.message}`);
    }
  }
  
  async getValidAccessToken() {
    try {
      console.log('[LAMBDA-AUTH] Obteniendo access token válido...');
      
      let tokens = await this.getStoredTokens();
      
      if (!tokens) {
        throw new Error('NO_TOKENS_FOUND: No se encontraron tokens en Parameter Store');
      }
      
      if (await this.isTokenValid(tokens)) {
        console.log('[LAMBDA-AUTH] Usando access token existente');
        return tokens.access_token;
      }
      
      if (tokens.refresh_token) {
        console.log('[LAMBDA-AUTH] Token expirado, renovando...');
        const newTokens = await this.refreshAccessToken(tokens.refresh_token);
        return newTokens.access_token;
      }
      
      throw new Error('REFRESH_TOKEN_MISSING: No hay refresh token disponible');
      
    } catch (error) {
      console.error('[LAMBDA-AUTH] Error obteniendo access token:', error.message);
      throw error;
    }
  }
  
  async initializeAuth() {
    try {
      console.log('[LAMBDA-AUTH] Inicializando autenticación...');
      
      const accessToken = await this.getValidAccessToken();
      console.log('[LAMBDA-AUTH] Autenticación exitosa');
      
      return {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        access_token: accessToken
      };
    } catch (error) {
      console.error('[LAMBDA-AUTH] Error en autenticación:', error.message);
      throw error;
    }
  }
}

module.exports = GoogleAuthLambda;