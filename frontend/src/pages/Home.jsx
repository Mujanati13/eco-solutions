import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup,
  Switch,
  FormControlLabel,
  Chip,
  Fab,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CachedIcon from "@mui/icons-material/Cached";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import TimerIcon from "@mui/icons-material/Timer";
import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { httpInterceptor } from "../services/HTTPInterceptor";

// Environment Configuration (same as RequestTracker)
const ENV_CONFIG = {
  DEV: {
    apiUrl: "https://api.stage.kautionsfrei.de",
    name: "Development"
  },
 
};

// Sample test data for simulation based on the provided example
const testData = {
  msg: "success",
  data: {
    "Wohnungsübergabeprotokoll": {
      "Art der Übergabe": "Einzug",
      "Datum der Übergabe": "03.04.2025",
    },
    Mieter: {
      Anrede: "Frau",
      Titel: "Keine Angaben",
      Name: "H",
      Vorname: "H",
      Geburtsdatum: "03.04.2025",
      Strasse: "Testweg",
      Hausnummer: "1",
      Plz: "63755",
      Ort: "Alzenau",
      Adresszusatz: "",
      Rufnummer: "",
      "Mobile Nummer": "",
      Emailadresse: "stephanwalleter@x-cite.de",
    },
    Wohnung: {
      Strasse: "Testweg",
      Hausnummer: "1",
      Adresszusatz: null,
      Plz: "63755",
      Ort: "Alzenau",
    },
    Vermieter: {
      Unternehmen: "",
      Anrede: "Herr",
      Titel: "Keine Angaben",
      Name: "T",
      Vorname: "T",
      Strasse: "F",
      Hausnummer: "T",
      Plz: "63755",
      Ort: "Stadt",
      Adresszusatz: "",
      Rufnummer: "",
      "Mobile Nummer": "",
      Emailadresse: "stephanwalleter@x-cite.de",
    },
  },
};

// Helper function to render nested objects recursively with responsive spacing.
const renderNestedObject = (obj, level = 0) => {
  if (!obj || typeof obj !== "object") return null;

  return Object.entries(obj).map(([key, value]) => {
    const isObject = value && typeof value === "object";

    return (
      <Box
        key={key}
        sx={{
          ml: { xs: level * 1, sm: level * 2 },
          mb: isObject ? 2 : 0.5,
        }}
      >
        {isObject ? (
          <>
            <Typography
              variant={level === 0 ? "subtitle1" : "subtitle2"}
              sx={{
                fontWeight: "medium",
                mt: 1,
                mb: 1,
                borderBottom: level === 0 ? 1 : 0,
                borderColor: "divider",
                pb: level === 0 ? 0.5 : 0,
              }}
            >
              {key}
            </Typography>
            {renderNestedObject(value, level + 1)}
          </>
        ) : (
          <Typography variant="body2" sx={{ display: "flex" }}>
            <Box
              component="span"
              sx={{
                fontWeight: "medium",
                width: { xs: "35%", sm: "40%" },
                flexShrink: 0,
              }}
            >
              {key}:
            </Box>
            <Box component="span" sx={{ pl: 1 }}>
              {value === "" ? "-" : value}
            </Box>
          </Typography>
        )}
      </Box>
    );
  });
};

// Response Section Component for displaying hierarchical data.
const ResponseSection = ({ title, data }) => {
  if (!data) return null;

  return (
    <Accordion sx={{ mt: 2 }} defaultExpanded={true}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: "medium" }}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box>{renderNestedObject(data)}</Box>
      </AccordionDetails>
    </Accordion>
  );
};

