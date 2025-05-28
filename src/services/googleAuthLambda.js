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
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
      
      if (!refreshToken) {
        throw new Error('NO_REFRESH_TOKEN: No se encontró GOOGLE_REFRESH_TOKEN en variables de entorno');
      }
      return {
        refresh_token: refreshToken
      };
      
    } catch (error) {
      throw error;
    }
  }
  
  async refreshAccessToken(refreshToken) {
    try {

      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        'urn:ietf:wg:oauth:2.0:oob'
      );
      
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      return credentials;
      
    } catch (error) {
      throw new Error(`Error generando access token: ${error.message}`);
    }
  }
  
  async getValidAccessToken() {
    try {

      const tokens = await this.getStoredTokens();
      
      if (!tokens || !tokens.refresh_token) {
        throw new Error('NO_REFRESH_TOKEN: No se encontró refresh token en variables de entorno');
      }
      const newTokens = await this.refreshAccessToken(tokens.refresh_token);
      
      return newTokens.access_token;
      
    } catch (error) {
      console.error('[LAMBDA-AUTH] Error obteniendo access token:', error.message);
      throw error;
    }
  }
  
  async initializeAuth() {
    try {
      if (!this.clientId) {
        throw new Error('NO_CLIENT_ID: Variable de entorno GOOGLE_CLIENT_ID no configurada');
      }
      
      if (!this.clientSecret) {
        throw new Error('NO_CLIENT_SECRET: Variable de entorno GOOGLE_CLIENT_SECRET no configurada');
      }
      
      const accessToken = await this.getValidAccessToken();

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