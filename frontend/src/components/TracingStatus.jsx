import React, { useState, useEffect } from 'react';
import { 
  Chip, 
  Tooltip, 
  Box,
  CircularProgress
} from '@mui/material';
import { 
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { traceService } from '../services/FirebaseTraceService';

const TracingStatus = () => {
  const [status, setStatus] = useState('connecting'); // 'connected', 'error', 'connecting'
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      // Try to log a test event to check Firebase connectivity
      await traceService.logEvent('CONNECTION_TEST', {
        message: 'Testing Firebase connection',
        timestamp: new Date().toISOString()
      });
      
      setStatus('connected');
      setLastSync(new Date());
    } catch (error) {
      console.warn('Firebase connection test failed:', error);
      setStatus('error');
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <CloudDoneIcon />,
          label: '',
          color: 'success',
          tooltip: `Firebase connected. Last sync: ${lastSync?.toLocaleTimeString()}`
        };
      case 'error':
        return {
          icon: <CloudOffIcon />,
          label: 'Tracing Error',
          color: 'error',
          tooltip: 'Firebase connection failed. Check your configuration.'
        };
      case 'connecting':
        return {
          icon: <CircularProgress size={16} />,
          label: 'Connecting...',
          color: 'warning',
          tooltip: 'Connecting to Firebase...'
        };
      default:
        return {
          icon: <WarningIcon />,
          label: 'Unknown',
          color: 'default',
          tooltip: 'Unknown status'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
      {/* <Tooltip title={config.tooltip} arrow>
        <Chip
          icon={config.icon}
          label={config.label}
          color={config.color}
          variant="filled"
          size="small"
          sx={{
            boxShadow: 2,
            '& .MuiChip-icon': {
              marginLeft: 1
            }
          }}
        />
      </Tooltip> */}
    </Box>
  );
};

export default TracingStatus;
