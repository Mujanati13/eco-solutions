const { google } = require('googleapis');
const { pool } = require('../../config/database');

class GoogleAuthService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Scopes for Google Sheets access - includes broader Drive access for listing files
    this.scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly', // Read-only access to all Drive files
      'https://www.googleapis.com/auth/drive.file', // Access to files created by the app
      'profile',
      'email'
    ];
  }

  // Generate authorization URL
  generateAuthUrl(userId) {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      prompt: 'consent',
      state: userId // Pass user ID to identify who's authenticating
    });

    return authUrl;
  }

  // Exchange authorization code for tokens
  async getTokens(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  // Store tokens in database for a user
  async storeUserTokens(userId, tokens) {
    try {
      const { access_token, refresh_token, expiry_date } = tokens;
      
      // Store or update tokens in database
      await pool.query(`
        INSERT INTO user_google_tokens (user_id, access_token, refresh_token, expiry_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
        access_token = VALUES(access_token),
        refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
        expiry_date = VALUES(expiry_date),
        updated_at = NOW()
      `, [userId, access_token, refresh_token || null, new Date(expiry_date)]);

      console.log(`Google tokens stored for user ${userId}`);
    } catch (error) {
      console.error('Error storing user tokens:', error);
      throw new Error('Failed to store user tokens');
    }
  }

  // Get valid tokens for a user
  async getUserTokens(userId) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM user_google_tokens WHERE user_id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return null;
      }

      const tokenData = rows[0];
      const now = new Date();

      // Check if token is expired
      if (tokenData.expiry_date && new Date(tokenData.expiry_date) <= now) {
        // Try to refresh the token
        if (tokenData.refresh_token) {
          try {
            const newTokens = await this.refreshUserTokens(userId, tokenData.refresh_token);
            return newTokens;
          } catch (error) {
            console.error('Failed to refresh tokens:', error);
            
            // If refresh token is expired, clear the tokens
            if (error.message === 'REFRESH_TOKEN_EXPIRED') {
              console.log('Refresh token expired, user needs to re-authenticate');
              return null;
            }
            
            return null;
          }
        } else {
          console.log('Token expired and no refresh token available');
          return null;
        }
      }

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expiry_date: tokenData.expiry_date
      };
    } catch (error) {
      console.error('Error getting user tokens:', error);
      return null;
    }
  }

  // Refresh tokens for a user
  async refreshUserTokens(userId, refreshToken) {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      // Update tokens in database
      await this.storeUserTokens(userId, credentials);

      return credentials;
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      
      // Handle specific error cases
      if (error.code === 400 && (error.message?.includes('invalid_grant') || error.response?.data?.error === 'invalid_grant')) {
        // Refresh token is invalid/expired - user needs to re-authenticate
        console.log(`Refresh token expired for user ${userId}. Clearing stored tokens.`);
        await this.clearUserTokens(userId);
        throw new Error('REFRESH_TOKEN_EXPIRED');
      }
      
      throw new Error('Failed to refresh tokens');
    }
  }

  // Create authenticated sheets client for a user
  async getSheetsClient(userId) {
    try {
      const tokens = await this.getUserTokens(userId);
      
      if (!tokens) {
        throw new Error('No valid Google tokens found for user');
      }

      const authClient = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      authClient.setCredentials(tokens);

      return google.sheets({ version: 'v4', auth: authClient });
    } catch (error) {
      console.error('Error creating sheets client:', error);
      throw new Error('Failed to create authenticated Google Sheets client');
    }
  }

  // Clear user tokens from database
  async clearUserTokens(userId) {
    try {
      const query = 'DELETE FROM google_user_tokens WHERE user_id = ?';
      await pool.execute(query, [userId]);
      console.log(`Cleared tokens for user ${userId}`);
    } catch (error) {
      console.error('Error clearing user tokens:', error);
      throw error;
    }
  }

  // Check if user has valid Google authentication
  async isUserAuthenticated(userId) {
    try {
      const tokens = await this.getUserTokens(userId);
      
      // If no tokens, user is not authenticated
      if (!tokens) {
        return false;
      }
      
      // Additional check: try to create a sheets client to verify tokens work
      try {
        const sheetsClient = await this.getSheetsClient(userId);
        return true;
      } catch (error) {
        // If sheets client creation fails, tokens are invalid
        console.log(`Tokens invalid for user ${userId}, clearing...`);
        await this.clearUserTokens(userId);
        return false;
      }
    } catch (error) {
      console.error('Error checking user authentication:', error);
      return false;
    }
  }

  // Revoke user's Google authentication
  async revokeUserAuth(userId) {
    try {
      const tokens = await this.getUserTokens(userId);
      
      if (tokens && tokens.access_token) {
        // Revoke the token with Google
        try {
          await this.oauth2Client.revokeToken(tokens.access_token);
        } catch (error) {
          console.error('Error revoking token with Google:', error);
        }
      }

      // Remove tokens from database
      await pool.query('DELETE FROM user_google_tokens WHERE user_id = ?', [userId]);
      
      console.log(`Google authentication revoked for user ${userId}`);
    } catch (error) {
      console.error('Error revoking user auth:', error);
      throw new Error('Failed to revoke Google authentication');
    }
  }

  // Get user's Google profile information
  async getUserProfile(userId) {
    try {
      const authClient = await this.getAuthenticatedClient(userId);
      const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
      const { data } = await oauth2.userinfo.get();
      
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  // Get authenticated client for a user
  async getAuthenticatedClient(userId) {
    try {
      const tokens = await this.getUserTokens(userId);
      
      if (!tokens) {
        throw new Error('No valid Google tokens found for user');
      }

      const authClient = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      authClient.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      });

      return authClient;
    } catch (error) {
      console.error('Error creating authenticated client:', error);
      throw new Error('Failed to create authenticated Google client');
    }
  }

  // Get authenticated Google Sheets client for a user
  async getSheetsClient(userId) {
    try {
      const authClient = await this.getAuthenticatedClient(userId);
      return google.sheets({ version: 'v4', auth: authClient });
    } catch (error) {
      console.error('Error creating sheets client:', error);
      throw new Error('Failed to create authenticated Google Sheets client');
    }
  }
}

module.exports = new GoogleAuthService();
