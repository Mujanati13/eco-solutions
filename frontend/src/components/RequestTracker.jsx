import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  LinearProgress,
  Drawer,
  Switch,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Analytics as AnalyticsIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  Http as HttpIcon,
  Send as SendIcon,
  GetApp as GetAppIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { httpInterceptor } from "../services/HTTPInterceptor";
import { traceService } from "../services/FirebaseTraceService";
import axios from 'axios';

// Environment Configuration
const ENV_CONFIG = {
  DEV: {
    apiUrl: "https://api.stage.kautionsfrei.de",
    name: "Development"
  },

};

// Configuration toggles
const FIREBASE_ENABLED = true; // Set to false to disable Firebase functions
const CURRENT_ENV = "DEV"; // Switch between "DEV" and "PROD" - Default to Development

const RequestTracker = () => {
  // ...existing state...
  const [traces, setTraces] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [methodStats, setMethodStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentTab, setCurrentTab] = useState(2);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    type: "",
    method: "",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTraceGroup, setSelectedTraceGroup] = useState(null);
  const [currentEnv, setCurrentEnv] = useState(CURRENT_ENV);
  const [firebaseEnabled, setFirebaseEnabled] = useState(FIREBASE_ENABLED);
  const [traceSource, setTraceSource] = useState('all'); // 'web', 'api', or 'all'
  const [sourceCounts, setSourceCounts] = useState({ web: 0, api: 0, total: 0 });

  // Set initial axios baseURL
  useEffect(() => {
    // For local development, don't set baseURL to allow Vite proxy to work
    axios.defaults.baseURL = '';
  }, []);

  // Update axios baseURL when environment changes
  useEffect(() => {
    // For local development, don't set baseURL to allow Vite proxy to work
    axios.defaults.baseURL = '';
    console.log(`🔄 Environment: ${currentEnv} (using local proxy)`);

    // Refresh data with new environment
    loadTraces();
    loadAnalytics();
    if (firebaseEnabled) {
      loadMethodStats();
    }
  }, [currentEnv]);

  useEffect(() => {
    loadTraces();
    loadAnalytics();
    if (firebaseEnabled) {
      loadMethodStats();
    }
  }, [firebaseEnabled, traceSource]); // Added traceSource dependency

  // Group traces into cycles instead of just requestId
  const groupTracesIntoCycles = (traces) => {
    const cycles = {};
    let cycleCounter = 1;

    // Sort traces by timestamp to process chronologically
    const sortedTraces = [...traces].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // First pass: identify only the 3 specific step traces (only REQUEST_COMPLETE to avoid duplicates)
    const cycleTraces = sortedTraces.filter((trace) => {
      // Only include completed requests to avoid duplicating START and COMPLETE traces
      if (trace.type !== 'REQUEST_COMPLETE') {
        return false;
      }

      const isProtocolDataRequest = trace.url &&
        trace.url.includes('x-cite-web.de:5000/api/protocol/data/') &&
        trace.method === 'GET';

      const isTenancySubmission = trace.url &&
        trace.url.includes('/api/tenancies') &&
        trace.method === 'POST';

      const isStatusCheck = trace.url &&
        trace.url.includes('/api/application/state/') &&
        trace.method === 'GET';

      // Only include traces that match our 3 specific steps
      return isProtocolDataRequest || isTenancySubmission || isStatusCheck;
    });

    // Second pass: group these filtered traces into cycles
    let currentCycleId = null;
    let currentCycleStep = 0; // 0: waiting for step 1, 1: waiting for step 2, 2: waiting for step 3

    cycleTraces.forEach((trace) => {
      const isProtocolDataRequest = trace.url &&
        trace.url.includes('x-cite-web.de:5000/api/protocol/data/') &&
        trace.method === 'GET' &&
        trace.type === 'REQUEST_COMPLETE';

      const isTenancySubmission = trace.url &&
        trace.url.includes('/api/tenancies') &&
        trace.method === 'POST' &&
        trace.type === 'REQUEST_COMPLETE';

      const isStatusCheck = trace.url &&
        trace.url.includes('/api/application/state/') &&
        trace.method === 'GET' &&
        trace.type === 'REQUEST_COMPLETE';

      // Start new cycle when we see step 1 (protocol data request)
      if (isProtocolDataRequest && currentCycleStep === 0) {
        currentCycleId = `cycle-${cycleCounter}`;
        cycleCounter++;
        currentCycleStep = 1;

        if (!cycles[currentCycleId]) {
          cycles[currentCycleId] = [];
        }
        cycles[currentCycleId].push(trace);
      }
      // Add step 2 (tenancy submission) to current cycle
      else if (isTenancySubmission && currentCycleStep === 1 && currentCycleId) {
        cycles[currentCycleId].push(trace);
        currentCycleStep = 2;
      }
      // Add step 3 (status check) to current cycle and complete it
      else if (isStatusCheck && currentCycleStep === 2 && currentCycleId) {
        cycles[currentCycleId].push(trace);
        currentCycleStep = 0; // Reset for next cycle
        currentCycleId = null;
      }
      // If trace doesn't fit the expected sequence, start a new cycle
      else if (isProtocolDataRequest) {
        currentCycleId = `cycle-${cycleCounter}`;
        cycleCounter++;
        currentCycleStep = 1;

        if (!cycles[currentCycleId]) {
          cycles[currentCycleId] = [];
        }
        cycles[currentCycleId].push(trace);
      }
    });

    return cycles;
  };

  const loadTraces = async () => {
    try {
      setLoading(true);
      const allTraces = await traceService.getTraces();
      
      // Filter traces by source if needed
      let filteredTraces = allTraces;
      if (traceSource !== 'all') {
        filteredTraces = allTraces.filter(trace => {
          const source = trace.source || 'web'; // Default to 'web' for existing traces
          return source.toLowerCase() === traceSource;
        });
      }
      
      // Group traces into cycles first
      const allCycles = groupTracesIntoCycles(allTraces);
      const webCycles = groupTracesIntoCycles(allTraces.filter(trace => (trace.source || 'web').toLowerCase() === 'web'));
      const apiCycles = groupTracesIntoCycles(allTraces.filter(trace => (trace.source || 'web').toLowerCase() === 'api'));
      
      // Update source counts to count cycles instead of individual traces
      const counts = {
        web: Object.keys(webCycles).length,
        api: Object.keys(apiCycles).length,
        total: Object.keys(allCycles).length
      };
      
      setSourceCounts(counts);
      
      // Sort traces by timestamp (newest first)
      const sortedTraces = filteredTraces.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      setTraces(sortedTraces);
      setError(null);
    } catch (err) {
      setError("Failed to load traces: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const analyticsData = await httpInterceptor.getAnalytics();
      setAnalytics(analyticsData);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setAnalytics({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        requestsByStatus: {},
        requestsByType: {},
        timeline: [],
      });
    }
  };

  const loadMethodStats = async () => {
    if (!firebaseEnabled) {
      console.log("Firebase is disabled - skipping method stats");
      setMethodStats({
        totalRequests: 0,
        byMethod: {},
        responseTimeStats: {
          average: 0,
          min: 0,
          max: 0,
        },
      });
      return;
    }

    try {
      const stats = await traceService.getMethodStatistics();
      setMethodStats(stats);
    } catch (err) {
      console.error("Failed to load method statistics:", err);
      setMethodStats({
        totalRequests: 0,
        byMethod: {},
        responseTimeStats: {
          average: 0,
          min: 0,
          max: 0,
        },
      });
    }
  };

  const handleRefresh = () => {
    loadTraces();
    loadAnalytics();
    if (firebaseEnabled) {
      loadMethodStats();
    }
  };

  const handleTabChange = (event, newValue) => setCurrentTab(newValue);

  const getStatusColor = (status) => {
    switch (status) {
      case "SUCCESS":
        return "success";
      case "ERROR":
        return "error";
      case "PENDING":
        return "warning";
      default:
        return "default";
    }
  };

  const getMethodColor = (method) => {
    switch (method) {
      case "GET":
        return "primary";
      case "POST":
        return "secondary";
      case "PUT":
        return "warning";
      case "DELETE":
        return "error";
      case "PATCH":
        return "info";
      default:
        return "default";
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case "GET":
        return <GetAppIcon fontSize="small" />;
      case "POST":
        return <SendIcon fontSize="small" />;
      default:
        return <HttpIcon fontSize="small" />;
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) return "Invalid Date";
      return (
        date.toLocaleString() +
        "." +
        date.getMilliseconds().toString().padStart(3, "0")
      );
    } catch {
      return "Invalid Date";
    }
  };

  const formatDuration = (ms) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`);
  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024,
      sizes = ["B", "KB", "MB", "GB"],
      i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Extract user details from cycle traces
  const extractUserDetails = (cycleTraces) => {
    let userInfo = {
      name: '',
      address: '',
      token: '',
      landlordName: '',
      landlordAddress: ''
    };

    cycleTraces.forEach(trace => {
      // Extract token from URL (protocol data request)
      if (trace.url && trace.url.includes('x-cite-web.de:5000/api/protocol/data/')) {
        const tokenMatch = trace.url.match(/\/api\/protocol\/data\/(.+)/);
        if (tokenMatch) {
          userInfo.token = tokenMatch[1]; // Show full token
        }

        // Extract user details from the first GET request response (X-cite protocol data)
        if (trace.responseBody) {
          try {
            const responseData = typeof trace.responseBody === 'string'
              ? JSON.parse(trace.responseBody)
              : trace.responseBody;

            // Extract tenant (Mieter) information from X-cite response
            if (responseData.data && responseData.data.Mieter) {
              const mieter = responseData.data.Mieter;
              if (mieter.Vorname && mieter.Name) {
                userInfo.name = `${mieter.Vorname} ${mieter.Name}`;
              }
              // Build address from Mieter data
              const addressParts = [];
              if (mieter.Strasse) addressParts.push(mieter.Strasse);
              if (mieter.Hausnummer) addressParts.push(mieter.Hausnummer);
              if (mieter.Plz && mieter.Ort) addressParts.push(`${mieter.Plz} ${mieter.Ort}`);
              userInfo.address = addressParts.join(', ');
            }

            // Extract landlord (Vermieter) information from X-cite response
            if (responseData.data && responseData.data.Vermieter) {
              const vermieter = responseData.data.Vermieter;
              if (vermieter.Vorname && vermieter.Name) {
                userInfo.landlordName = `${vermieter.Vorname} ${vermieter.Name}`;
              }
              // Build landlord address
              const landlordAddressParts = [];
              if (vermieter.Strasse) landlordAddressParts.push(vermieter.Strasse);
              if (vermieter.Hausnummer) landlordAddressParts.push(vermieter.Hausnummer);
              if (vermieter.Plz && vermieter.Ort) landlordAddressParts.push(`${vermieter.Plz} ${vermieter.Ort}`);
              userInfo.landlordAddress = landlordAddressParts.join(', ');
            }
          } catch (e) {
            console.warn('Failed to parse X-cite protocol data response:', e);
          }
        }
      }

      // Also extract user details from tenancy submission response body
      if (trace.responseBody && trace.url && trace.url.includes('/api/tenancies')) {
        try {
          const responseData = typeof trace.responseBody === 'string'
            ? JSON.parse(trace.responseBody)
            : trace.responseBody;

          // Look for tenant information in KautionFrei response
          if (responseData.tenant) {
            const tenant = responseData.tenant;
            if (tenant.firstName && tenant.name && !userInfo.name) {
              userInfo.name = `${tenant.firstName} ${tenant.name}`;
            }
            if (tenant.address && !userInfo.address) {
              const addr = tenant.address;
              userInfo.address = `${addr.street || ''} ${addr.houseNumber || ''}, ${addr.zipCode || ''} ${addr.city || ''}`.trim();
            }
          }

          // Look for landlord information in KautionFrei response
          if (responseData.landlord) {
            const landlord = responseData.landlord;
            if (landlord.firstName && landlord.name && !userInfo.landlordName) {
              userInfo.landlordName = `${landlord.firstName} ${landlord.name}`;
            }
            if (landlord.address && !userInfo.landlordAddress) {
              const addr = landlord.address;
              userInfo.landlordAddress = `${addr.street || ''} ${addr.houseNumber || ''}, ${addr.zipCode || ''} ${addr.city || ''}`.trim();
            }
          }
        } catch (e) {
          console.warn('Failed to parse tenancy response:', e);
        }
      }
    });

    return userInfo;
  };

  const filteredTraces = traces.filter((trace) => {
    // Filter out Testing Firebase connection traces
    if (trace.type === 'CONNECTION_TEST' ||
      (trace.message && trace.message.includes('Testing Firebase connection'))) {
      return false;
    }

    if (filters.status && trace.status !== filters.status) return false;
    if (filters.type && trace.type !== filters.type) return false;
    if (filters.method && trace.method !== filters.method) return false;
    return true;
  });

  const groupedTraces = groupTracesIntoCycles(filteredTraces);

  // Sort cycles by most recent first
  const sortedGroupedTraces = Object.entries(groupedTraces)
    .sort(([, tracesA], [, tracesB]) => {
      const latestTimeA = Math.max(...tracesA.map(t => new Date(t.timestamp).getTime()));
      const latestTimeB = Math.max(...tracesB.map(t => new Date(t.timestamp).getTime()));
      return latestTimeB - latestTimeA; // Most recent first
    })
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  const openDrawer = (group) => {
    setSelectedTraceGroup(group);
    setDrawerOpen(true);
  };

  const DrawerContent = () => {
    if (!selectedTraceGroup) return null;

    // Sort traces within the selected cycle by timestamp
    const sortedTraces = selectedTraceGroup.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return (
      <Box sx={{ p: 3, width: { xs: "100%", sm: 500 } }}>
        <Typography variant="h6" gutterBottom>
          Cycle Details ({sortedTraces.length} requests)
        </Typography>

        {/* Cycle Timeline */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Cycle Steps:
          </Typography>
          {sortedTraces.map((trace, index) => {
            // Since we're only showing REQUEST_COMPLETE traces, all traces are completed requests
            const isComplete = trace.type === "REQUEST_COMPLETE";

            // Identify cycle step
            let stepLabel = `Step ${index + 1}`;
            let stepType = 'Other';

            if (trace.url && trace.url.includes('x-cite-web.de:5000/api/protocol/data/') && trace.method === 'GET') {
              stepType = '1. Protocol Data';
              stepLabel = 'Protocol Data Request';
            } else if (trace.url && trace.url.includes('/api/tenancies') && trace.method === 'POST') {
              stepType = '2. Tenancy Submit';
              stepLabel = 'Tenancy Submission';
            } else if (trace.url && trace.url.includes('/api/application/state/') && trace.method === 'GET') {
              stepType = '3. Status Check';
              stepLabel = 'Status Check';
            }

            return (
              <Box key={`${trace.requestId}-${index}`} sx={{ mb: 2, pl: 2, borderLeft: "2px solid #e0e0e0" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Chip
                    size="small"
                    label={stepType}
                    color={stepType.startsWith('1.') ? "primary" : stepType.startsWith('2.') ? "secondary" : stepType.startsWith('3.') ? "success" : "default"}
                    sx={{ minWidth: 120, fontSize: "0.7rem" }}
                  />
                  {trace.method && (
                    <Chip
                      icon={getMethodIcon(trace.method)}
                      label={trace.method}
                      color={getMethodColor(trace.method)}
                      size="small"
                    />
                  )}
                  <Chip
                    label={trace.status || trace.type}
                    color={getStatusColor(trace.status)}
                    size="small"
                  />
                  <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                    {formatTimestamp(trace.timestamp)}
                  </Typography>
                </Box>

                <Typography variant="body2" sx={{ mb: 1, fontWeight: stepType !== 'Other' ? 'bold' : 'normal' }}>
                  {stepLabel}
                </Typography>

                <Typography variant="body2" sx={{ wordBreak: "break-all", mb: 1, fontSize: "0.8rem", color: "textSecondary" }}>
                  {trace.url || trace.message || 'Event'}
                </Typography>

                {(trace.responseTime) && (
                  <Typography variant="caption" color="textSecondary">
                    Response time: {trace.responseTime}ms
                  </Typography>
                )}

                {/* Expandable details for each request */}
                <Accordion size="small" sx={{ mt: 1 }} disableGutters>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="caption">Request Details</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {trace.headers && (
                      <Accordion sx={{ mt: 1 }} disableGutters>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="caption">
                            Response Headers
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <pre style={{ fontSize: 10 }}>
                            {JSON.stringify(trace.responseHeaders || trace.headers, null, 2)}
                          </pre>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {trace.responseBody && (
                      <Accordion sx={{ mt: 1 }} disableGutters>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="caption">
                            Response Body
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <pre style={{ fontSize: 10 }}>
                            {typeof trace.responseBody === "string"
                              ? trace.responseBody
                              : JSON.stringify(trace.responseBody, null, 2)}
                          </pre>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {trace.error && (
                      <Accordion sx={{ mt: 1 }} disableGutters>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="caption" color="error">
                            Error Details
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <pre style={{ fontSize: 10, color: "red" }}>
                            {JSON.stringify(trace.error, null, 2)}
                          </pre>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </AccordionDetails>
                </Accordion>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  const TracesTab = () => (
    <Box sx={{ width: "100%", height: "100%" }}>
      {/* Source Filter Toggle */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Request Traces
        </Typography>
        <ToggleButtonGroup
          value={traceSource}
          exclusive
          onChange={(event, newSource) => {
            if (newSource !== null) {
              setTraceSource(newSource);
            }
          }}
          size="small"
        >
          <ToggleButton value="all">
            <Badge badgeContent={sourceCounts.total} color="primary">
              All Sources
            </Badge>
          </ToggleButton>
          <ToggleButton value="web">
            <Badge badgeContent={sourceCounts.web} color="secondary">
              Web
            </Badge>
          </ToggleButton>
          <ToggleButton value="api">
            <Badge badgeContent={sourceCounts.api} color="info">
              API
            </Badge>
          </ToggleButton>
        </ToggleButtonGroup>
        <IconButton onClick={loadTraces} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>
      
      <TableContainer
        component={Paper}
        sx={{
          bgcolor: "#fff",
          border: "1px solid #e0e0e0"
        }}
      >
        <Table stickyHeader size="small" sx={{
          width: "100%",
          "& .MuiTableCell-root": {
            border: "1px solid #e0e0e0"
          }
        }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 60, fontWeight: "bold", whiteSpace: "nowrap" }}>Source</TableCell>
              <TableCell sx={{ width: 100, fontWeight: "bold", whiteSpace: "nowrap" }}>Cycle</TableCell>
              <TableCell sx={{ width: 150, fontWeight: "bold", whiteSpace: "nowrap" }}>Time</TableCell>
              <TableCell sx={{ width: 70, textAlign: "center", fontWeight: "bold", whiteSpace: "nowrap" }}>Req</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Summary</TableCell>
              <TableCell sx={{ width: 90, textAlign: "center", fontWeight: "bold", whiteSpace: "nowrap" }}>Status</TableCell>
              <TableCell sx={{ width: 80, textAlign: "center", fontWeight: "bold", whiteSpace: "nowrap" }}>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(sortedGroupedTraces).map(([cycleId, cycleTraces]) => {
              // Sort traces within cycle by timestamp
              const sortedCycleTraces = cycleTraces.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
              const firstTrace = sortedCycleTraces[0];
              const lastTrace = sortedCycleTraces[sortedCycleTraces.length - 1];

              // Extract user details for this cycle
              const userDetails = extractUserDetails(sortedCycleTraces);

              // Determine cycle summary based on the 3-step pattern
              const protocolDataRequests = sortedCycleTraces.filter(t =>
                t.url && t.url.includes('x-cite-web.de:5000/api/protocol/data/') && t.method === 'GET'
              );
              const tenancySubmissions = sortedCycleTraces.filter(t =>
                t.url && t.url.includes('/api/tenancies') && t.method === 'POST'
              );
              const statusChecks = sortedCycleTraces.filter(t =>
                t.url && t.url.includes('/api/application/state/') && t.method === 'GET'
              );

              let cycleSummary = '';
              const steps = [];
              if (protocolDataRequests.length > 0) steps.push('Protocol Data');
              if (tenancySubmissions.length > 0) steps.push('Tenancy Submit');
              if (statusChecks.length > 0) steps.push('Status Check');

              // Create detailed summary with user info
              let detailedSummary = '';
              if (userDetails.name) {
                detailedSummary += `👤 ${userDetails.name}`;
              }
              if (userDetails.address) {
                detailedSummary += detailedSummary ? ` | 📍 ${userDetails.address}` : `📍 ${userDetails.address}`;
              }
              if (userDetails.landlordName) {
                detailedSummary += detailedSummary ? ` | 🏠 ${userDetails.landlordName}` : `🏠 ${userDetails.landlordName}`;
              }
              if (userDetails.token) {
                detailedSummary += detailedSummary ? ` | 🔑 ${userDetails.token}` : `🔑 ${userDetails.token}`;
              }

              if (steps.length === 3) {
                cycleSummary = detailedSummary || 'Complete Cycle (3/3 steps)';
              } else if (steps.length > 0) {
                cycleSummary = detailedSummary || `Partial Cycle (${steps.length}/3): ${steps.join(' → ')}`;
              } else {
                cycleSummary = detailedSummary || 'Other requests';
              }

              // Overall cycle status
              const hasErrors = sortedCycleTraces.some(t => t.status === 'ERROR');
              const allCompleted = sortedCycleTraces.every(t => t.status !== 'PENDING');
              const cycleStatus = hasErrors ? 'ERROR' : allCompleted ? 'SUCCESS' : 'PENDING';

              return (
                <TableRow key={cycleId} sx={{ opacity: allCompleted ? 1 : 0.7 }}>
                  <TableCell>
                    <Chip
                      label={firstTrace.source || 'Web'}
                      size="small"
                      color={(firstTrace.source || 'web').toLowerCase() === 'api' ? 'info' : 'secondary'}
                      variant="filled"
                      sx={{ fontSize: "0.65rem", fontWeight: "bold" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={cycleId.replace('cycle-', 'Cycle ')}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontSize: "0.7rem" }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                        {formatTimestamp(firstTrace.timestamp)}
                      </Typography>
                      {firstTrace.metadata && firstTrace.metadata.ipAddress && (
                        <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "textSecondary", display: "block" }}>
                          IP: {firstTrace.metadata.ipAddress}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    <Chip
                      label={sortedCycleTraces.length}
                      size="small"
                      color="default"
                      sx={{ minWidth: 40, fontSize: "0.7rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ width: "100%", maxWidth: "none" }}>
                      {/* Tenant Information */}
                      <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: "bold", color: "primary.main", mb: 0.2 }}>
                        👤 {userDetails.name || 'Tenant: Information Not Available'}
                      </Typography>
                      {userDetails.address && (
                        <Typography variant="caption" sx={{ fontSize: "0.75rem", color: "textSecondary", display: "block", mb: 0.2 }}>
                          📍 {userDetails.address}
                        </Typography>
                      )}

                      {/* Landlord Information */}
                      {userDetails.landlordName && (
                        <>
                          <Typography variant="caption" sx={{ fontSize: "0.8rem", color: "success.main", fontWeight: "medium", display: "block", mb: 0.1 }}>
                            🔑 {userDetails.landlordName}
                          </Typography>
                          {userDetails.landlordAddress && (
                            <Typography variant="caption" sx={{ fontSize: "0.75rem", color: "success.light", display: "block", mb: 0.2 }}>
                              📍 {userDetails.landlordAddress}
                            </Typography>
                          )}
                        </>
                      )}

                      {/* Token */}
                      {userDetails.token && (
                        <Typography variant="caption" sx={{
                          fontSize: "0.7rem",
                          color: "textSecondary",
                          display: "block",
                          fontFamily: "monospace",
                          wordBreak: "break-all",
                          lineHeight: 1.2,
                          mb: 0.2
                        }}>
                          {userDetails.token}
                        </Typography>
                      )}

                      {/* Cycle Status */}
                      <Typography variant="caption" sx={{
                        fontSize: "0.75rem",
                        color: steps.length === 3 ? "success.main" : "warning.main",
                        display: "block",
                        fontWeight: "bold"
                      }}>
                        {steps.length === 3 ? '✅ Complete (3/3)' : `⏳ Partial (${steps.length}/3)`}
                        {steps.length < 3 && steps.length > 0 && (
                          <span style={{ fontSize: "0.7rem", fontWeight: "normal", marginLeft: "4px" }}>
                            - {steps.join(' → ')}
                          </span>
                        )}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    <Chip
                      label={cycleStatus}
                      color={getStatusColor(cycleStatus)}
                      size="small"
                      sx={{ minWidth: 70, fontSize: "0.7rem" }}
                    />
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    <Tooltip title="View cycle details">
                      <IconButton onClick={() => openDrawer(sortedCycleTraces)} size="small">
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        transitionDuration={400}
      >
        <DrawerContent />
      </Drawer>
    </Box>
  );

  return (
    <Box sx={{ p: 2, minHeight: 'calc(100vh - 64px)' }}>
      {/* Configuration Controls */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {currentTab === 2 && <TracesTab />}
    </Box>
  );
};

export default RequestTracker;
