const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const RealTimeSessionService = require('../services/realTimeSessionService');
const socketService = require('../services/socketService');
const XLSX = require('xlsx');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable');

const router = express.Router();

// Get user's session time for today
router.get('/today/:userId?', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const today = new Date().toISOString().split('T')[0];
    const sessionTime = await RealTimeSessionService.getUserSessionTime(userId, today);
    
    res.json({
      success: true,
      data: sessionTime
    });
  } catch (error) {
    console.error('Error fetching today session time:', error);
    res.status(500).json({ error: 'Failed to fetch session time' });
  }
});

// Get user's session time for a specific date
router.get('/date/:date/:userId?', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.params.userId || req.user.userId;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const sessionTime = await RealTimeSessionService.getUserSessionTime(userId, date);
    
    res.json({
      success: true,
      data: sessionTime
    });
  } catch (error) {
    console.error('Error fetching session time for date:', error);
    res.status(500).json({ error: 'Failed to fetch session time' });
  }
});

// Get user's session time for a date range
router.get('/range/:startDate/:endDate/:userId?', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const userId = req.params.userId || req.user.userId;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const sessionTimes = await RealTimeSessionService.getUserSessionTimeRange(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: sessionTimes
    });
  } catch (error) {
    console.error('Error fetching session time range:', error);
    res.status(500).json({ error: 'Failed to fetch session time range' });
  }
});

// Get all users' session times for a specific date (admin only)
router.get('/all/:date', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { date } = req.params;
    const sessionTimes = await RealTimeSessionService.getAllUsersSessionTime(date);
    
    res.json({
      success: true,
      data: sessionTimes
    });
  } catch (error) {
    console.error('Error fetching all users session times:', error);
    res.status(500).json({ error: 'Failed to fetch session times' });
  }
});

// Get user session statistics
router.get('/stats/:startDate/:endDate/:userId?', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const userId = req.params.userId || req.user.userId;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await RealTimeSessionService.getUserSessionStats(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session stats' });
  }
});

// Get currently active sessions (admin only)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const activeSessions = await RealTimeSessionService.getActiveSessions();
    const connectedUsers = socketService.getConnectedUsers();
    
    res.json({
      success: true,
      data: {
        activeSessions,
        connectedUsers,
        totalActive: connectedUsers.length
      }
    });
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

// Get detailed session breakdown for a user on a specific date
router.get('/detailed/:date/:userId?', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.params.userId || req.user.userId;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const detailedSessions = await RealTimeSessionService.getUserDetailedSessions(userId, date);
    
    res.json({
      success: true,
      data: detailedSessions
    });
  } catch (error) {
    console.error('Error fetching detailed sessions:', error);
    res.status(500).json({ error: 'Failed to fetch detailed sessions' });
  }
});

// Force update session summary for a user (admin only)
router.post('/update-summary/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    await RealTimeSessionService.updateDailySummary(userId, today);
    await socketService.forceUpdateUserSession(parseInt(userId));
    
    res.json({
      success: true,
      message: 'Session summary updated successfully'
    });
  } catch (error) {
    console.error('Error updating session summary:', error);
    res.status(500).json({ error: 'Failed to update session summary' });
  }
});

// Export session data in various formats
router.get('/export/:startDate/:endDate/:userId?', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const userId = req.params.userId || req.user.userId;
    const { format = 'csv' } = req.query; // csv, excel, pdf
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const sessionTimes = await RealTimeSessionService.getUserSessionTimeRange(userId, startDate, endDate);
    
    if (sessionTimes.length === 0) {
      return res.status(404).json({ error: 'No session data found for the specified criteria' });
    }

    // Prepare data for export
    const headers = ['Date', 'User ID', 'Username', 'First Name', 'Last Name', 'Role', 'Total Session Time (seconds)', 'Session Count', 'Page Views', 'First Login', 'Last Logout'];
    const data = sessionTimes.map(session => ({
      'Date': session.date,
      'User ID': session.user_id,
      'Username': session.username,
      'First Name': session.first_name,
      'Last Name': session.last_name,
      'Role': session.role,
      'Total Session Time (seconds)': session.total_session_time,
      'Session Count': session.session_count,
      'Page Views': session.page_views,
      'First Login': session.first_login || '',
      'Last Logout': session.last_logout || ''
    }));

    // Generate output based on format
    let contentType, fileExtension, fileName, outputContent;
    
    switch (format.toLowerCase()) {
      case 'excel':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
        
        // Create Excel workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        // Auto-fit columns
        const colWidths = headers.map(header => ({
          wch: Math.max(header.length, 15)
        }));
        worksheet['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Session Data');
        outputContent = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        break;
        
      case 'pdf':
        contentType = 'application/pdf';
        fileExtension = 'pdf';
        
        // Create PDF document
        const pdf = new jsPDF('l'); // landscape orientation for more columns
        
        // Add title
        pdf.setFontSize(16);
        pdf.text('Session Time Report', 14, 22);
        
        // Add date range info
        pdf.setFontSize(10);
        let reportInfo = `Generated: ${new Date().toLocaleDateString()}`;
        reportInfo += ` | Period: ${startDate} to ${endDate}`;
        pdf.text(reportInfo, 14, 30);
        
        // Prepare table data
        const tableHeaders = headers;
        const tableData = data.map(row => headers.map(header => String(row[header] || '')));
        
        // Add table
        autoTable.default(pdf, {
          head: [tableHeaders],
          body: tableData,
          startY: 35,
          styles: { fontSize: 7, cellPadding: 1 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
          columnStyles: {
            0: { cellWidth: 25 }, // Date
            1: { cellWidth: 15 }, // User ID
            2: { cellWidth: 20 }, // Username
            3: { cellWidth: 20 }, // First Name
            4: { cellWidth: 20 }, // Last Name
            5: { cellWidth: 15 }, // Role
            6: { cellWidth: 25 }, // Session Time
            7: { cellWidth: 15 }, // Session Count
            8: { cellWidth: 15 }, // Page Views
            9: { cellWidth: 20 }, // First Login
            10: { cellWidth: 20 } // Last Logout
          },
          margin: { top: 35, left: 14, right: 14 }
        });
        
        outputContent = Buffer.from(pdf.output('arraybuffer'));
        break;
        
      case 'csv':
      default:
        contentType = 'text/csv';
        fileExtension = 'csv';
        
        // Convert to CSV format
        const csvHeader = headers.join(',');
        const csvRows = data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Handle values that might contain commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value || '';
          }).join(',')
        );
        outputContent = [csvHeader, ...csvRows].join('\n');
        break;
    }

    fileName = `session-times-${startDate}-to-${endDate}.${fileExtension}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(outputContent);
    
  } catch (error) {
    console.error('Error exporting session data:', error);
    res.status(500).json({ error: 'Failed to export session data' });
  }
});

module.exports = router;
