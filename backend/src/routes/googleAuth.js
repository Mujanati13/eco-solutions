const express = require('express');
const { google } = require('googleapis');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const googleAuthService = require('../services/googleAuth');

const router = express.Router();

// Generate Google OAuth authorization URL
router.get('/auth/google', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const authUrl = googleAuthService.generateAuthUrl(userId);
    
    res.json({
      authUrl,
      message: 'Visit this URL to authorize access to Google Sheets'
    });
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

// Handle Google OAuth callback
router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    // Handle OAuth errors
    if (error) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ 
                type: 'GOOGLE_AUTH_ERROR', 
                error: '${error}' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }
    
    if (!code) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ 
                type: 'GOOGLE_AUTH_ERROR', 
                error: 'Authorization code not provided' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    if (!state) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ 
                type: 'GOOGLE_AUTH_ERROR', 
                error: 'User ID not provided in state parameter' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    const userId = parseInt(state);
    
    // Exchange code for tokens
    const tokens = await googleAuthService.getTokens(code);
    
    // Store tokens for the user
    await googleAuthService.storeUserTokens(userId, tokens);
    
    // Get user profile to confirm connection
    const profile = await googleAuthService.getUserProfile(userId);
    
    // Send success message to parent window and close popup
    res.send(`
      <html>
        <body>
          <script>
            window.opener?.postMessage({ 
              type: 'GOOGLE_AUTH_SUCCESS', 
              profile: ${JSON.stringify(profile)} 
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    res.send(`
      <html>
        <body>
          <script>
            window.opener?.postMessage({ 
              type: 'GOOGLE_AUTH_ERROR', 
              error: 'Failed to complete Google authorization' 
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  }
});

// Check Google authentication status
router.get('/auth/google/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAuthenticated = await googleAuthService.isUserAuthenticated(userId);
    
    let profile = null;
    if (isAuthenticated) {
      profile = await googleAuthService.getUserProfile(userId);
    }
    
    res.json({
      isAuthenticated,
      profile
    });
  } catch (error) {
    console.error('Error checking Google auth status:', error);
    res.status(500).json({ error: 'Failed to check authentication status' });
  }
});

// Revoke Google authentication
router.delete('/auth/google', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await googleAuthService.revokeUserAuth(userId);
    
    res.json({
      message: 'Google Sheets access revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking Google auth:', error);
    res.status(500).json({ error: 'Failed to revoke Google authentication' });
  }
});

// Test Google Sheets connection
router.get('/test-connection', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const googleSheetsService = require('../services/googleSheets');
    
    const canAccess = await googleSheetsService.canUserAccessSheets(userId);
    
    if (!canAccess) {
      return res.status(401).json({ 
        error: 'Not authorized to access Google Sheets',
        authRequired: true
      });
    }
    
    // Try to list some sheets to test connection instead of requiring a specific spreadsheet ID
    try {
      const sheets = await googleSheetsService.listUserGoogleSheets(userId, 3); // List up to 3 sheets
      
      res.json({
        message: 'Google Sheets connection successful',
        connectionTest: 'passed',
        availableSheets: sheets.length,
        sampleSheets: sheets.slice(0, 2) // Show first 2 as samples
      });
    } catch (listError) {
      console.log('❌ Failed to list sheets, trying basic auth test:', listError.message);
      
      // Fallback: just verify we can authenticate
      const authClient = await googleAuthService.getAuthenticatedClient(userId);
      if (authClient) {
        res.json({
          message: 'Google authentication successful (basic test)',
          connectionTest: 'basic_auth_only',
          note: 'Authentication works but sheet listing may need additional permissions'
        });
      } else {
        throw new Error('Authentication failed');
      }
    }
  } catch (error) {
    console.error('Error testing Google Sheets connection:', error);
    res.status(500).json({ error: 'Failed to test Google Sheets connection' });
  }
});

// List user's Google Sheets files
router.get('/list-sheets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const googleSheetsService = require('../services/googleSheets');
    
    const result = await googleSheetsService.listUserGoogleSheets(userId);
    
    res.json({
      success: true,
      sheets: result,
      message: 'Google Sheets listed successfully'
    });
  } catch (error) {
    console.error('Error listing Google Sheets:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to list Google Sheets files',
      details: error.message 
    });
  }
});

// Get spreadsheet tabs/sheets
router.get('/spreadsheet/:id/tabs', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const spreadsheetId = req.params.id;
    const googleSheetsService = require('../services/googleSheets');
    
    const result = await googleSheetsService.getSpreadsheetTabs(userId, spreadsheetId);
    
    res.json({
      success: true,
      sheets: result,
      spreadsheetId: spreadsheetId,
      message: 'Spreadsheet tabs retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting spreadsheet tabs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get spreadsheet tabs',
      details: error.message 
    });
  }
});