function Home() {
  const [env, setEnv] = useState("real"); // "real" or "test"
  const [apiEnv, setApiEnv] = useState("DEV"); // "DEV" or "PROD" for API environment
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [tracing, setTracing] = useState(true); // Set tracing to true by default for better feedback
  const [traceMessages, setTraceMessages] = useState([]);
  const [cycleStartTime, setCycleStartTime] = useState(null);
  const [cycleId, setCycleId] = useState(null);
  const [burgschaftData, setBurgschaftData] = useState(null);
  const [burgschaftError, setBurgschaftError] = useState(null);
  const [burgschaftLoading, setBurgschaftLoading] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [countdown, setCountdown] = useState(null); // Add countdown state
  const [clientLink, setClientLink] = useState(null); // Client link for self-service
  const [linkExpiry, setLinkExpiry] = useState(null); // Link expiry time
  const [linkActive, setLinkActive] = useState(false); // Link active status
  const [linkGenerating, setLinkGenerating] = useState(false); // Link generation loading state

  // Setup theme and media query for mobile detection.
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  // Create a ref for the Kaution section.
  const kautionSectionRef = useRef(null);

  // Set initial axios baseURL and update when API environment changes
  useEffect(() => {
    // For local development, don't set baseURL to allow Vite proxy to work
    // The proxy will redirect /api/* to http://localhost:3001
    axios.defaults.baseURL = '';
    console.log(`🔄 API Environment: ${apiEnv} (using local proxy)`);
  }, [apiEnv]);

  // Check link expiry every minute
  useEffect(() => {
    if (!linkExpiry || !linkActive) return;
    
    const checkExpiry = () => {
      const now = new Date();
      if (now >= linkExpiry) {
        setLinkActive(false);
        addTrace(`⏰ Client link expired at ${linkExpiry.toLocaleString()}`);
        
        // Log link expiration to Firebase
        httpInterceptor.logCustomEvent('CLIENT_LINK_EXPIRED', 'Link expired due to time limit', {
          cycleId: cycleId,
          expiredAt: new Date().toISOString(),
          reason: 'time_expired'
        });
      }
    };
    
    // Check immediately
    checkExpiry();
    
    // Then check every minute
    const interval = setInterval(checkExpiry, 60000);
    
    return () => clearInterval(interval);
  }, [linkExpiry, linkActive, cycleId]);

  // Helper function to get user's IP address
  const getUserIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn('Failed to get IP address:', error);
      return 'Unknown';
    }
  };

  // Helper function to add trace messages with timestamps including milliseconds.
  const addTrace = async (message) => {
    if (tracing) {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      const milliseconds = now.getMilliseconds().toString().padStart(3, "0");
      const timestamp = `${hours}:${minutes}:${seconds}.${milliseconds}`;

      setTraceMessages((prev) => [...prev, { time: timestamp, message }]);
      
      // Also log to Firebase with IP address
      try {
        const userIP = await getUserIP();
        await httpInterceptor.logCustomEvent('USER_TRACE', message, {
          timestamp: timestamp,
          environment: env,
          apiEnvironment: apiEnv,
          apiUrl: ENV_CONFIG[apiEnv].apiUrl,
          userGenerated: true,
          ipAddress: userIP,
          cycleId: cycleId
        });
      } catch (error) {
        console.warn('Failed to log trace to Firebase:', error);
      }
    }
  };

  // Helper to add cycle summary.
  const addCycleSummary = async (success) => {
    if (tracing && cycleStartTime && cycleId) {
      const endTime = new Date();
      const duration = endTime - cycleStartTime;
      const summary = success
        ? `Cycle ${cycleId} completed successfully in ${duration}ms - Environment: ${env}, API: ${ENV_CONFIG[apiEnv].name}, Status: Success`
        : `Cycle ${cycleId} failed after ${duration}ms - Environment: ${env}, API: ${ENV_CONFIG[apiEnv].name}, Status: Error`;
      await addTrace(`CYCLE SUMMARY: ${summary}`);
      
      // Log cycle summary to Firebase
      try {
        const userIP = await getUserIP();
        await httpInterceptor.logCustomEvent('CYCLE_SUMMARY', summary, {
          cycleId,
          duration,
          success,
          environment: env,
          apiEnvironment: apiEnv,
          apiUrl: ENV_CONFIG[apiEnv].apiUrl,
          timestamp: endTime.toISOString(),
          ipAddress: userIP
        });
      } catch (error) {
        console.warn('Failed to log cycle summary to Firebase:', error);
      }
    }
  };

  // Handle environment toggle.
  const handleEnvChange = (event, newEnv) => {
    if (newEnv !== null) {
      setEnv(newEnv);
    }
  };

  // Handle API environment change
  const handleApiEnvChange = (event) => {
    setApiEnv(event.target.value);
  };

  // Helper function to wait a specific amount of time
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Function to poll application status with retries - AUTOMATIC STATUS CHECKING
  async function pollApplicationStatus(cid, maxAttempts = 3) {
    if (!cid) return;
    
    await addTrace(`📊 STARTING AUTOMATIC STATUS POLLING for CID: ${cid}`);
    setStatusLoading(true);
    
    let attempts = 0;
    let accepted = false;
    
    while (attempts < maxAttempts && !accepted) {
      attempts++;
      
      try {
        // Wait 5 seconds before checking status
        await addTrace(`⏱️ Waiting 5 seconds before status check (attempt ${attempts}/${maxAttempts})...`);
        await wait(5000);
        
        await addTrace(`🔍 Checking application status for CID: ${cid} (attempt ${attempts}/${maxAttempts})`);
        
        const response = await axios.get(
          `https://api.stage.kautionsfrei.de/api/application/state/${cid}`
        );
        
        if (response.data) {
          await addTrace(`✅ Status retrieved: ${response.data.state}`);
          setStatusData(response.data);
          
          // If the application is accepted, stop polling
          if (response.data.state === "accepted") {
            await addTrace(`🎉 Application ACCEPTED! Stopping status checks.`);
            accepted = true;
            break;
          } else if (response.data.state === "rejected") {
            await addTrace(`❌ Application REJECTED. Stopping status checks.`);
            break;
          } else {
            await addTrace(`⏳ Status is "${response.data.state}". Will check again in 5 seconds.`);
          }
        } else {
          await addTrace("❓ Received empty status response");
          setStatusError("No status data received");
          break;
        }
      } catch (err) {
        console.error("Error fetching application status:", err);
        await addTrace(`❌ Status check error: ${err.message}`);
        setStatusError(err.response?.data?.msg || "Failed to retrieve application status");
        
        // If it's the last attempt, show the error
        if (attempts === maxAttempts) {
          setStatusError(`Failed to get status after ${maxAttempts} attempts: ${err.message}`);
        }
      }
    }
    
    setStatusLoading(false);
    await addTrace(`🏁 Automatic status polling complete (${attempts} attempts)`);
  }

  // Check application status using CID (manual check)
  async function checkApplicationStatus(cid) {
    if (!cid) return;
    
    setStatusLoading(true);
    setStatusError(null);
    setStatusData(null);
    
    await addTrace(`Checking application status for CID: ${cid}`);
    
    try {
      const response = await axios.get(
        `https://api.stage.kautionsfrei.de/api/application/state/${cid}`
      );
      
      if (response.data) {
        await addTrace(`Status retrieved successfully: ${response.data.state}`);
        setStatusData(response.data);
        
        // Check if cycle is completed and deactivate link
        if (response.data.state === "accepted" || response.data.state === "rejected") {
          if (clientLink && linkActive) {
            setLinkActive(false);
            await addTrace(`🔗 Client link deactivated - Cycle completed with status: ${response.data.state}`);
            
            // Log link deactivation to Firebase
            await httpInterceptor.logCustomEvent('CLIENT_LINK_DEACTIVATED', 'Link deactivated due to cycle completion', {
              cycleId: cycleId,
              finalStatus: response.data.state,
              deactivatedAt: new Date().toISOString(),
              reason: 'cycle_completed'
            });
          }
        }
      } else {
        await addTrace("Received empty status response");
        setStatusError("No status data received");
      }
    } catch (err) {
      console.error("Error fetching application status:", err);
      await addTrace(`Status check error: ${err.message}`);
      setStatusError(err.response?.data?.msg || "Failed to retrieve application status");
    } finally {
      setStatusLoading(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    
    // Generate a unique cycle ID and start cycle timing
    const newCycleId = `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();
    setCycleId(newCycleId);
    setCycleStartTime(startTime);

    if (tracing) {
      setTraceMessages([]);
      await addTrace(`Cycle ${newCycleId} started - Preparing request`);
    }

    if (env === "test") {
      await addTrace(`Cycle ${newCycleId} - Using test environment - Simulating API call`);
      setTimeout(async () => {
        await addTrace(`Cycle ${newCycleId} - Test data received`);
        await addTrace(`Cycle ${newCycleId} - Processing test response data`);
        await addTrace(`Cycle ${newCycleId} - Formatting results for display`);
        setResult(testData);
        await addTrace(`Cycle ${newCycleId} - UI update: Displaying test results`);
        setLoading(false);
        await addCycleSummary(true);
      }, 1000);
    } else {
      try {
        await addTrace(
          `Cycle ${newCycleId} - Preparing API request with token: ${token.substring(
            0,
            3
          )}...${token.substring(token.length - 3)}`
        );
        await addTrace(
          `Cycle ${newCycleId} - Sending request to: https://www.x-cite-web.de:5000/api/protocol/data/${token}`
        );

        const response = await axios.get(
          `https://www.x-cite-web.de:5000/api/protocol/data/${token}`
        );

        await addTrace(`Cycle ${newCycleId} - Response received successfully`);
        await addTrace(`Cycle ${newCycleId} - Processing response data`);
        await addTrace(`Cycle ${newCycleId} - Validating response structure`);
        await addTrace(`Cycle ${newCycleId} - Formatting results for display`);
        setResult(response.data);
        await addTrace(`Cycle ${newCycleId} - UI update: Displaying results`);
        await addCycleSummary(true);
      } catch (err) {
        console.error("Error fetching data:", err);
        await addTrace(`Cycle ${newCycleId} - Error occurred: ${err.message}`);
        setError(
          err.response?.data?.msg
            ? `${err.response.data.msg}`
            : "No data found with the given token!"
        );
        await addTrace(`Cycle ${newCycleId} - UI update: Showing error message`);
        await addCycleSummary(false);
      } finally {
        setLoading(false);
        await addTrace(`Cycle ${newCycleId} - Process completed`);
      }
    }
  };

  async function submitXCiteData() {
    // Reset previous results
    setBurgschaftData(null);
    setBurgschaftError(null);
    setBurgschaftLoading(true);
    setStatusData(null);
    setStatusError(null);
    setCountdown(null); // Reset countdown
  
    try {
      // Disable the button to prevent multiple submissions
      const submitButton = document.getElementById("submit-xcite-button");
      if (submitButton) {
        submitButton.disabled = true;
      }
  
      await addTrace(`🚀 Cycle ${cycleId} - STEP 1: Preparing data for Bürgschaft creation`);
  
      const mappedData = {
        product: "kfde_06_2020",
        partnerCode: "mr",
        landlord: {
          firstName: result.data.Vermieter?.Vorname || "",
          name: result.data.Vermieter?.Name || "",
          gender: result.data.Vermieter?.Anrede === "Herr" ? "male" : "female",
          address: {
            street: result.data.Vermieter?.Strasse || "",
            streetNumber: (() => {
              const rawNumber = result.data.Vermieter?.Hausnummer || "";
              const match = rawNumber.match(/^(\d+[a-zA-Z]?)/);
              return match ? match[0].substring(0, 5) : "1";
            })(),
            zip: result.data.Vermieter?.Plz || "",
            city: result.data.Vermieter?.Ort || "",
          },
        },
        firstTenant: {
          gender: result.data.Mieter?.Anrede === "Herr" ? "male" : "female",
          firstName: result.data.Mieter?.Vorname || "",
          name: result.data.Mieter?.Name || "",
          phone: (() => {
            const phone = (
              result.data.Mieter?.["Mobile Nummer"] ||
              result.data.Mieter?.Rufnummer ||
              ""
            ).replace(/\s+/g, "");
            // Provide fallback phone number if empty
            return phone || "015712345678";
          })(),
          email: result.data.Mieter?.Emailadresse || "",
          nationality: "DE",
          dateOfBirth: (() => {
            // Use provided date if valid, otherwise generate a valid date for someone at least 18 years old
            const providedDate = result.data.Mieter?.Geburtsdatum;
            if (providedDate && providedDate !== "") {
              // Check if the date makes the person at least 18 years old
              const parts = providedDate.split('.');
              if (parts.length === 3) {
                const birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
                const today = new Date();
                const age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                
                // If the person is at least 18, use the provided date
                if (age > 18 || (age === 18 && monthDiff >= 0)) {
                  return providedDate;
                }
              }
            }
            
            // Generate a valid date for someone who is 25 years old (DD.MM.YYYY format)
            const today = new Date();
            const year = today.getFullYear() - 25;
            const month = today.getMonth() + 1;
            const day = today.getDate();
            return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`;
          })(),
          address: {
            street: result.data.Mieter?.Strasse || "",
            streetNumber: result.data.Mieter?.Hausnummer || "",
            zip: result.data.Mieter?.Plz || "",
            city: result.data.Mieter?.Ort || "",
          },
          termsAccepted: "y",
        },
        bankAccount: {
          iban: "DE02476501301111361018",
          bankName: "Sparkasse Paderborn-Detmold-Höxter",
          paymentFrequency: "monthly",
          owner: "firstTenant",
        },
        rentalObject: {
          address: {
            street: result.data.Wohnung?.Strasse || "",
            streetNumber: result.data.Wohnung?.Hausnummer || "",
            zip: result.data.Wohnung?.Plz || "",
            city: result.data.Wohnung?.Ort || "",
          },
          rentalContract: {
            deposit: "1500",
            rent: "500",
            signedAt:
              result.data.Wohnungsübergabeprotokoll?.["Datum der Übergabe"] ||
              "",
            movedInAt: (() => {
              const futureDate = new Date();
              futureDate.setDate(futureDate.getDate() + 90);
              return `${futureDate.getDate().toString().padStart(2, "0")}.${(
                futureDate.getMonth() + 1
              )
                .toString()
                .padStart(2, "0")}.${futureDate.getFullYear()}`;
            })(),
            isLimited: "false",
            isExisting: "false",
          },
        },
        postalDestination: "digital",
        selling: {
          mieterengel: "false",
          keyFinder: "false",
        },
        step: "check",
      };
      // STEP 2: Submit data via POST request to create Bürgschaft
      await addTrace(`🚀 Cycle ${cycleId} - STEP 2: POST request to create Bürgschaft starting...`);
      const response = await axios.post(
        "https://api.stage.kautionsfrei.de/api/tenancies",
        mappedData
      );

      if (response.data) {
        await addTrace(`✅ Cycle ${cycleId} - Bürgschaft created successfully. CID: ${response.data.cid || "N/A"}`);
        
        // Immediately update UI with the response data
        setBurgschaftData(response.data);
        setBurgschaftLoading(false);
        
        // Handle errors if any
        if (response.data.errors) {
          // Check if errors is an object with field keys (structured format)
          if (
            typeof response.data.errors === "object" &&
            !Array.isArray(response.data.errors)
          ) {
            await addTrace(`❌ Cycle ${cycleId} - Response contained validation errors for ${
              Object.keys(response.data.errors).length
            } fields`);
  
            // Store the structured errors for display
            setBurgschaftData((prevData) => ({
              ...prevData,
              formattedErrors: Object.entries(response.data.errors).map(
                ([field, details]) => ({
                  field,
                  messages: details.message || [],
                  value: details.value,
                })
              ),
            }));
          }
          // Original array format handling
          else if (
            Array.isArray(response.data.errors) &&
            response.data.errors.length > 0
          ) {
            await addTrace(`❌ Cycle ${cycleId} - Response contained ${response.data.errors.length} validation errors`);
          }
        }
        
        // STEP 3: Wait 5 seconds before checking status (if CID is available)
        if (response.data.cid) {
          await addTrace(`⏱️ Cycle ${cycleId} - STEP 3: Waiting 5 seconds before checking status...`);
          
          // Set up countdown from 5 to 0
          setCountdown(5);
          
          // Wait 5 seconds with visual countdown
          for (let i = 5; i > 0; i--) {
            setCountdown(i);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          setCountdown(0);
          
          // STEP 4: Now check status
          await addTrace(`🔍 Cycle ${cycleId} - STEP 4: Checking application status for CID: ${response.data.cid}`);
          setStatusLoading(true);
          
          try {
            const statusResponse = await axios.get(
              `https://api.stage.kautionsfrei.de/api/application/state/${response.data.cid}`
            );
            
            if (statusResponse.data) {
              await addTrace(`✅ Cycle ${cycleId} - Status retrieved: ${statusResponse.data.state}`);
              setStatusData(statusResponse.data);
              
              // Check if cycle is completed and deactivate link
              if (statusResponse.data.state === "accepted" || statusResponse.data.state === "rejected") {
                if (clientLink && linkActive) {
                  setLinkActive(false);
                  await addTrace(`🔗 Client link deactivated - Cycle completed with status: ${statusResponse.data.state}`);
                  
                  // Log link deactivation to Firebase
                  await httpInterceptor.logCustomEvent('CLIENT_LINK_DEACTIVATED', 'Link deactivated due to cycle completion', {
                    cycleId: cycleId,
                    finalStatus: statusResponse.data.state,
                    deactivatedAt: new Date().toISOString(),
                    reason: 'cycle_completed'
                  });
                }
              }
            } else {
              await addTrace(`❓ Cycle ${cycleId} - Received empty status response`);
              setStatusError("No status data received");
            }
          } catch (statusErr) {
            console.error("Error fetching application status:", statusErr);
            await addTrace(`❌ Cycle ${cycleId} - Status check error: ${statusErr.message}`);
            setStatusError(statusErr.response?.data?.msg || "Failed to retrieve application status");
          } finally {
            setStatusLoading(false);
            setCountdown(null); // Reset countdown when done
          }
        } else {
          await addTrace(`⚠️ Cycle ${cycleId} - No CID received, cannot check application status`);
        }
      } else {
        await addTrace(`❌ Cycle ${cycleId} - Received empty response`);
        setBurgschaftError("No data received from server");
      }
    } catch (err) {
      console.error("Error creating Bürgschaft:", err);
  
      // Handle different types of errors
      if (err.response) {
        // The server responded with an error status code
        const statusCode = err.response.status;
        let errorMessage = err.response.data?.msg || "Unknown server error";
  
        // Check for structured errors in the error response
        if (
          err.response.data?.errors &&
          typeof err.response.data.errors === "object" &&
          !Array.isArray(err.response.data.errors)
        ) {
          const errorFields = Object.keys(err.response.data.errors);
          errorMessage = `Validation failed for ${
            errorFields.length
          } field(s): ${errorFields.join(", ")}`;
  
          // Store the structured errors for display
          setBurgschaftData({
            formattedErrors: Object.entries(err.response.data.errors).map(
              ([field, details]) => ({
                field,
                messages: details.message || [],
                value: details.value,
              })
            ),
          });
        }
  
        await addTrace(`❌ Server error (${statusCode}): ${errorMessage}`);
        setBurgschaftError(`Server error (${statusCode}): ${errorMessage}`);
      } else if (err.request) {
        // The request was made but no response was received
        await addTrace("❌ No response received from server");
        setBurgschaftError(
          "No response from server. Please check your connection."
        );
      } else {
        // Error in setting up the request
        await addTrace(`❌ Request error: ${err.message}`);
        setBurgschaftError(`Request failed: ${err.message}`);
      }
    } finally {
      // Re-enable button
      const submitButton = document.getElementById("submit-xcite-button");
      if (submitButton) {
        submitButton.disabled = false;
      }
      setBurgschaftLoading(false);
      setCountdown(null); // Ensure countdown is reset
    }
  }

  // Helper function to get status color
  const getStatusColor = (state) => {
    switch (state) {
      case "accepted":
        return "success";
      case "pending":
        return "warning";
      case "rejected":
        return "error";
      default:
        return "default";
    }
  };

  // Function to generate client self-service link
  const generateClientLink = async () => {
    console.log('Generate link clicked - Debug info:', {
      resultData: !!result?.data,
      cycleId: cycleId,
      hasResult: !!result
    });

    if (!result?.data) {
      await addTrace(`❌ Cannot generate link - no result data found`);
      return;
    }

    if (!cycleId) {
      await addTrace(`❌ Cannot generate link - no cycle ID found`);
      return;
    }

    try {
      setLinkGenerating(true);
      await addTrace(`🔗 Cycle ${cycleId} - Starting client self-service link generation...`);
      
      // Create a unique link ID
      const linkId = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate expiry time (74 hours from now)
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + 74);
      
      console.log('Generated link ID:', linkId);
      console.log('Expiry time:', expiryTime);
      
      // Create link data to store in Firebase
      const linkData = {
        linkId: linkId,
        cycleId: cycleId,
        clientData: result.data,
        environment: env,
        apiEnvironment: apiEnv,
        createdAt: new Date().toISOString(),
        expiresAt: expiryTime.toISOString(),
        status: 'active',
        active: true,
        completedAt: null,
        finalStatus: null,
        cid: null
      };

      // Store link data in Firebase via API
      await addTrace(`📡 Cycle ${cycleId} - Storing link data in Firebase...`);
      
      console.log('🔍 About to make API call to:', '/api/client-links');
      console.log('🔍 axios.defaults.baseURL:', axios.defaults.baseURL);
      console.log('🔍 Current window.location:', window.location.href);
      
      const createResponse = await axios.post('https://xcitev2api.albech.me/api/client-links', linkData);
      
      if (createResponse.data.success) {
        console.log('Firebase link creation successful:', createResponse.data);
        await addTrace(`✅ Link data stored successfully in Firebase`);
      } else {
        throw new Error('Failed to store link data');
      }

      // Generate the client URL
      const baseUrl = window.location.origin;
      const clientUrl = `${baseUrl}/client/${linkId}`;
      
      console.log('Generated client URL:', clientUrl);
      
      setClientLink(clientUrl);
      setLinkExpiry(expiryTime);
      setLinkActive(true);

      await addTrace(`✅ Cycle ${cycleId} - Client link generated: ${clientUrl}`);
      await addTrace(`⏰ Link expires at: ${expiryTime.toLocaleString()}`);

    } catch (error) {
      console.error('Error generating client link:', error);
      await addTrace(`❌ Cycle ${cycleId} - Failed to generate client link: ${error.message}`);
      
      // Additional error details for debugging
      if (error.response) {
        await addTrace(`🔍 Error response status: ${error.response.status}`);
        await addTrace(`🔍 Error response data: ${JSON.stringify(error.response.data)}`);
      }
    } finally {
      setLinkGenerating(false);
    }
  };

  // Function to copy link to clipboard
  const copyLinkToClipboard = async () => {
    if (!clientLink) {
      alert('No link available to copy');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(clientLink);
      await addTrace(`📋 Client link copied to clipboard`);
      // alert('✅ Link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = clientLink;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          await addTrace(`📋 Client link copied to clipboard (fallback method)`);
          alert('✅ Link copied to clipboard!');
        } else {
          alert('❌ Failed to copy link to clipboard. Please copy manually.');
        }
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
        alert('❌ Failed to copy link to clipboard. Please copy manually.');
      }
    }
  };

  // Trace viewer component.
  const TraceViewer = () => {
    if (!tracing || traceMessages.length === 0) return null;
    const cycleSummaryMessage = traceMessages.find((trace) =>
      trace.message.startsWith("CYCLE SUMMARY:")
    );
    const lastMessage = traceMessages[traceMessages.length - 1];
    const lastTimestamp = lastMessage ? lastMessage.time : "";
    const totalSteps = traceMessages.length;

    return (
      <Card sx={{ mt: 3, mb: 2 }}>
        <CardContent sx={{ py: 1 }}>
          {cycleSummaryMessage ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              <Box>
                <Typography
                  variant="body2"
                  color="primary"
                  sx={{ fontWeight: "medium" }}
                >
                  {cycleSummaryMessage.message.substring(15)} {/* Remove "CYCLE SUMMARY: " prefix */}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Completed at {cycleSummaryMessage.time}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {totalSteps} steps processed
              </Typography>
            </Box>
          ) : (
          ""
          )}
        </CardContent>
      </Card>
    );
  };

  // When results exist, display the result view; otherwise, show the form.
  if (result) {
    // Group the data for display
    const dataKeys = result.data ? Object.keys(result.data) : [];

    return (
      <>
        <Container
          maxWidth="lg"
          sx={{ py: { xs: 2, md: 4 }, px: { xs: 2, md: 4 }, minHeight: 'calc(100vh - 64px)' }}
        >
          <Paper sx={{ 
            p: { xs: 2, md: 4 }
          }}>
            <Typography variant="h6" align="center" gutterBottom>
              Background Check Results
            </Typography>
            <Typography
              variant="subtitle1"
              align="center"
              color="textSecondary"
              gutterBottom
            >
              {env === "test" ? "Test Environment" : "Real Environment"} Results
            </Typography>

            {/* Display trace viewer if tracing is enabled */}
            <TraceViewer />

            {result.data && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  gap: 3,
                  mt: 3,
                }}
              >
                {/* Right section - X-cite (now with all data) */}
                <Box
                  sx={{
                    flex: 1,
                    bgcolor: "rgba(245, 245, 245, 0.5)",
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <Box
                    sx={{
                      mb: 2,
                      pb: 1,
                      borderBottom: "1px solid #e0e0e0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                    }}
                  >
                    <Typography variant="h6" sx={{ color: "#1976d2" }}>
                      X-cite
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <Button
                        id="submit-xcite-button"
                        variant="contained"
                        color="primary"
                        size="small"
                        onClick={submitXCiteData}
                        disabled={burgschaftLoading}
                      >
                        {burgschaftLoading ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          "Insert to KautionFrei"
                        )}
                      </Button>
                      <Button
                        variant="outlined"
                        color="secondary"
                        size="small"
                        startIcon={linkGenerating ? <CircularProgress size={16} /> : <LinkIcon />}
                        onClick={() => {
                          console.log('Generate Link button clicked');
                          generateClientLink();
                        }}
                        disabled={!result?.data || !cycleId || linkGenerating}
                      >
                        {linkGenerating ? "Generating..." : "Generate Link"}
                      </Button>
                    </Box>
                    
                   
                  </Box>
                   {/* Display client self-service link after buttons */}
                    {clientLink && (
                      <Box
                        sx={{
                          mt: 2,
                          p: 2,
                          border: linkActive ? '2px solid #2196f3' : '2px solid #9e9e9e',
                          borderRadius: 1,
                          bgcolor: linkActive ? '#f3f9ff' : '#f5f5f5',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <LinkIcon fontSize="small" color={linkActive ? "primary" : "disabled"} />
                          <Typography 
                            variant="body2" 
                            color={linkActive ? "primary" : "textSecondary"} 
                            fontWeight="medium"
                          >
                            {linkActive 
                              ? "Client Self-Service Link" 
                              : "Client Self-Service Link (Inactive)"
                            }
                          </Typography>
                        </Box>
                        
                        <Typography variant="caption" sx={{ display: "block", mb: 1, color: "textSecondary" }}>
                          {linkActive 
                            ? "Share this link with your client to complete the process independently."
                            : "This link has been deactivated."
                          }
                          {linkExpiry && ` Valid until: ${linkExpiry.toLocaleString()}`}
                        </Typography>

                        <Box sx={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 1,
                          p: 1,
                          bgcolor: linkActive ? "white" : "#fafafa",
                          borderRadius: 1,
                          border: "1px solid #ddd",
                          opacity: linkActive ? 1 : 0.6
                        }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                              wordBreak: "break-all",
                              flex: 1,
                              color: linkActive ? "inherit" : "textSecondary"
                            }}
                          >
                            {clientLink}
                          </Typography>
                          <Button
                            size="small"
                            startIcon={<ContentCopyIcon />}
                            onClick={copyLinkToClipboard}
                            variant="outlined"
                            color="primary"
                            disabled={!linkActive}
                          >
                            Copy
                          </Button>
                        </Box>
                        
                        {!linkActive && (
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              display: "block", 
                              mt: 1, 
                              color: "error.main", 
                              fontStyle: "italic" 
                            }}
                          >
                            ⚠️ This link is no longer active and cannot be used by clients.
                          </Typography>
                        )}
                      </Box>
                    )}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {/* Render all sections in the X-cite column */}
                    {dataKeys.map((key) => (
                      <ResponseSection key={key} title={key} data={result.data[key]} />
                    ))}
                  </Box>
                </Box>
                {/* Left section - kaution with Bürgschaft data */}
                <Box
                  ref={kautionSectionRef}
                  sx={{
                    flex: 1,
                    bgcolor: "rgba(245, 245, 245, 0.5)",
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid #e0e0e0"
                  }}
                >
                  <Box
                    sx={{
                      mb: 2,
                      pb: 1,
                      borderBottom: "1px solid #e0e0e0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                    }}
                  >
                    <Typography variant="h6" sx={{ color: "#2e7d32" }}>
                      KautionFrei
                    </Typography>
                  </Box>

                  {/* Display Bürgschaft data or messages */}
                  {burgschaftLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : burgschaftData ? (
                    <Box sx={{ p: 2 }}>

                      {/* Stepper for KautionFrei Process */}
                      <Box sx={{ mb: 3 }}>
                        
                        {/* Step 1: Application Created */}
                        <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
                          <Box sx={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: "50%", 
                            bgcolor: burgschaftData.cid ? "#4caf50" : "#e0e0e0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mr: 2,
                            mt: 0.5,
                            flexShrink: 0
                          }}>
                            {burgschaftData.cid && (
                              <Typography variant="caption" sx={{ color: "white", fontWeight: "bold" }}>
                                ✓
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: "medium", mb: 0.5 }}>
                              Step 1: Application Submitted
                            </Typography>
                            {burgschaftData.cid ? (
                              <>
                                <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
                                  ✅ Successfully created - Contract ID: {burgschaftData.cid}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  Next Step: {burgschaftData.skip_to || "Pending review"}
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="body2" color="textSecondary">
                                Waiting for application submission...
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Connecting Line */}
                        {burgschaftData.cid && (
                          <Box sx={{ 
                            width: 2, 
                            height: 20, 
                            bgcolor: countdown !== null || statusData ? "#4caf50" : "#e0e0e0", 
                            ml: "11px", 
                            mb: 1 
                          }} />
                        )}

                        {/* Step 2: Status Check */}
                        <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
                          <Box sx={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: "50%", 
                            bgcolor: statusData ? "#4caf50" : (countdown !== null ? "#ff9800" : "#e0e0e0"),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mr: 2,
                            mt: 0.5,
                            flexShrink: 0
                          }}>
                            {statusData ? (
                              <Typography variant="caption" sx={{ color: "white", fontWeight: "bold" }}>
                                ✓
                              </Typography>
                            ) : countdown !== null ? (
                              <Typography variant="caption" sx={{ color: "white", fontWeight: "bold" }}>
                                {countdown}
                              </Typography>
                            ) : (
                              <Typography variant="caption" sx={{ color: "white", fontWeight: "bold" }}>
                                2
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: "medium", mb: 0.5 }}>
                              Step 2: Status Verification
                            </Typography>
                            {statusData ? (
                              <Box>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                  <Typography variant="body2" color="success.main">
                                    ✅ Status retrieved:
                                  </Typography>
                                  <Chip
                                    label={statusData.state}
                                    color={getStatusColor(statusData.state)}
                                    size="small"
                                  />
                                </Box>
                                <Typography variant="caption" color="textSecondary" sx={{ display: "block" }}>
                                  Order ID: {statusData.orderId} | Rate: {statusData.rate}€ | Digital: {statusData.digital === "true" ? "Yes" : "No"}
                                </Typography>
                              </Box>
                            ) : countdown !== null ? (
                              <Box>
                                <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
                                  🔄 Checking application status in {countdown} seconds...
                                </Typography>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={(5 - countdown) * 20} 
                                  sx={{ height: 6, borderRadius: 3, width: "100%" }}
                                />
                              </Box>
                            ) : burgschaftData.cid ? (
                              <Typography variant="body2" color="textSecondary">
                                Ready for status check...
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="textSecondary">
                                Waiting for application creation...
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Connecting Line */}
                        {statusData && (
                          <Box sx={{ 
                            width: 2, 
                            height: 20, 
                            bgcolor: (statusData.state === "accepted" || statusData.state === "rejected") ? "#4caf50" : "#e0e0e0", 
                            ml: "11px", 
                            mb: 1 
                          }} />
                        )}

                        {/* Step 3: Final Status */}
                        <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
                          <Box sx={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: "50%", 
                            bgcolor: (statusData?.state === "accepted" || statusData?.state === "rejected") ? "#4caf50" : "#e0e0e0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mr: 2,
                            mt: 0.5,
                            flexShrink: 0
                          }}>
                            {(statusData?.state === "accepted" || statusData?.state === "rejected") ? (
                              <Typography variant="caption" sx={{ color: "white", fontWeight: "bold" }}>
                                ✓
                              </Typography>
                            ) : (
                              <Typography variant="caption" sx={{ color: "white", fontWeight: "bold" }}>
                                3
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: "medium", mb: 0.5 }}>
                              Step 3: Process Complete
                            </Typography>
                            {statusData?.state === "accepted" ? (
                              <Typography variant="body2" color="success.main">
                                🎉 Application Accepted! Your KautionFrei guarantee has been approved.
                              </Typography>
                            ) : statusData?.state === "rejected" ? (
                              <Typography variant="body2" color="error.main">
                                ❌ Application Rejected. Please contact support for more information.
                              </Typography>
                            ) : statusData ? (
                              <Typography variant="body2" color="warning.main">
                                ⏳ Application is currently: {statusData.state}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="textSecondary">
                                Waiting for final decision...
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>

                      {/* Status Check Button - Always show if we have a CID */}
                      {burgschaftData.cid && !countdown && (
                        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
                          <Button
                            variant="contained"
                            size="medium"
                            onClick={() => checkApplicationStatus(burgschaftData.cid)}
                            disabled={statusLoading}
                            startIcon={
                              statusLoading ? <CircularProgress size={16} /> : <CachedIcon />
                            }
                            color="primary"
                            sx={{ minWidth: 160 }}
                          >
                            {statusLoading ? "Checking..." : "Get Current Status"}
                          </Button>
                        </Box>
                      )}

                      {/* Error Display */}
                      {statusError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          {statusError}
                        </Alert>
                      )}

                      {/* Display structured validation errors */}
                      {burgschaftData.formattedErrors &&
                        burgschaftData.formattedErrors.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{ color: "error.main", mb: 1 }}
                            >
                              Validation Errors:
                            </Typography>
                            <Box sx={{ bgcolor: "#ffebee", p: 2, borderRadius: 1 }}>
                              {burgschaftData.formattedErrors.map((error, index) => (
                                <Box
                                  key={index}
                                  sx={{
                                    mb: 2,
                                    pb:
                                      index <
                                      burgschaftData.formattedErrors.length - 1
                                        ? 2
                                        : 0,
                                    borderBottom:
                                      index <
                                      burgschaftData.formattedErrors.length - 1
                                        ? "1px solid #ffcdd2"
                                        : "none",
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: "medium",
                                      color: "#d32f2f",
                                    }}
                                  >
                                    Field: {error.field}
                                  </Typography>
                                  {error.messages.map((msg, msgIndex) => (
                                    <Typography
                                      key={msgIndex}
                                      variant="body2"
                                      color="error"
                                      sx={{ mt: 0.5 }}
                                    >
                                      • {msg}
                                    </Typography>
                                  ))}
                                  {error.value && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: "block",
                                        mt: 0.5,
                                        color: "#757575",
                                      }}
                                    >
                                      Current value:{" "}
                                      {typeof error.value === "object"
                                        ? JSON.stringify(error.value)
                                        : String(error.value)}
                                    </Typography>
                                  )}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        )}

                      {/* Keep original array error format handling for backward compatibility */}
                      {burgschaftData.errors &&
                        Array.isArray(burgschaftData.errors) &&
                        burgschaftData.errors.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{ color: "error.main", mb: 1 }}
                            >
                              Validation Errors:
                            </Typography>
                            <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
                              {burgschaftData.errors.map((error, index) => (
                                <li key={index}>
                                  <Typography variant="body2" color="error">
                                    {error}
                                  </Typography>
                                </li>
                              ))}
                            </ul>
                          </Box>
                        )}
                    </Box>
                  ) : burgschaftError ? (
                    <Alert severity="error" sx={{ m: 2 }}>
                      {burgschaftError}
                    </Alert>
                  ) : (
                    <Box sx={{ p: 2 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: "center", py: 2, fontStyle: "italic" }}
                      >
                        Click "Insert to KautionFrei" to begin the application process
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                justifyContent: "space-between",
                mt: 4,
                gap: 2,
              }}
            >
              <Button
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={async () => {
                  setResult(null);
                  setToken("");
                  setCycleId(null);
                  setCycleStartTime(null);
                  setBurgschaftData(null);
                  setBurgschaftError(null);
                  setStatusData(null);
                  setStatusError(null);
                  setCountdown(null);
                  setClientLink(null);
                  setLinkExpiry(null);
                  setLinkActive(false);
                  if (tracing) {
                    await addTrace("Reset application state - returning to form");
                  }
                }}
              >
                New Check
              </Button>
            </Box>
          </Paper>
        </Container>
        {/* Floating Action Button for mobile users */}
        {isMobile && (
          <Fab
            color="primary"
            aria-label="go-to-kaution"
            onClick={() => {
              if (kautionSectionRef.current) {
                kautionSectionRef.current.scrollIntoView({ behavior: "smooth" });
              }
            }}
            sx={{
              position: "fixed",
              bottom: 16,
              right: 16,
              zIndex: 2000,
            }}
          >
            <KeyboardArrowDownIcon />
          </Fab>
        )}
      </>
    );
  }

  return (
    <Container
      maxWidth="sm"
      sx={{ py: { xs: 2, md: 4 }, px: { xs: 2, md: 4 }, minHeight: 'calc(100vh - 64px)' }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: "center",
          mb: 3,
          gap: 2,
        }}
      >
       
        
      
        
        {/* Current API URL Display */}
        <Chip 
          label={`API: ${ENV_CONFIG[apiEnv].name}`}
          color={apiEnv === "PROD" ? "success" : "warning"}
          size="small"
          variant="outlined"
        />
      </Box>
      
      {/* API URL Information */}
      <Box sx={{ textAlign: "center", mb: 2 }}>
        <Typography variant="caption" color="textSecondary">
          Current API Endpoint: {ENV_CONFIG[apiEnv].apiUrl}
        </Typography>
      </Box>
      <Card sx={{ my: 4 }}>
        <CardContent>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: "flex", flexDirection: "row", gap: 3 }}
          >
            <TextField
              fullWidth
              label="Authentication Token"
              variant="outlined"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ height: "56px" }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Send"
              )}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Display trace viewer if tracing is enabled */}
      <TraceViewer />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Container>
  );
}

export default Home;