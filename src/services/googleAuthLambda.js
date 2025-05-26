const { google } = require('googleapis');

class GoogleAuthLambda {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    
    this.scopes = [
      'https://www.googleapis.com/auth/drive.readonly'
    ];
  }
  
  async getStoredTokens() {
    try {
      console.log('[LAMBDA-AUTH] Obteniendo tokens de variables de entorno...');
      
      // Leer desde variables de entorno en lugar de Parameter Store
      const tokens = {
        access_token: process.env.GOOGLE_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        expiry_date: process.env.GOOGLE_TOKEN_EXPIRY ? 
          parseInt(process.env.GOOGLE_TOKEN_EXPIRY) : 
          (Date.now() + 3600000) // 1 hora por defecto
      };
      
      if (!tokens.refresh_token && !tokens.access_token) {
        throw new Error('NO_TOKENS_FOUND: No se encontraron GOOGLE_ACCESS_TOKEN ni GOOGLE_REFRESH_TOKEN en variables de entorno');
      }
      
      console.log('[LAMBDA-AUTH] Tokens obtenidos de variables de entorno exitosamente');
      console.log(`[LAMBDA-AUTH] Access token: ${tokens.access_token ? 'Presente' : 'Ausente'}`);
      console.log(`[LAMBDA-AUTH] Refresh token: ${tokens.refresh_token ? 'Presente' : 'Ausente'}`);
      
      return tokens;
      
    } catch (error) {
      console.log('[LAMBDA-AUTH] Error obteniendo tokens:', error.message);
      throw error;
    }
  }
  
  async isTokenValid(tokens) {
    if (!tokens || !tokens.access_token) {
      console.log('[LAMBDA-AUTH] No hay access_token para validar');
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
      
      // Nota: Los nuevos tokens NO se guardan en variables de entorno
      // porque no se pueden modificar durante la ejecución de Lambda
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
        throw new Error('NO_TOKENS_FOUND: No se encontraron tokens en variables de entorno');
      }
      
      // Si tenemos access_token y es válido, usarlo
      if (tokens.access_token && await this.isTokenValid(tokens)) {
        console.log('[LAMBDA-AUTH] Usando access token existente');
        return tokens.access_token;
      }
      
      // Si no tenemos access_token válido pero sí refresh_token, renovar
      if (tokens.refresh_token) {
        console.log('[LAMBDA-AUTH] Access token expirado o ausente, renovando con refresh_token...');
        const newTokens = await this.refreshAccessToken(tokens.refresh_token);
        return newTokens.access_token;
      }
      
      // Si no hay refresh_token, usar access_token aunque esté expirado (como último recurso)
      if (tokens.access_token) {
        console.log('[LAMBDA-AUTH] ADVERTENCIA: Usando access token posiblemente expirado');
        return tokens.access_token;
      }
      
      throw new Error('NO_VALID_TOKENS: No hay tokens válidos disponibles');
      
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