// Preview sheet data
router.get('/spreadsheet/:id/preview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const spreadsheetId = req.params.id;
    const sheetName = req.query.sheet || 'Sheet1';
    const range = req.query.range || `${sheetName}!A1:Z10`; // Preview first 10 rows
    const googleSheetsService = require('../services/googleSheets');
    
    const result = await googleSheetsService.getSheetData(userId, spreadsheetId, range);
    
    res.json({
      success: true,
      values: result.values || [],
      range: range,
      message: 'Sheet data preview retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting sheet preview:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get sheet preview',
      details: error.message 
    });
  }
});

// Import orders from Google Sheet
router.post('/import-orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { spreadsheetId, sheetName, range } = req.body;
    const googleSheetsService = require('../services/googleSheets');
    
    if (!spreadsheetId || !sheetName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: spreadsheetId and sheetName'
      });
    }
    
    // Construct the sheet range - if specific range provided, use it, otherwise use sheetName
    const sheetRange = range || sheetName;
    
    const result = await googleSheetsService.importOrdersFromSheet(spreadsheetId, sheetRange, userId);
    
    if (!result.success) {
      return res.json({
        success: false,
        message: result.message || 'No orders found in the specified range',
        count: result.total || 0,
        imported: result.imported || 0,
        errors: result.errors || []
      });
    }
    
    res.json({
      success: true,
      message: `Successfully imported ${result.imported} orders from Google Sheets to database`,
      count: result.total,
      imported: result.imported,
      errors: result.errors || []
    });
  } catch (error) {
    console.error('Error importing orders:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to import orders from Google Sheet',
      details: error.message 
    });
  }
});

// Debug route to test authentication and basic connectivity
router.get('/debug-user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userInfo = {
      userId: userId,
      username: req.user.username,
      role: req.user.role
    };

    // Test if user has Google tokens
    const hasTokens = await googleAuthService.isUserAuthenticated(userId);
    
    res.json({
      success: true,
      user: userInfo,
      hasGoogleAuth: hasTokens,
      message: 'Debug info retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Debug route failed',
      details: error.message 
    });
  }
});

// Debug route to test Google Drive access
router.get('/debug-drive', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const googleSheetsService = require('../services/googleSheets');
    
    // Get authenticated client
    const auth = await googleAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });
    
    console.log('🔍 Testing Google Drive access...');
    
    // Test basic Drive access
    const aboutResponse = await drive.about.get({
      fields: 'user,storageQuota'
    });
    
    console.log('✅ Drive access successful:', aboutResponse.data.user);
    
    // Test comprehensive file listing with different queries
    const queries = [
      {
        name: 'all_spreadsheets',
        query: "mimeType='application/vnd.google-apps.spreadsheet'",
        description: 'All spreadsheets accessible to user'
      },
      {
        name: 'owned_spreadsheets',
        query: "mimeType='application/vnd.google-apps.spreadsheet' and 'me' in owners",
        description: 'Spreadsheets owned by user'
      },
      {
        name: 'shared_spreadsheets',
        query: "mimeType='application/vnd.google-apps.spreadsheet' and sharedWithMe=true",
        description: 'Spreadsheets shared with user'
      },
      {
        name: 'recent_spreadsheets',
        query: "mimeType='application/vnd.google-apps.spreadsheet'",
        orderBy: 'modifiedTime desc',
        description: 'Recent spreadsheets'
      },
      {
        name: 'all_files_no_filter',
        query: '',
        description: 'All files (no mime type filter)'
      },
      {
        name: 'not_trashed',
        query: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        description: 'Non-trashed spreadsheets'
      }
    ];
    
    const results = {};
    const allFiles = new Set();
    
    for (const queryInfo of queries) {
      try {
        console.log(`🔍 Running query: ${queryInfo.name} - ${queryInfo.description}`);
        
        const params = {
          q: queryInfo.query,
          fields: 'files(id, name, owners, shared, mimeType, createdTime, modifiedTime, webViewLink, size)',
          pageSize: 100
        };
        
        if (queryInfo.orderBy) {
          params.orderBy = queryInfo.orderBy;
        }
        
        const response = await drive.files.list(params);
        
        const files = response.data.files.map(f => {
          allFiles.add(f.id);
          return {
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            isOwner: f.owners && f.owners.some(owner => owner.me),
            isShared: f.shared,
            createdTime: f.createdTime,
            modifiedTime: f.modifiedTime,
            webViewLink: f.webViewLink,
            size: f.size
          };
        });
        
        results[queryInfo.name] = {
          query: queryInfo.query,
          description: queryInfo.description,
          count: files.length,
          files: files
        };
        
        console.log(`✅ Query ${queryInfo.name}: Found ${files.length} files`);
        
        // Log sample files
        if (files.length > 0) {
          console.log(`📄 Sample files from ${queryInfo.name}:`, 
            files.slice(0, 2).map(f => ({ name: f.name, id: f.id, mimeType: f.mimeType }))
          );
        }
        
      } catch (queryError) {
        console.error(`❌ Query ${queryInfo.name} failed:`, queryError.message);
        results[queryInfo.name] = {
          query: queryInfo.query,
          description: queryInfo.description,
          error: queryError.message
        };
      }
    }
    
    // Also try the main listUserGoogleSheets function for comparison
    let mainFunctionResult = null;
    try {
      console.log('🔍 Testing main listUserGoogleSheets function...');
      mainFunctionResult = await googleSheetsService.listUserGoogleSheets(userId);
      console.log('✅ Main function result:', mainFunctionResult);
    } catch (mainError) {
      console.error('❌ Main function error:', mainError.message);
      mainFunctionResult = { error: mainError.message };
    }
    
    const summary = {
      totalUniqueFiles: allFiles.size,
      userEmail: aboutResponse.data.user.emailAddress,
      userName: aboutResponse.data.user.displayName,
      mainFunctionWorking: !mainFunctionResult?.error,
      mainFunctionFileCount: mainFunctionResult?.sheets?.length || 0
    };
    
    console.log('🔍 Drive debug summary:', summary);
    
    res.json({
      success: true,
      user: aboutResponse.data.user,
      queryResults: results,
      mainFunctionResult: mainFunctionResult,
      summary: summary,
      message: 'Comprehensive Google Drive debug completed'
    });
  } catch (error) {
    console.error('❌ Error in Google Drive debug:', error);
    res.status(500).json({ 
      success: false,
      error: 'Google Drive debug failed',
      details: error.message 
    });
  }
});

