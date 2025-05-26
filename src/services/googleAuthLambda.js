const { google } = require('googleapis');

class GoogleAuthLambda {
  constructor(clientId, clientSecret) {
    this.clientId = clientId || process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    
    this.scopes = [
      'https://www.googleapis.com/auth/drive.readonly'
    ];
  }
  
  async getStoredTokens() {
    try {
      console.log('[LAMBDA-AUTH] Obteniendo tokens de variables de entorno...');
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
      
      if (!refreshToken) {
        throw new Error('NO_REFRESH_TOKEN: No se encontró GOOGLE_REFRESH_TOKEN en variables de entorno');
      }
      
      console.log('[LAMBDA-AUTH] Refresh token obtenido de variables de entorno exitosamente');
      console.log(`[LAMBDA-AUTH] Refresh token: ${refreshToken ? 'Presente' : 'Ausente'}`);
      
      return {
        refresh_token: refreshToken
      };
      
    } catch (error) {
      console.log('[LAMBDA-AUTH] Error obteniendo tokens:', error.message);
      throw error;
    }
  }
  
  async refreshAccessToken(refreshToken) {
    try {
      console.log('[LAMBDA-AUTH] Generando nuevo access token...');
      
      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        'urn:ietf:wg:oauth:2.0:oob'
      );
      
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      console.log('[LAMBDA-AUTH] Access token generado exitosamente');
      console.log(`[LAMBDA-AUTH] Token expira en: ${new Date(credentials.expiry_date).toISOString()}`);
      
      return credentials;
      
    } catch (error) {
      console.error('[LAMBDA-AUTH] Error generando access token:', error.message);
      throw new Error(`Error generando access token: ${error.message}`);
    }
  }
  
  async getValidAccessToken() {
    try {
      console.log('[LAMBDA-AUTH] Obteniendo access token válido...');
      
      const tokens = await this.getStoredTokens();
      
      if (!tokens || !tokens.refresh_token) {
        throw new Error('NO_REFRESH_TOKEN: No se encontró refresh token en variables de entorno');
      }
      
      console.log('[LAMBDA-AUTH] Generando nuevo access token con refresh token...');
      const newTokens = await this.refreshAccessToken(tokens.refresh_token);
      
      return newTokens.access_token;
      
    } catch (error) {
      console.error('[LAMBDA-AUTH] Error obteniendo access token:', error.message);
      throw error;
    }
  }
  
  async initializeAuth() {
    try {
      console.log('[LAMBDA-AUTH] Inicializando autenticación...');
      if (!this.clientId) {
        throw new Error('NO_CLIENT_ID: Variable de entorno GOOGLE_CLIENT_ID no configurada');
      }
      
      if (!this.clientSecret) {
        throw new Error('NO_CLIENT_SECRET: Variable de entorno GOOGLE_CLIENT_SECRET no configurada');
      }
      
      const accessToken = await this.getValidAccessToken();
      console.log('[LAMBDA-AUTH] Autenticación exitosa');
      
      return {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        access_token: accessToken,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      };
    } catch (error) {
      console.error('[LAMBDA-AUTH] Error en autenticación:', error.message);
      throw error;
    }
  }
}

module.exports = GoogleAuthLambda;