// Comprehensive debug endpoint for frontend
router.get('/debug', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userInfo = {
      userId: userId,
      username: req.user.username,
      role: req.user.role
    };

    // Check if user has Google tokens
    const hasTokens = await googleAuthService.isUserAuthenticated(userId);
    
    if (!hasTokens) {
      return res.json({
        success: true,
        user: userInfo,
        hasGoogleAuth: false,
        message: 'User not authenticated with Google',
        timestamp: new Date().toISOString()
      });
    }

    // Get Google user info
    const auth = await googleAuthService.getAuthenticatedClient(userId);
    const oauth2 = google.oauth2({ version: 'v2', auth });
    
    let userInfo_google = null;
    try {
      const response = await oauth2.userinfo.get();
      userInfo_google = response.data;
    } catch (error) {
      console.error('Error getting Google user info:', error);
    }

    // Test basic Drive access
    const drive = google.drive({ version: 'v3', auth });
    let driveInfo = null;
    try {
      const aboutResponse = await drive.about.get({
        fields: 'user,storageQuota'
      });
      driveInfo = aboutResponse.data;
    } catch (error) {
      console.error('Error getting Drive info:', error);
    }

    // Test file listing
    let fileCount = 0;
    let sampleFiles = [];
    try {
      const filesResponse = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: 'files(id,name,owners,createdTime,modifiedTime,webViewLink)',
        pageSize: 10
      });
      fileCount = filesResponse.data.files?.length || 0;
      sampleFiles = filesResponse.data.files || [];
    } catch (error) {
      console.error('Error listing files:', error);
    }

    res.json({
      success: true,
      user: userInfo,
      hasGoogleAuth: true,
      userInfo: userInfo_google,
      driveInfo: driveInfo,
      fileCount: fileCount,
      sampleFiles: sampleFiles,
      message: 'Comprehensive debug info retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Comprehensive debug error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Comprehensive debug failed',
      details: error.message 
    });
  }
});

// Update order status in Google Sheets
router.post('/update-order-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { spreadsheetId, orderNumber, newStatus, sheetName = 'Sheet1' } = req.body;

    if (!spreadsheetId || !orderNumber || !newStatus) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: spreadsheetId, orderNumber, newStatus'
      });
    }

    const googleSheetsService = require('../services/googleSheets');
    const result = await googleSheetsService.updateOrderStatusInSheet(
      userId,
      spreadsheetId,
      orderNumber,
      newStatus,
      sheetName
    );

    res.json(result);
  } catch (error) {
    console.error('Error updating order status in Google Sheets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status in Google Sheets',
      details: error.message
    });
  }
});

// Batch update order statuses in Google Sheets
router.post('/batch-update-order-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { spreadsheetId, orderUpdates, sheetName = 'Sheet1' } = req.body;

    if (!spreadsheetId || !orderUpdates || !Array.isArray(orderUpdates)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: spreadsheetId, orderUpdates (array)'
      });
    }

    const googleSheetsService = require('../services/googleSheets');
    const result = await googleSheetsService.batchUpdateOrderStatusInSheet(
      userId,
      spreadsheetId,
      orderUpdates,
      sheetName
    );

    res.json(result);
  } catch (error) {
    console.error('Error batch updating order statuses in Google Sheets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to batch update order statuses in Google Sheets',
      details: error.message
    });
  }
});

module.exports = router;
