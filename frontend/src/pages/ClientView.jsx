import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import ReCAPTCHA from "react-google-recaptcha";
import {
    Container,
    Box,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    Alert,
    Button,
    LinearProgress,
    Chip,
    TextField,
    InputAdornment,
    FormControl,
    FormControlLabel,
    Radio,
    RadioGroup,
    Stepper,
    Step,
    StepLabel,
    ThemeProvider,
    createTheme,
    IconButton,
    Grid,
    Divider,
    ClickAwayListener,
    Paper,
    Checkbox
} from "@mui/material";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CachedIcon from "@mui/icons-material/Cached";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";

// Import trust badge images
import siegelFocusmoney from '../assets/siegel-focusmoney.png';
import siegelGetested from '../assets/siegel-getested.png';
import kfLogo from '../assets/kf.png';
import { httpInterceptor } from "../services/HTTPInterceptor";

// Create custom theme with the exact colors from the image
const customTheme = createTheme({
    palette: {
        primary: {
            main: '#8BC34A', // Exact green color from the image
            light: '#CDDC39',
            dark: '#689F38',
        },
    },
    typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        h5: {
            fontWeight: 600,
            fontSize: '1.5rem',
        },
        body1: {
            fontSize: '0.875rem',
            fontWeight: 400,
            color: '#333',
        },
        h6: {
            fontWeight: 600,
            fontSize: '1rem',
            color: '#333',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        }
    },
});

// Custom Tooltip Component matching the design
const CustomTooltip = ({ title, content, children }) => {
    const [open, setOpen] = useState(false);

    const handleClick = () => {
        setOpen(!open);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
            <IconButton
                onClick={handleClick}
                sx={{
                    p: 0.5,
                    color: '#8BC34A',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:hover': {
                        backgroundColor: 'rgba(139, 195, 74, 0.1)',
                        transform: 'scale(1.1)'
                    }
                }}
            >
                <HelpOutlineIcon sx={{ fontSize: '20px' }} />
            </IconButton>
            
            {open && (
                <ClickAwayListener onClickAway={handleClose}>
                    <Paper
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '40px',
                            transform: 'translateY(-50%)',
                            width: '650px',
                            backgroundColor: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '12px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                            zIndex: 1300,
                            mt: 2,
                            mb: 2,
                            animation: 'tooltipSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            transformOrigin: 'left center',
                            '@keyframes tooltipSlideIn': {
                                '0%': {
                                    opacity: 0,
                                    transform: 'translateY(-50%) translateX(-20px) scale(0.9)',
                                    visibility: 'hidden'
                                },
                                '100%': {
                                    opacity: 1,
                                    transform: 'translateY(-50%) translateX(0) scale(1)',
                                    visibility: 'visible'
                                }
                            }
                        }}
                    >
                        {/* Header without background color */}
                        <Box
                            sx={{
                                backgroundColor: 'transparent',
                                color: '#8BC34A',
                                p: 3,
                                borderRadius: '12px 12px 0 0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: '1px solid #f0f0f0'
                            }}
                        >
                            <Typography variant="h6" sx={{ 
                                fontWeight: 'bold', 
                                fontSize: '1.3rem',
                                color: '#8BC34A'
                            }}>
                                {title}
                            </Typography>
                            <IconButton
                                onClick={handleClose}
                                size="small"
                                sx={{
                                    color: '#666',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(139, 195, 74, 0.1)',
                                        color: '#8BC34A',
                                        transform: 'rotate(90deg)'
                                    }
                                }}
                            >
                                <CloseIcon sx={{ fontSize: '22px' }} />
                            </IconButton>
                        </Box>
                        
                        {/* Content */}
                        <Box sx={{ 
                            p: 4,
                            '& .MuiTypography-root': {
                                fontSize: '16px !important'
                            }
                        }}>
                            {content}
                        </Box>
                    </Paper>
                </ClickAwayListener>
            )}
            {children}
        </Box>
    );
};

const ClientView = () => {
    const { linkId } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [linkData, setLinkData] = useState(null);
    const [processStatus, setProcessStatus] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [burgschaftData, setBurgschaftData] = useState(null);
    const [statusData, setStatusData] = useState(null);
    const [statusLoading, setStatusLoading] = useState(false);
    const [countdown, setCountdown] = useState(null);
    const [isProcessCompleted, setIsProcessCompleted] = useState(false);

    // New state variables for kaution form
    const [kautionAmount, setKautionAmount] = useState('1000');
    const [paymentMethod, setPaymentMethod] = useState('monthly');
    const [currentStep, setCurrentStep] = useState(1); // Add current step state
    const [recaptchaValue, setRecaptchaValue] = useState(null); // reCAPTCHA verification
    const [showSummary, setShowSummary] = useState(true); // Control summary visibility
    
    // Consent checkboxes state
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [documentsAccepted, setDocumentsAccepted] = useState(false);
    const [hideConsentSection, setHideConsentSection] = useState(false);

    // Function to get next step button text
    const getNextStepButtonText = (step) => {
        switch(step) {
            case 1: return 'WEITER ZUM MIETOBJEKT';
            case 2: return 'WEITER ZUR ZAHLUNG';
            case 3: return 'WEITER ZU EXTRAS';
            case 4: return 'ANTRAG ABSCHICKEN';
            default: return 'WEITER';
        }
    };

    // Custom StepIcon component matching the design image
    const CustomStepIcon = (props) => {
        const { active, completed, icon } = props;
        
        return (
            <Box
                sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.95px solid',
                    borderColor: (completed || active) ? '#8BC34A' : '#C3C3BF',
                    backgroundColor: completed ? '#8BC34A' : '#FFFFFF',
                    color: completed ? '#FFFFFF' : (active ? '#8BC34A' : '#B0B0B0'),
                    fontSize: '0.75rem',
                    fontWeight: 'normal',
                    transition: 'all 0.3s ease'
                }}
            >
                {completed ? <CheckIcon sx={{ fontSize: '0.8rem' }} /> : icon}
            </Box>
        );
    };

    // Summary Section Component - Updated to match image layout exactly
    const SummarySection = ({ title, children, isLast = false }) => (
        <Box sx={{ mb: isLast ? 3 : 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Typography variant="h6" sx={{ 
                    fontWeight: 'bold', 
                    fontSize: '16px',
                    letterSpacing: '1px',
                    color: '#333',
                    textTransform: 'uppercase'
                }}>
                    {title}
                </Typography>
                <Typography sx={{ 
                    fontSize: '14px',
                    color: '#999',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    '&:hover': {
                        color: '#666'
                    }
                }}>
                    Editieren
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {children}
            </Box>
            {!isLast && <Box sx={{ mt: 3, mb: 1, height: '1px', backgroundColor: '#e0e0e0' }} />}
        </Box>
    );

    // Summary Item Component - Updated to match image layout exactly
    const SummaryItem = ({ label, value }) => (
        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography variant="body2" sx={{ 
                color: '#666', 
                fontSize: '14px', 
                fontStyle: 'italic',
                minWidth: '140px',
                lineHeight: 1.4
            }}>
                {label}:
            </Typography>
            <Typography variant="body2" sx={{ 
                color: '#333', 
                fontSize: '14px', 
                fontWeight: '500',
                textAlign: 'right',
                flex: 1,
                lineHeight: 1.4
            }}>
                {value || '-'}
            </Typography>
        </Box>
    );

    // Additional form state variables
    const [formData, setFormData] = useState({
        // Personal Information
        anrede: '',
        vorname: '',
        nachname: '',
        geburtsdatum: '',
        nationalitat: 'Deutschland',
        telefonnummer: '',
        emailAdresse: '',
        // Current Address
        aktuelleStrasse: '',
        aktuelleHausnummer: '',
        aktuellePostleitzahl: '',
        aktuelleStadt: '',
        // Optional second tenant
        zweiterMieter: false,
        zweiterMieterName: '',
        // Rental Property Address
        mietobjektStrasse: '',
        mietobjektHausnummer: '',
        mietobjektPostleitzahl: '',
        mietobjektStadt: '',
        // Landlord
        vermieterName: '',
        // Lease Information
        mietbeginn: '',
        mietvertragBefristet: 'nein',
        // Banking
        iban: '',
        kreditinstitut: '',
        // Broker ID (Optional)
        vermittlerId: '',
        // Delivery method
        versandMethode: 'digital'
    });

    // Calculate estimates based on amount and 5.2% factor
    const monthlyEstimate = (parseFloat(kautionAmount) || 0) * 0.052 / 12;
    const yearlyEstimate = (parseFloat(kautionAmount) || 0) * 0.052;

    // Load link data and validate
    useEffect(() => {
        const loadLinkData = async () => {
            try {
                setLoading(true);

                // Fetch link data from Firebase
                const response = await axios.get(`/api/client-links/${linkId}`);
                
                if (!response.data || !response.data.success) {
                    setError("Ungültiger Link oder Link nicht gefunden. Bitte überprüfen Sie die URL und versuchen Sie es erneut.");
                    return;
                }

                const linkInfo = response.data.data;
                const now = new Date();
                const expiryTime = new Date(linkInfo.expiresAt);

                // Check if link is expired
                const isExpired = now > expiryTime;
                const isCompleted = linkInfo.status === 'completed';

                if (isExpired) {
                    setError("Dieser Link ist abgelaufen und kann nicht mehr verwendet werden.");
                    return;
                }

                if (isCompleted) {
                    setError("Dieser Prozess wurde bereits abgeschlossen und der Link wurde deaktiviert.");
                    return;
                }

                // Check if link is active
                if (!linkInfo.active) {
                    setError("Dieser Link wurde deaktiviert und kann nicht mehr verwendet werden.");
                    return;
                }

                // Set the link data from Firebase
                setLinkData({
                    linkId: linkId,
                    cycleId: linkInfo.cycleId,
                    expiresAt: expiryTime,
                    clientData: linkInfo.clientData,
                    active: linkInfo.active,
                    status: linkInfo.status
                });

                // Pre-populate form with existing data if available
                if (linkInfo.clientData) {
                    setFormData(prev => ({
                        ...prev,
                        anrede: linkInfo.clientData?.Mieter?.Anrede || '',
                        vorname: linkInfo.clientData?.Mieter?.Vorname || '',
                        nachname: linkInfo.clientData?.Mieter?.Name || '',
                        geburtsdatum: linkInfo.clientData?.Mieter?.Geburtsdatum || '',
                        emailAdresse: linkInfo.clientData?.Mieter?.Emailadresse || '',
                        mietobjektStrasse: linkInfo.clientData?.Wohnung?.Strasse || '',
                        mietobjektHausnummer: linkInfo.clientData?.Wohnung?.Hausnummer || '',
                        mietobjektPostleitzahl: linkInfo.clientData?.Wohnung?.Plz || '',
                        mietobjektStadt: linkInfo.clientData?.Wohnung?.Ort || ''
                    }));
                }

            } catch (err) {
                console.error('Error loading link data:', err);
                if (err.response?.status === 404) {
                    setError("Link nicht gefunden. Bitte überprüfen Sie die URL und versuchen Sie es erneut.");
                } else if (err.response?.status === 410) {
                    setError("Dieser Link ist abgelaufen und kann nicht mehr verwendet werden.");
                } else {
                    setError("Fehler beim Laden der Link-Informationen. Bitte überprüfen Sie die URL und versuchen Sie es erneut.");
                }
            } finally {
                setLoading(false);
            }
        };

        if (linkId) {
            loadLinkData();
        } else {
            setError("Ungültiger Link - keine Link-ID bereitgestellt.");
            setLoading(false);
        }
    }, [linkId]);

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

    // Function to handle submit button click
    const handleSubmitClick = () => {
        // Check if the button shows "Bitte akzeptieren Sie alle Bedingungen"
        if (!privacyAccepted || !documentsAccepted) {
            // Hide the consent section
            setHideConsentSection(true);
            return;
        }
        
        // If all conditions are met, proceed with the normal submission
        insertToKautionFrei();
    };

    // Function to insert data to KautionFrei
    const insertToKautionFrei = async () => {
        if (!linkData) return;

        try {
            setProcessing(true);
            setShowSummary(false); // Hide summary when starting the process

            // Log that client started the KautionFrei process
            await httpInterceptor.logCustomEvent('CLIENT_KAUTIONFREI_STARTED', 'Client started KautionFrei insertion process', {
                linkId: linkId,
                cycleId: linkData.cycleId,
                startedAt: new Date().toISOString(),
                clientEmail: linkData.clientData?.Mieter?.Emailadresse
            });

            // Simulate the KautionFrei API call (this would be a real API call)
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Simulate successful response with CID
            const mockResponse = {
                cid: `CID-${Date.now()}`,
                skip_to: "document_signing"
            };

            setBurgschaftData(mockResponse);

            // Start countdown for status check
            setCountdown(10);
            for (let i = 10; i > 0; i--) {
                setCountdown(i);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            setCountdown(0);

            // Simulate status check
            setStatusLoading(true);
            await new Promise(resolve => setTimeout(resolve, 2000));

            const mockStatus = {
                state: "pending",
                orderId: `ORDER-${Date.now()}`,
                rate: "29.90",
                digital: "true"
            };

            setStatusData(mockStatus);
            setStatusLoading(false);

            // Mark process as completed when status is received
            setIsProcessCompleted(true);
            
            // Update link status in Firebase to mark as completed
            try {
                await axios.put(`/api/client-links/${linkId}/complete`, {
                    status: 'completed',
                    finalStatus: mockStatus.state,
                    completedAt: new Date().toISOString(),
                    cid: mockResponse.cid
                });
            } catch (updateErr) {
                console.error('Error updating link status:', updateErr);
            }
            
            // Log that the process is completed and link should be deactivated
            await httpInterceptor.logCustomEvent('CLIENT_PROCESS_COMPLETED', 'Client process completed - link should be deactivated', {
                linkId: linkId,
                cycleId: linkData.cycleId,
                completedAt: new Date().toISOString(),
                finalStatus: mockStatus.state,
                cid: mockResponse.cid
            });

        } catch (err) {
            console.error('Error during KautionFrei process:', err);
            setError("Ein Fehler ist während der Verarbeitung aufgetreten. Bitte kontaktieren Sie den Support.");
        } finally {
            setProcessing(false);
        }
    };

    // Function to check current status
    const checkCurrentStatus = async () => {
        if (!burgschaftData?.cid) return;

        setStatusLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Simulate updated status
            const updatedStatus = {
                state: Math.random() > 0.5 ? "accepted" : "pending",
                orderId: statusData?.orderId || `ORDER-${Date.now()}`,
                rate: "29.90",
                digital: "true"
            };

            setStatusData(updatedStatus);
            
            // If status is final (accepted or rejected), mark process as completed
            if (updatedStatus.state === "accepted" || updatedStatus.state === "rejected") {
                setIsProcessCompleted(true);
                
                // Update link status in Firebase to mark as completed
                try {
                    await axios.put(`/api/client-links/${linkId}/complete`, {
                        status: 'completed',
                        finalStatus: updatedStatus.state,
                        completedAt: new Date().toISOString(),
                        cid: burgschaftData?.cid
                    });
                } catch (updateErr) {
                    console.error('Error updating link status:', updateErr);
                }
                
                // Log that the process is completed and link should be deactivated
                await httpInterceptor.logCustomEvent('CLIENT_STATUS_FINAL', 'Client received final status - link deactivated', {
                    linkId: linkId,
                    cycleId: linkData?.cycleId,
                    completedAt: new Date().toISOString(),
                    finalStatus: updatedStatus.state,
                    cid: burgschaftData?.cid
                });
            }
        } catch (err) {
            console.error('Error checking status:', err);
        } finally {
            setStatusLoading(false);
        }
    };
    const startSelfService = async () => {
        if (!linkData) return;

        try {
            setProcessing(true);

            // Log that client started the process
            await httpInterceptor.logCustomEvent('CLIENT_SELF_SERVICE_STARTED', 'Client started self-service process', {
                linkId: linkId,
                cycleId: linkData.cycleId,
                startedAt: new Date().toISOString(),
                clientEmail: linkData.clientData?.Mieter?.Emailadresse
            });

            // Simulate processing steps
            const steps = [
                "Validating client information...",
                "Processing application...",
                "Checking with KautionFrei...",
                "Finalizing application...",
                "Application completed successfully!"
            ];

            for (let i = 0; i < steps.length; i++) {
                setProcessStatus({ step: i + 1, total: steps.length, message: steps[i] });
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Log completion
            await httpInterceptor.logCustomEvent('CLIENT_SELF_SERVICE_COMPLETED', 'Client completed self-service process', {
                linkId: linkId,
                cycleId: linkData.cycleId,
                completedAt: new Date().toISOString(),
                finalStatus: 'completed'
            });

            setProcessStatus({
                step: steps.length,
                total: steps.length,
                message: "Process completed successfully!",
                completed: true
            });

        } catch (err) {
            console.error('Error during self-service process:', err);
            setError("An error occurred during processing. Please contact support.");
        } finally {
            setProcessing(false);
        }
    };

    // Function to copy address from main tenant to second tenant
    const copyAddressFromMainTenant = () => {
        setFormData(prev => ({
            ...prev,
            zweiterMieterStrasse: prev.aktuelleStrasse || '',
            zweiterMieterHausnummer: prev.aktuelleHausnummer || '',
            zweiterMieterPostleitzahl: prev.aktuellePostleitzahl || '',
            zweiterMieterStadt: prev.aktuelleStadt || ''
        }));
    };

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={40} />
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Alert severity="error" icon={<ErrorIcon />}>
                    {error}
                </Alert>
            </Container>
        );
    }

    if (!linkData) {
        return (
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Alert severity="warning">
                    Keine Link-Daten gefunden. Bitte überprüfen Sie die URL und versuchen Sie es erneut.
                </Alert>
            </Container>
        );
    }

    // Check if process is completed and disable further access
    if (isProcessCompleted) {
        return (
            <ThemeProvider theme={customTheme}>
                <Box sx={{ 
                    minHeight: '100vh', 
                    backgroundColor: '#fafafa',
                    py: 4
                }}>
                    <Container maxWidth="md">
                        <Card sx={{ boxShadow: 3 }}>
                            <CardContent sx={{ p: 4, textAlign: 'center' }}>
                                <Box sx={{ mb: 4 }}>
                                    <CheckCircleIcon 
                                        sx={{ fontSize: 80, color: '#7CB342', mb: 2 }} 
                                    />
                                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#7CB342' }}>
                                        Prozess erfolgreich abgeschlossen
                                    </Typography>
                                    <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                                        Ihr KautionFrei Antrag wurde bearbeitet und dieser Link wurde deaktiviert.
                                    </Typography>
                                    
                                    {statusData && (
                                        <Box sx={{ mb: 3 }}>
                                            <Chip
                                                label={`Final Status: ${statusData.state.toUpperCase()}`}
                                        color={getStatusColor(statusData.state)}
                                        sx={{ fontSize: '1rem', py: 3, px: 2 }}
                                    />
                                    {statusData.orderId && (
                                        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                                            Bestell-ID: {statusData.orderId}
                                        </Typography>
                                    )}
                                </Box>
                            )}
                            
                            <Alert severity="info" sx={{ mt: 3 }}>
                                Dieser Link wurde aus Sicherheitsgründen dauerhaft deaktiviert. 
                                Wenn Sie Hilfe benötigen, kontaktieren Sie bitte den Support.
                            </Alert>
                        </Box>
                        
                        {/* Footer */}
                        <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #eee', textAlign: 'center' }}>
                            <Typography variant="caption" color="textSecondary">
                                Link ID: {linkId} | Prozess abgeschlossen
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    </ThemeProvider>
        );
    }

    return (
        <ThemeProvider theme={customTheme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Box sx={{ 
                    minHeight: '100vh', 
                    backgroundColor: '#ffffff',
                    py: 4
                }}>
                <Container maxWidth="xl">
                    <Card sx={{ 
                        boxShadow: 'none',
                        border: 'none',
                        backgroundColor: '#ffffff'
                    }}>
                        <CardContent sx={{ p: 4 }}>



                    {/* Link validity info */}
                    <Box sx={{ mb: 4, p: 2, bgcolor: '#f0f7ff', borderRadius: 1, border: '1px solid #2196f3' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <AccessTimeIcon fontSize="small" color="primary" />
                            <Typography variant="body2" color="primary" fontWeight="medium">
                                Link gültig bis: {linkData.expiresAt.toLocaleString()}
                            </Typography>
                        </Box>
                        <Typography variant="caption" color="textSecondary">
                            Dieser Link läuft automatisch nach dem oben genannten Datum ab.
                        </Typography>
                    </Box>

                    {/* Two-Column Layout */}
                    <Box sx={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                        
                        {/* Left Column - Main Form Content */}
                        <Box sx={{ 
                            flex: 1.5,
                            backgroundColor: '#ffffff',
                            p: 3,
                            minHeight: '600px',
                            // borderRadius: 2,
                            // boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }}>

                            {/* Step Progress Indicator - Only for left column */}
                            <Box sx={{ mb: 4 }}>
                                <Stepper activeStep={currentStep - 1} alternativeLabel sx={{
                                    width: '100%',
                                    margin: '0',
                                    padding: '8px 0',
                                    '& .MuiStepLabel-root': {
                                        padding: '0 4px',
                                        cursor: 'pointer',
                                        '&:hover .MuiStepLabel-label': {
                                            color: '#000000'
                                        }
                                    },
                                    '& .MuiStepLabel-label': {
                                        fontWeight: 400,
                                        fontSize: '0.8rem',
                                        marginTop: '6px',
                                        color: '#B0B0B0',
                                        cursor: 'pointer',
                                        transition: 'color 0.3s ease',
                                        '&:hover': {
                                            color: '#000000'
                                        },
                                        '&.Mui-active': {
                                            color: '#8BC34A',
                                            fontWeight: 500
                                        },
                                        '&.Mui-completed': {
                                            color: '#8BC34A',
                                            fontWeight: 400
                                        }
                                    },
                                    '& .MuiStepConnector-root': {
                                        top: 16,
                                        left: 'calc(-50% + 16px)',
                                        right: 'calc(50% + 16px)',
                                        padding: 0
                                    },
                                    '& .MuiStepConnector-line': {
                                        borderTopWidth: '1px',
                                        borderColor: '#E0E0E0',
                                        borderRadius: 0
                                    },
                                    '& .MuiStepConnector-root.Mui-active .MuiStepConnector-line': {
                                        borderColor: '#E0E0E0'
                                    },
                                    '& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line': {
                                        borderColor: '#8BC34A'
                                    },
                                    '& .MuiStep-root': {
                                        padding: 0
                                    }
                                }}>
                                    <Step>
                                        <StepLabel StepIconComponent={CustomStepIcon}>Mieter</StepLabel>
                                    </Step>
                                    <Step>
                                        <StepLabel StepIconComponent={CustomStepIcon}>Mietobjekt</StepLabel>
                                    </Step>
                                    <Step>
                                        <StepLabel StepIconComponent={CustomStepIcon}>Zahlung</StepLabel>
                                    </Step>
                                    <Step>
                                        <StepLabel StepIconComponent={CustomStepIcon}>Extras</StepLabel>
                                    </Step>
                                </Stepper>
                            </Box>

                    {/* Personal Information Section - Step 1 */}
                    {currentStep === 1 && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h6" gutterBottom sx={{ 
                                fontWeight: 'bold', 
                                mb: 4, 
                                fontSize: '15px',
                                letterSpacing: '0.5px',
                                color: '#333'
                            }}>
                                PERSÖNLICHE ANGABEN
                            </Typography>

                            {/* Anrede Selection */}
                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="body1" gutterBottom sx={{ 
                                    fontWeight: 'medium', 
                                    mb: 0.5,
                                    color: '#333',
                                    fontSize: '0.8rem'
                                }}>
                                    Anrede
                                </Typography>
                                <Box sx={{ display: 'flex', borderRadius: 1 }}>
                                    <Button
                                        variant="outlined"
                                        onClick={() => setFormData(prev => ({...prev, anrede: 'Herr'}))}
                                        sx={{
                                            flex: 1,
                                            borderRadius: '4px 0 0 4px',
                                            border: '1px solid #d0d0d0',
                                            bgcolor: formData.anrede === 'Herr' ? '#B8B8B8' : '#FFFFFF',
                                            color: formData.anrede === 'Herr' ? '#FFFFFF' : '#333',
                                            minHeight: '38px',
                                            '&:hover': { 
                                                bgcolor: formData.anrede === 'Herr' ? '#A8A8A8' : '#f0f0f0',
                                                border: '1px solid #8BC34A'
                                            },
                                            textTransform: 'none',
                                            fontWeight: 'normal',
                                            py: 0.5,
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        Herr
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() => setFormData(prev => ({...prev, anrede: 'Frau'}))}
                                        sx={{
                                            flex: 1,
                                            borderRadius: '0 4px 4px 0',
                                            border: '1px solid #d0d0d0',
                                            borderLeft: 'none',
                                            bgcolor: formData.anrede === 'Frau' ? '#B8B8B8' : '#FFFFFF',
                                            color: formData.anrede === 'Frau' ? '#FFFFFF' : '#333',
                                            minHeight: '38px',
                                            '&:hover': { 
                                                bgcolor: formData.anrede === 'Frau' ? '#A8A8A8' : '#f0f0f0',
                                                border: '1px solid #8BC34A',
                                                borderLeft: 'none'
                                            },
                                            textTransform: 'none',
                                            fontWeight: 'normal',
                                            py: 0.5,
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        Frau
                                    </Button>
                                </Box>
                            </Box>

                            {/* Name Fields */}
                            <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1" gutterBottom sx={{ 
                                        fontWeight: 'medium', 
                                        mb: 0.3,
                                        color: '#333',
                                        fontSize: '0.8rem'
                                    }}>
                                        Vorname
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        placeholder="Hedsoft"
                                        value={formData.vorname || 'Hedsoft'}
                                        InputProps={{
                                            readOnly: true,
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '4px',
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #d0d0d0',
                                                minHeight: '38px',
                                                boxShadow: 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)',
                                                '& .MuiInputBase-input': {
                                                    padding: '4px 8px',
                                                    fontSize: '0.8rem',
                                                },
                                                '& fieldset': {
                                                    border: 'none',
                                                },
                                                '&:hover fieldset': {
                                                    border: 'none',
                                                },
                                                '&.Mui-focused': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&.Mui-focused fieldset': {
                                                    border: 'none',
                                                },
                                            },
                                        }}
                                    />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1" gutterBottom sx={{ 
                                        fontWeight: 'medium', 
                                        mb: 0.3,
                                        color: '#333',
                                        fontSize: '0.8rem'
                                    }}>
                                        Nachname
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        placeholder="Mustermann"
                                        value=""
                                        error={true}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '4px',
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #f44336',
                                                minHeight: '38px',
                                                boxShadow: 'inset 0 2px 8px rgba(244, 67, 54, 0.4), inset 0 1px 4px rgba(244, 67, 54, 0.3)',
                                                '& .MuiInputBase-input': {
                                                    padding: '4px 8px',
                                                    fontSize: '0.8rem',
                                                },
                                                '& fieldset': {
                                                    border: 'none',
                                                },
                                                '&:hover fieldset': {
                                                    border: 'none',
                                                },
                                                '&.Mui-focused': {
                                                    border: '1px solid #f44336',
                                                },
                                                '&.Mui-focused fieldset': {
                                                    border: 'none',
                                                },
                                            },
                                        }}
                                    />
                                    {/* Error message */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                        <Box sx={{ 
                                            width: 0, 
                                            height: 0, 
                                            borderLeft: '6px solid transparent',
                                            borderRight: '6px solid transparent',
                                            borderBottom: '8px solid #f44336',
                                            mr: 0.5
                                        }} />
                                        <Typography sx={{ 
                                            color: '#f44336', 
                                            fontSize: '0.75rem',
                                            fontWeight: 'normal'
                                        }}>
                                            Geben Sie Ihren Nachnamen an
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>

                            {/* Geburtsdatum */}
                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="body1" gutterBottom sx={{ 
                                    fontWeight: 'medium', 
                                    mb: 0.3,
                                    color: '#333',
                                    fontSize: '0.8rem'
                                }}>
                                    Geburtsdatum
                                </Typography>
                                <TextField
                                    fullWidth
                                    placeholder="05.04.1970"
                                    value={formData.geburtsdatum || '05.04.1970'}
                                    InputProps={{
                                        readOnly: true,
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem', mr: 0.5 }} />
                                                <Box sx={{ 
                                                    bgcolor: '#f0f0f0', 
                                                    p: 0.3, 
                                                    borderRadius: 0.3,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    fontSize: '0.7rem'
                                                }}>
                                                    📅
                                                </Box>
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '4px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #d0d0d0',
                                            minHeight: '38px',
                                            boxShadow: 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)',
                                            '& .MuiInputBase-input': {
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                            },
                                            '& fieldset': {
                                                border: 'none',
                                            },
                                            '&:hover': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&:hover fieldset': {
                                                border: 'none',
                                            },
                                            '&.Mui-focused': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: 'none',
                                            },
                                        },
                                    }}
                                />
                            </Box>

                            {/* Nationalität */}
                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="body1" gutterBottom sx={{ 
                                    fontWeight: 'medium', 
                                    mb: 0.3,
                                    color: '#333',
                                    fontSize: '0.8rem'
                                }}>
                                    Nationalität
                                </Typography>
                                <TextField
                                    fullWidth
                                    value={formData.nationalitat || 'Deutschland'}
                                    InputProps={{
                                        readOnly: true,
                                    }}
                                    select
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '4px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #d0d0d0',
                                            minHeight: '38px',
                                            '& .MuiInputBase-input': {
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                            },
                                            '& fieldset': {
                                                border: 'none',
                                            }, 
                                            '&:hover': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&:hover fieldset': {
                                                border: 'none',
                                            },
                                            '&.Mui-focused': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: 'none',
                                            },
                                        },
                                    }}
                                    SelectProps={{
                                        native: true,
                                    }}
                                >
                                    <option value="Deutschland">Deutschland</option>
                                    <option value="Österreich">Österreich</option>
                                    <option value="Schweiz">Schweiz</option>
                                    <option value="Frankreich">Frankreich</option>
                                    <option value="Italien">Italien</option>
                                    <option value="Spanien">Spanien</option>
                                    <option value="Niederlande">Niederlande</option>
                                    <option value="Belgien">Belgien</option>
                                    <option value="Polen">Polen</option>
                                    <option value="Tschechien">Tschechien</option>
                                    <option value="Ungarn">Ungarn</option>
                                    <option value="Kroatien">Kroatien</option>
                                    <option value="Türkei">Türkei</option>
                                    <option value="Russland">Russland</option>
                                    <option value="Ukraine">Ukraine</option>
                                    <option value="Vereinigtes Königreich">Vereinigtes Königreich</option>
                                    <option value="USA">USA</option>
                                    <option value="Kanada">Kanada</option>
                                    <option value="Brasilien">Brasilien</option>
                                    <option value="China">China</option>
                                    <option value="Japan">Japan</option>
                                    <option value="Indien">Indien</option>
                                    <option value="Australien">Australien</option>
                                    <option value="Andere">Andere</option>
                                </TextField>
                            </Box>

                            {/* Contact Information */}
                            <Typography variant="h6" gutterBottom sx={{ 
                                fontWeight: 'bold', 
                                mt: 2, 
                                mb: 1.5,
                                fontSize: '15px',
                                letterSpacing: '0.3px',
                                color: '#333'
                            }}>
                                KONTAKTDATEN
                            </Typography>

                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="body1" gutterBottom sx={{ 
                                    fontWeight: 'medium', 
                                    mb: 0.3,
                                    color: '#333',
                                    fontSize: '0.8rem'
                                }}>
                                    Email-Adresse <span style={{color: 'red'}}>*</span>
                                </Typography>
                                <TextField
                                    fullWidth
                                    type="email"
                                    placeholder="max.mustermann@email.com"
                                    value={formData.emailAdresse}
                                    onChange={(e) => setFormData(prev => ({...prev, emailAdresse: e.target.value}))}
                                    InputProps={{
                                        endAdornment: formData.emailAdresse ? (
                                            <InputAdornment position="end">
                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                            </InputAdornment>
                                        ) : null,
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '4px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #d0d0d0',
                                            minHeight: '38px',
                                            boxShadow: formData.emailAdresse 
                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                : 'none',
                                            '& .MuiInputBase-input': {
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                            },
                                            '& fieldset': {
                                                border: 'none',
                                            },
                                            '&:hover': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&:hover fieldset': {
                                                border: 'none',
                                            },
                                            '&.Mui-focused': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: 'none',
                                            },
                                        },
                                    }}
                                />
                            </Box>

                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="body1" gutterBottom sx={{ 
                                    fontWeight: 'medium', 
                                    mb: 0.3,
                                    color: '#333',
                                    fontSize: '0.8rem'
                                }}>
                                    Telefonnummer <span style={{color: 'red'}}>*</span>
                                </Typography>
                                <TextField
                                    fullWidth
                                    placeholder="+4901234567"
                                    value={formData.telefonnummer}
                                    onChange={(e) => setFormData(prev => ({...prev, telefonnummer: e.target.value}))}
                                    InputProps={{
                                        endAdornment: formData.telefonnummer ? (
                                            <InputAdornment position="end">
                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                            </InputAdornment>
                                        ) : null,
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '4px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #d0d0d0',
                                            minHeight: '38px',
                                            boxShadow: formData.telefonnummer 
                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                : 'none',
                                            '& .MuiInputBase-input': {
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                            },
                                            '& fieldset': {
                                                border: 'none',
                                            },
                                            '&:hover': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&:hover fieldset': {
                                                border: 'none',
                                            },
                                            '&.Mui-focused': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: 'none',
                                            },
                                        },
                                    }}
                                />
                            </Box>

                            {/* Current Address */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                <Typography variant="h6" sx={{ 
                                    fontWeight: 'bold', 
                                    mt: 2, 
                                    fontSize: '15px',
                                    letterSpacing: '0.3px',
                                    color: '#333'
                                }}>
                                    AKTUELLE ADRESSE
                                </Typography>
                                <CustomTooltip 
                                    title="Meldeadresse"
                                    content={
                                        <>
                                            <Typography variant="body1" sx={{ mb: 1.5, lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                Ihre aktuelle Meldeadresse finden Sie in der Anmeldebestätigung 
                                                Ihres zuständigen Bürgeramtes oder auf der Rückseite Ihres 
                                                Personalausweises.
                                            </Typography>
                                            <Typography variant="body1" sx={{ mb: 1.5, lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                Um Ihnen das Ausfüllen der Adressfelder zu erleichtern, werden 
                                                Ihnen schon bei der Eingabe Ihrer Straße Vorschläge unterhalb 
                                                der Suchbox angezeigt. Wählen Sie Ihre Adresse aus der 
                                                Ergebnisliste aus, die anderen Adressfelder vervollständigen sich 
                                                nun automatisch. Prüfen und ergänzen Sie gegebenenfalls die 
                                                Daten im Formular.
                                            </Typography>
                                            <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                Natürlich können Sie Ihre Daten auch gern manuell in die Felder 
                                                darunter eingeben. Sie haben weitere Fragen zur 
                                                Vervollständigung des Adressformulars? Melden Sie sich gern bei 
                                                unserem Kundenservice unter der Rufnummer 0800 - 01 22 333
                                            </Typography>
                                        </>
                                    }
                                />
                            </Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1.5 }}>
                                Bitte tragen Sie hier Ihre aktuelle Adresse laut Personalausweis ein.
                            </Typography>

                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="body1" gutterBottom sx={{ 
                                    fontWeight: 'medium', 
                                    mb: 0.3,
                                    color: '#333',
                                    fontSize: '0.8rem'
                                }}>
                                    Straße <span style={{color: 'red'}}>*</span>
                                </Typography>
                                <TextField
                                    fullWidth
                                    placeholder="Musterstraße"
                                    value={formData.aktuelleStrasse}
                                    onChange={(e) => setFormData({...formData, aktuelleStrasse: e.target.value})}
                                    InputProps={{
                                        disableUnderline: true,
                                        endAdornment: formData.aktuelleStrasse ? (
                                            <InputAdornment position="end">
                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                            </InputAdornment>
                                        ) : null,
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '4px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #d0d0d0',
                                            minHeight: '38px',
                                            boxShadow: formData.aktuelleStrasse 
                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                : 'none',
                                            '& .MuiInputBase-input': {
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                            },
                                            '& fieldset': {
                                                border: 'none',
                                            },
                                            '&:hover': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&:hover fieldset': {
                                                border: 'none',
                                            },
                                            '&.Mui-focused': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: 'none',
                                            },
                                        },
                                    }}
                                />
                            </Box>

                            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1" gutterBottom sx={{ 
                                        fontWeight: 'medium', 
                                        mb: 1,
                                        color: '#333',
                                        fontSize: '0.95rem'
                                    }}>
                                        Hausnummer <span style={{color: 'red'}}>*</span>
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        placeholder="1"
                                        value={formData.aktuelleHausnummer}
                                        onChange={(e) => setFormData({...formData, aktuelleHausnummer: e.target.value})}
                                        InputProps={{
                                            disableUnderline: true,
                                            endAdornment: formData.aktuelleHausnummer ? (
                                                <InputAdornment position="end">
                                                    <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                                </InputAdornment>
                                            ) : null,
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '4px',
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #d0d0d0',
                                                minHeight: '38px',
                                                boxShadow: formData.aktuelleHausnummer 
                                                    ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                    : 'none',
                                                '& .MuiInputBase-input': {
                                                    padding: '4px 8px',
                                                    fontSize: '0.8rem',
                                                },
                                                '& fieldset': {
                                                    border: 'none',
                                                },
                                                '&:hover': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&:hover fieldset': {
                                                    border: 'none',
                                                },
                                                '&.Mui-focused': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&.Mui-focused fieldset': {
                                                    border: 'none',
                                                },
                                            },
                                        }}
                                    />
                                </Box>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1" gutterBottom sx={{ 
                                        fontWeight: 'medium', 
                                        mb: 1,
                                        color: '#333',
                                        fontSize: '0.95rem'
                                    }}>
                                        Postleitzahl <span style={{color: 'red'}}>*</span>
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        placeholder="12345"
                                        value={formData.aktuellePostleitzahl}
                                        onChange={(e) => setFormData({...formData, aktuellePostleitzahl: e.target.value})}
                                        InputProps={{
                                            disableUnderline: true,
                                            endAdornment: formData.aktuellePostleitzahl ? (
                                                <InputAdornment position="end">
                                                    <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                                </InputAdornment>
                                            ) : null,
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '4px',
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #d0d0d0',
                                                minHeight: '38px',
                                                boxShadow: formData.aktuellePostleitzahl 
                                                    ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                    : 'none',
                                                '& .MuiInputBase-input': {
                                                    padding: '4px 8px',
                                                    fontSize: '0.8rem',
                                                },
                                                '& fieldset': {
                                                    border: 'none',
                                                },
                                                '&:hover': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&:hover fieldset': {
                                                    border: 'none',
                                                },
                                                '&.Mui-focused': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&.Mui-focused fieldset': {
                                                    border: 'none',
                                                },
                                            },
                                        }}
                                    />
                                </Box>
                                <Box sx={{ flex: 2 }}>
                                    <Typography variant="body1" gutterBottom sx={{ 
                                        fontWeight: 'medium', 
                                        mb: 1,
                                        color: '#333',
                                        fontSize: '0.95rem'
                                    }}>
                                        Stadt <span style={{color: 'red'}}>*</span>
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        placeholder="Musterstadt"
                                        value={formData.aktuelleStadt}
                                        onChange={(e) => setFormData({...formData, aktuelleStadt: e.target.value})}
                                        InputProps={{
                                            disableUnderline: true,
                                            endAdornment: formData.aktuelleStadt ? (
                                                <InputAdornment position="end">
                                                    <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                                </InputAdornment>
                                            ) : null,
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '4px',
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #d0d0d0',
                                                minHeight: '38px',
                                                boxShadow: formData.aktuelleStadt 
                                                    ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                    : 'none',
                                                '& .MuiInputBase-input': {
                                                    padding: '4px 8px',
                                                    fontSize: '0.8rem',
                                                },
                                                '& fieldset': {
                                                    border: 'none',
                                                },
                                                '&:hover': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&:hover fieldset': {
                                                    border: 'none',
                                                },
                                                '&.Mui-focused': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&.Mui-focused fieldset': {
                                                    border: 'none',
                                                },
                                            },
                                        }}
                                    />
                                </Box>
                            </Box>

                            {/* Optional Second Tenant */}
                            <Box sx={{ mb: 4 }}>
                                <Button
                                    variant="outlined"
                                    onClick={() => setFormData(prev => ({...prev, zweiterMieter: !prev.zweiterMieter}))}
                                    fullWidth
                                    sx={{
                                        border: '1px solid #ddd',
                                        backgroundColor: 'transparent',
                                        color: '#333',
                                        textTransform: 'none',
                                        fontWeight: 'normal',
                                        fontSize: '0.95rem',
                                        py: 1.5,
                                        px: 2,
                                        justifyContent: 'flex-start',
                                        borderRadius: 1,
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 152, 0, 0.04)',
                                            border: '1px solid #FF9800',
                                            color: '#FF9800'
                                        },
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1
                                    }}
                                >
                                    <Box sx={{ 
                                        fontSize: '1.2rem', 
                                        fontWeight: 'bold',
                                        color: 'inherit',
                                        lineHeight: 1
                                    }}>{formData.zweiterMieter ? '−' : '+'}</Box>
                                    ZWEITEN MIETER HINZUFÜGEN (OPTIONAL)
                                </Button>
                                {formData.zweiterMieter && (
                                    <Box sx={{ mt: 3, p: 3, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
                                        <Typography variant="h6" gutterBottom sx={{ 
                                            fontWeight: 'bold', 
                                            mb: 3,
                                            fontSize: '15px',
                                            letterSpacing: '0.5px',
                                            color: '#333'
                                        }}>
                                            ZWEITER MIETER
                                        </Typography>

                                        <Box sx={{ mb: 3 }}>
                                            <Typography variant="body1" gutterBottom sx={{ 
                                                fontWeight: 'medium', 
                                                mb: 2,
                                                color: '#333',
                                                fontSize: '0.95rem'
                                            }}>
                                                Anrede
                                            </Typography>
                                            <Box sx={{ display: 'flex', borderRadius: 1 }}>
                                                <Button
                                                    variant="outlined"
                                                    onClick={() => setFormData(prev => ({...prev, zweiterMieterAnrede: 'Herr'}))}
                                                    sx={{
                                                        flex: 1,
                                                        borderRadius: '4px 0 0 4px',
                                                        border: '1px solid #d0d0d0',
                                                        bgcolor: formData.zweiterMieterAnrede === 'Herr' ? '#B8B8B8' : '#FFFFFF',
                                                        color: formData.zweiterMieterAnrede === 'Herr' ? '#FFFFFF' : '#333',
                                                        minHeight: '38px',
                                                        '&:hover': { 
                                                            bgcolor: formData.zweiterMieterAnrede === 'Herr' ? '#A8A8A8' : '#f0f0f0',
                                                            border: '1px solid #8BC34A'
                                                        },
                                                        textTransform: 'none',
                                                        fontWeight: 'normal',
                                                        py: 0.5,
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    Herr
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    onClick={() => setFormData(prev => ({...prev, zweiterMieterAnrede: 'Frau'}))}
                                                    sx={{
                                                        flex: 1,
                                                        borderRadius: '0 4px 4px 0',
                                                        border: '1px solid #d0d0d0',
                                                        borderLeft: 'none',
                                                        bgcolor: formData.zweiterMieterAnrede === 'Frau' ? '#B8B8B8' : '#FFFFFF',
                                                        color: formData.zweiterMieterAnrede === 'Frau' ? '#FFFFFF' : '#333',
                                                        minHeight: '38px',
                                                        '&:hover': { 
                                                            bgcolor: formData.zweiterMieterAnrede === 'Frau' ? '#A8A8A8' : '#f0f0f0',
                                                            border: '1px solid #8BC34A',
                                                            borderLeft: 'none'
                                                        },
                                                        textTransform: 'none',
                                                        fontWeight: 'normal',
                                                        py: 0.5,
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    Frau
                                                </Button>
                                            </Box>
                                        </Box>

                                        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body1" gutterBottom sx={{ 
                                                    fontWeight: 'medium', 
                                                    mb: 1,
                                                    color: '#333',
                                                    fontSize: '0.95rem'
                                                }}>
                                                    Vorname
                                                </Typography>
                                                <TextField
                                                    fullWidth
                                                    placeholder="Vorname eingeben"
                                                    value={formData.zweiterMieterVorname || ''}
                                                    onChange={(e) => setFormData(prev => ({...prev, zweiterMieterVorname: e.target.value}))}
                                                    InputProps={{
                                                        endAdornment: formData.zweiterMieterVorname ? (
                                                            <InputAdornment position="end">
                                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                                            </InputAdornment>
                                                        ) : null,
                                                    }}
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: '4px',
                                                            backgroundColor: '#FFFFFF',
                                                            border: '1px solid #d0d0d0',
                                                            minHeight: '38px',
                                                            boxShadow: formData.zweiterMieterVorname 
                                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                                : 'none',
                                                            '& .MuiInputBase-input': {
                                                                padding: '4px 8px',
                                                                fontSize: '0.8rem',
                                                            },
                                                            '& fieldset': {
                                                                border: 'none',
                                                            },
                                                            '&:hover': {
                                                                border: '1px solid #8BC34A',
                                                            },
                                                            '&:hover fieldset': {
                                                                border: 'none',
                                                            },
                                                            '&.Mui-focused': {
                                                                border: '1px solid #8BC34A',
                                                            },
                                                            '&.Mui-focused fieldset': {
                                                                border: 'none',
                                                            },
                                                        },
                                                    }}
                                                />
                                            </Box>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body1" gutterBottom sx={{ 
                                                    fontWeight: 'medium', 
                                                    mb: 1,
                                                    color: '#333',
                                                    fontSize: '0.95rem'
                                                }}>
                                                    Nachname
                                                </Typography>
                                                <TextField
                                                    fullWidth
                                                    placeholder="Nachname eingeben"
                                                    value={formData.zweiterMieterNachname || ''}
                                                    onChange={(e) => setFormData(prev => ({...prev, zweiterMieterNachname: e.target.value}))}
                                                    InputProps={{
                                                        endAdornment: formData.zweiterMieterNachname ? (
                                                            <InputAdornment position="end">
                                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                                            </InputAdornment>
                                                        ) : null,
                                                    }}
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: '4px',
                                                            backgroundColor: '#FFFFFF',
                                                            border: '1px solid #d0d0d0',
                                                            minHeight: '38px',
                                                            boxShadow: formData.zweiterMieterNachname ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)' : 'none',
                                                            '& .MuiInputBase-input': {
                                                                padding: '4px 8px',
                                                                fontSize: '0.8rem',
                                                            },
                                                            '& fieldset': {
                                                                border: 'none',
                                                            },
                                                            '&:hover': {
                                                                border: '1px solid #8BC34A',
                                                            },
                                                            '&:hover fieldset': {
                                                                border: 'none',
                                                            },
                                                            '&.Mui-focused': {
                                                                border: '1px solid #8BC34A',
                                                            },
                                                            '&.Mui-focused fieldset': {
                                                                border: 'none',
                                                            },
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        </Box>

                                        <Box sx={{ mb: 3 }}>
                                            <Typography variant="body1" gutterBottom sx={{ 
                                                fontWeight: 'medium', 
                                                mb: 1,
                                                color: '#333',
                                                fontSize: '0.95rem'
                                            }}>
                                                Geburtsdatum
                                            </Typography>
                                            <TextField
                                                fullWidth
                                                placeholder="TT.MM.JJJJ"
                                                value={formData.zweiterMieterGeburtsdatum || ''}
                                                onChange={(e) => setFormData(prev => ({...prev, zweiterMieterGeburtsdatum: e.target.value}))}
                                                InputProps={{
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            {formData.zweiterMieterGeburtsdatum && (
                                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem', mr: 0.5 }} />
                                                            )}
                                                            <Box sx={{ 
                                                                bgcolor: '#f0f0f0', 
                                                                p: 0.5, 
                                                                borderRadius: 0.5,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                fontSize: '0.8rem'
                                                            }}>
                                                                📅
                                                            </Box>
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '4px',
                                                        backgroundColor: '#FFFFFF',
                                                        border: '1px solid #d0d0d0',
                                                        minHeight: '38px',
                                                        boxShadow: formData.zweiterMieterGeburtsdatum ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)' : 'none',
                                                        '& .MuiInputBase-input': {
                                                            padding: '4px 8px',
                                                            fontSize: '0.8rem',
                                                        },
                                                        '& fieldset': {
                                                            border: 'none',
                                                        },
                                                        '&:hover': {
                                                            border: '1px solid #8BC34A',
                                                        },
                                                        '&:hover fieldset': {
                                                            border: 'none',
                                                        },
                                                        '&.Mui-focused': {
                                                            border: '1px solid #8BC34A',
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            border: 'none',
                                                        },
                                                    },
                                                }}
                                            />
                                        </Box>

                                        <Box sx={{ mb: 3 }}>
                                            <Typography variant="body1" gutterBottom sx={{ 
                                                fontWeight: 'medium', 
                                                mb: 1,
                                                color: '#333',
                                                fontSize: '0.95rem'
                                            }}>
                                                Nationalität
                                            </Typography>
                                            <TextField
                                                fullWidth
                                                value={formData.zweiterMieterNationalitat || 'Deutschland'}
                                                onChange={(e) => setFormData(prev => ({...prev, zweiterMieterNationalitat: e.target.value}))}
                                                select
                                                InputProps={{
                                                    endAdornment: formData.zweiterMieterNationalitat ? (
                                                        <InputAdornment position="end">
                                                            <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                                        </InputAdornment>
                                                    ) : null,
                                                }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '4px',
                                                        backgroundColor: '#FFFFFF',
                                                        border: '1px solid #d0d0d0',
                                                        minHeight: '38px',
                                                        boxShadow: formData.zweiterMieterNationalitat ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)' : 'none',
                                                        '& .MuiInputBase-input': {
                                                            padding: '4px 8px',
                                                            fontSize: '0.8rem',
                                                        },
                                                        '& fieldset': {
                                                            border: 'none',
                                                        }, 
                                                        '&:hover': {
                                                            border: '1px solid #8BC34A',
                                                        },
                                                        '&:hover fieldset': {
                                                            border: 'none',
                                                        },
                                                        '&.Mui-focused': {
                                                            border: '1px solid #8BC34A',
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            border: 'none',
                                                        },
                                                    },
                                                }}
                                                SelectProps={{
                                                    native: true,
                                                }}
                                            >
                                                <option value="Deutschland">Deutschland</option>
                                                <option value="Österreich">Österreich</option>
                                                <option value="Schweiz">Schweiz</option>
                                                <option value="Frankreich">Frankreich</option>
                                                <option value="Italien">Italien</option>
                                                <option value="Spanien">Spanien</option>
                                                <option value="Niederlande">Niederlande</option>
                                                <option value="Belgien">Belgien</option>
                                                <option value="Polen">Polen</option>
                                                <option value="Tschechien">Tschechien</option>
                                                <option value="Ungarn">Ungarn</option>
                                                <option value="Kroatien">Kroatien</option>
                                                <option value="Türkei">Türkei</option>
                                                <option value="Russland">Russland</option>
                                                <option value="Ukraine">Ukraine</option>
                                                <option value="Vereinigtes Königreich">Vereinigtes Königreich</option>
                                                <option value="USA">USA</option>
                                                <option value="Kanada">Kanada</option>
                                                <option value="Brasilien">Brasilien</option>
                                                <option value="China">China</option>
                                                <option value="Japan">Japan</option>
                                                <option value="Indien">Indien</option>
                                                <option value="Australien">Australien</option>
                                                <option value="Andere">Andere</option>
                                            </TextField>
                                        </Box>

                                        {/* Second Tenant Address Section */}
                                        <Typography variant="h6" gutterBottom sx={{ 
                                            fontWeight: 'bold', 
                                            mt: 4, 
                                            mb: 2,
                                            fontSize: '15px',
                                            letterSpacing: '0.5px',
                                            color: '#333'
                                        }}>
                                            AKTUELLE ADRESSE / ZWEITER MIETER
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                                            Bitte tragen Sie hier die aktuelle Meldeadresse des zweiten Mieters ein.
                                        </Typography>

                                        <Box sx={{ mb: 3 }}>
                                            <Typography variant="body1" gutterBottom sx={{ 
                                                fontWeight: 'medium', 
                                                mb: 1,
                                                color: '#333',
                                                fontSize: '0.95rem'
                                            }}>
                                                Straße
                                            </Typography>
                                            <TextField
                                                fullWidth
                                                placeholder=""
                                                value={formData.zweiterMieterStrasse || ''}
                                                onChange={(e) => setFormData(prev => ({...prev, zweiterMieterStrasse: e.target.value}))}
                                                InputProps={{
                                                    endAdornment: formData.zweiterMieterStrasse ? (
                                                        <InputAdornment position="end">
                                                            <CheckIcon sx={{ color: '#8BC34A', fontSize: '1.2rem' }} />
                                                        </InputAdornment>
                                                    ) : null,
                                                }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '4px',
                                                        backgroundColor: '#FFFFFF',
                                                        border: '1px solid #d0d0d0',
                                                        minHeight: '38px',
                                                        boxShadow: formData.zweiterMieterStrasse 
                                                            ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                            : 'none',
                                                        '& .MuiInputBase-input': {
                                                            padding: '4px 8px',
                                                            fontSize: '0.8rem',
                                                        },
                                                        '& fieldset': {
                                                            border: 'none',
                                                        },
                                                        '&:hover': {
                                                            border: '1px solid #8BC34A',
                                                        },
                                                        '&:hover fieldset': {
                                                            border: 'none',
                                                        },
                                                        '&.Mui-focused': {
                                                            border: '1px solid #8BC34A',
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            border: 'none',
                                                        },
                                                    },
                                                }}
                                            />
                                        </Box>

                                        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body1" gutterBottom sx={{ 
                                                    fontWeight: 'medium', 
                                                    mb: 1,
                                                    color: '#333',
                                                    fontSize: '0.95rem'
                                                }}>
                                                    Hausnummer
                                                </Typography>
                                                <TextField
                                                    fullWidth
                                                    placeholder=""
                                                    value={formData.zweiterMieterHausnummer || ''}
                                                    onChange={(e) => setFormData(prev => ({...prev, zweiterMieterHausnummer: e.target.value}))}
                                                    InputProps={{
                                                        endAdornment: formData.zweiterMieterHausnummer ? (
                                                            <InputAdornment position="end">
                                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1.2rem' }} />
                                                            </InputAdornment>
                                                        ) : null,
                                                    }}
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: '4px',
                                                            backgroundColor: '#FFFFFF',
                                                            border: '1px solid #d0d0d0',
                                                            minHeight: '38px',
                                                            boxShadow: formData.zweiterMieterHausnummer 
                                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                                : 'none',
                                                            '& .MuiInputBase-input': {
                                                                padding: '4px 8px',
                                                                fontSize: '0.8rem',
                                                            },
                                                            '& fieldset': {
                                                                border: 'none',
                                                            },
                                                            '&:hover': {
                                                                border: '1px solid #8BC34A',
                                                            },
                                                            '&:hover fieldset': {
                                                                border: 'none',
                                                            },
                                                            '&.Mui-focused': {
                                                                border: '1px solid #8BC34A',
                                                            },
                                                            '&.Mui-focused fieldset': {
                                                                border: 'none',
                                                            },
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        </Box>

                                        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body1" gutterBottom sx={{ 
                                                    fontWeight: 'medium', 
                                                    mb: 1,
                                                    color: '#333',
                                                    fontSize: '0.95rem'
                                                }}>
                                                    Postleitzahl
                                                </Typography>
                                                <TextField
                                                    fullWidth
                                                    placeholder=""
                                                    value={formData.zweiterMieterPostleitzahl || ''}
                                                    onChange={(e) => setFormData(prev => ({...prev, zweiterMieterPostleitzahl: e.target.value}))}
                                                    InputProps={{
                                                        endAdornment: formData.zweiterMieterPostleitzahl ? (
                                                            <InputAdornment position="end">
                                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1.2rem' }} />
                                                            </InputAdornment>
                                                        ) : null,
                                                    }}
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: '4px',
                                                            backgroundColor: '#FFFFFF',
                                                            border: '1px solid #d0d0d0',
                                                            minHeight: '38px',
                                                            boxShadow: formData.zweiterMieterPostleitzahl 
                                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                                : 'none',
                                                            '& .MuiInputBase-input': {
                                                                padding: '4px 8px',
                                                                fontSize: '0.8rem',
                                                            },
                                                            '& fieldset': {
                                                                border: 'none',
                                                            },
                                                            '&:hover': {
                                                                border: '1px solid #8BC34A',
                                                            },
                                                            '&:hover fieldset': {
                                                                border: 'none',
                                                            },
                                                            '&.Mui-focused': {
                                                                border: '1px solid #8BC34A',
                                                            },
                                                            '&.Mui-focused fieldset': {
                                                                border: 'none',
                                                            },
                                                        },
                                                    }}
                                                />
                                            </Box>
                                            <Box sx={{ flex: 2 }}>
                                                <Typography variant="body1" gutterBottom sx={{ 
                                                    fontWeight: 'medium', 
                                                    mb: 1,
                                                    color: '#333',
                                                    fontSize: '0.95rem'
                                                }}>
                                                    Stadt
                                                </Typography>
                                                <TextField
                                                    fullWidth
                                                    placeholder=""
                                                    value={formData.zweiterMieterStadt || ''}
                                                    onChange={(e) => setFormData(prev => ({...prev, zweiterMieterStadt: e.target.value}))}
                                                    InputProps={{
                                                        endAdornment: formData.zweiterMieterStadt ? (
                                                            <InputAdornment position="end">
                                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1.2rem' }} />
                                                            </InputAdornment>
                                                        ) : null,
                                                    }}
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: '4px',
                                                            backgroundColor: '#FFFFFF',
                                                            border: '1px solid #d0d0d0',
                                                            minHeight: '38px',
                                                            boxShadow: formData.zweiterMieterStadt 
                                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                                : 'none',
                                                            '& .MuiInputBase-input': {
                                                                padding: '4px 8px',
                                                                fontSize: '0.8rem',
                                                            },
                                                            '& fieldset': {
                                                                border: 'none',
                                                            },
                                                            '&:hover': {
                                                                border: '1px solid #8BC34A',
                                                            },
                                                            '&:hover fieldset': {
                                                                border: 'none',
                                                            },
                                                            '&.Mui-focused': {
                                                                border: '1px solid #8BC34A',
                                                            },
                                                            '&.Mui-focused fieldset': {
                                                                border: 'none',
                                                            },
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        </Box>

                                        {/* Address copy button like in the image */}
                                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                                            <Button
                                                variant="outlined"
                                                startIcon={<ContentCopyIcon sx={{ fontSize: '1rem' }} />}
                                                onClick={copyAddressFromMainTenant}
                                                sx={{
                                                    border: '1px solid #ddd',
                                                    backgroundColor: 'transparent',
                                                    color: '#666',
                                                    textTransform: 'none',
                                                    fontWeight: 'normal',
                                                    fontSize: '0.9rem',
                                                    py: 1,
                                                    px: 3,
                                                    borderRadius: '25px',
                                                    '&:hover': {
                                                        backgroundColor: '#f5f5f5',
                                                        border: '1px solid #ccc'
                                                    }
                                                }}
                                            >
                                                Adresse von oben kopieren
                                            </Button>
                                        </Box>
                                    </Box>
                                )}
                            </Box>

                            {/* Broker ID (Optional) */}
                            <Box sx={{ mb: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Typography variant="body1" sx={{ 
                                        fontWeight: 'medium', 
                                        color: '#333',
                                        fontSize: '0.95rem'
                                    }}>
                                        VERMITTLER-ID (FALLS VORHANDEN / OPTIONAL)
                                    </Typography>
                                    <CustomTooltip 
                                        title="Partnerschaftsprogramm"
                                        content={
                                            <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                Die Angabe der PartnerID ist nur in sehr wenigen Fällen 
                                                notwendig. Wir arbeiten mit verschiedenen Kooperationspartnern 
                                                zusammen (Hausverwaltungen, Banken, Maklern, ... ). Mithilfe der 
                                                PartnerID können wir vermittelten Verträgen die jeweiligen Partner 
                                                zuordnen. Wenn Sie nicht von einem unserer Partner explizit 
                                                darauf hingewiesen wurden eine PartnerID anzugeben, lassen Sie 
                                                dieses Feld einfach frei.
                                            </Typography>
                                        }
                                    />
                                </Box>
                                <TextField
                                    fullWidth
                                    placeholder=""
                                    value={formData.vermittlerId}
                                    onChange={(e) => setFormData(prev => ({...prev, vermittlerId: e.target.value}))}
                                    InputProps={{
                                        endAdornment: formData.vermittlerId ? (
                                            <InputAdornment position="end">
                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                            </InputAdornment>
                                        ) : null,
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '4px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #d0d0d0',
                                            minHeight: '38px',
                                            boxShadow: formData.vermittlerId 
                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                : 'none',
                                            '& .MuiInputBase-input': {
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                            },
                                            '& fieldset': {
                                                border: 'none',
                                            },
                                            '&:hover': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&:hover fieldset': {
                                                border: 'none',
                                            },
                                            '&.Mui-focused': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: 'none',
                                            },
                                        },
                                    }}
                                />
                            </Box>
                        </Box>
                    )}

                    {/* Property Information Section - Step 2 */}
                    {currentStep === 2 && (
                        <Box sx={{ mb: 4, p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                            <Typography fontSize={'15px'} variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3, }}>
                                ADRESSE DES MIETOBJEKTS
                            </Typography>

                            {/* Property Address */}
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium', mb: 1 }}>
                                    Straße <span style={{color: 'red'}}>*</span>
                                </Typography>
                                <TextField
                                    fullWidth
                                    placeholder="Musterstraße"
                                    value={formData.mietobjektStrasse}
                                    onChange={(e) => setFormData(prev => ({...prev, mietobjektStrasse: e.target.value}))}
                                    InputProps={{
                                        endAdornment: formData.mietobjektStrasse ? (
                                            <InputAdornment position="end">
                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                            </InputAdornment>
                                        ) : null,
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '4px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #d0d0d0',
                                            minHeight: '38px',
                                            boxShadow: formData.mietobjektStrasse 
                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                : 'none',
                                            '& .MuiInputBase-input': {
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                            },
                                            '& fieldset': {
                                                border: 'none',
                                            },
                                            '&:hover': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&:hover fieldset': {
                                                border: 'none',
                                            },
                                            '&.Mui-focused': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: 'none',
                                            },
                                        },
                                    }}
                                />
                            </Box>

                            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium', mb: 1 }}>
                                        Hausnummer <span style={{color: 'red'}}>*</span>
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        placeholder="1"
                                        value={formData.mietobjektHausnummer}
                                        onChange={(e) => setFormData(prev => ({...prev, mietobjektHausnummer: e.target.value}))}
                                        InputProps={{
                                            endAdornment: formData.mietobjektHausnummer ? (
                                                <InputAdornment position="end">
                                                    <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                                </InputAdornment>
                                            ) : null,
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '4px',
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #d0d0d0',
                                                minHeight: '38px',
                                                boxShadow: formData.mietobjektHausnummer 
                                                    ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                    : 'none',
                                                '& .MuiInputBase-input': {
                                                    padding: '4px 8px',
                                                    fontSize: '0.8rem',
                                                },
                                                '& fieldset': {
                                                    border: 'none',
                                                },
                                                '&:hover': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&:hover fieldset': {
                                                    border: 'none',
                                                },
                                                '&.Mui-focused': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&.Mui-focused fieldset': {
                                                    border: 'none',
                                                },
                                            },
                                        }}
                                    />
                                </Box>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium', mb: 1 }}>
                                        Postleitzahl <span style={{color: 'red'}}>*</span>
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        placeholder="12345"
                                        value={formData.mietobjektPostleitzahl}
                                        onChange={(e) => setFormData(prev => ({...prev, mietobjektPostleitzahl: e.target.value}))}
                                        InputProps={{
                                            endAdornment: formData.mietobjektPostleitzahl ? (
                                                <InputAdornment position="end">
                                                    <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                                </InputAdornment>
                                            ) : null,
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '4px',
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #d0d0d0',
                                                minHeight: '38px',
                                                boxShadow: formData.mietobjektPostleitzahl 
                                                    ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                    : 'none',
                                                '& .MuiInputBase-input': {
                                                    padding: '4px 8px',
                                                    fontSize: '0.8rem',
                                                },
                                                '& fieldset': {
                                                    border: 'none',
                                                },
                                                '&:hover': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&:hover fieldset': {
                                                    border: 'none',
                                                },
                                                '&.Mui-focused': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&.Mui-focused fieldset': {
                                                    border: 'none',
                                                },
                                            },
                                        }}
                                    />
                                </Box>
                                <Box sx={{ flex: 2 }}>
                                    <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium', mb: 1 }}>
                                        Stadt <span style={{color: 'red'}}>*</span>
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        placeholder="Musterstadt"
                                        value={formData.mietobjektStadt}
                                        onChange={(e) => setFormData(prev => ({...prev, mietobjektStadt: e.target.value}))}
                                        InputProps={{
                                            endAdornment: formData.mietobjektStadt ? (
                                                <InputAdornment position="end">
                                                    <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                                </InputAdornment>
                                            ) : null,
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '4px',
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #d0d0d0',
                                                minHeight: '38px',
                                                boxShadow: formData.mietobjektStadt 
                                                    ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                    : 'none',
                                                '& .MuiInputBase-input': {
                                                    padding: '4px 8px',
                                                    fontSize: '0.8rem',
                                                },
                                                '& fieldset': {
                                                    border: 'none',
                                                },
                                                '&:hover': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&:hover fieldset': {
                                                    border: 'none',
                                                },
                                                '&.Mui-focused': {
                                                    border: '1px solid #8BC34A',
                                                },
                                                '&.Mui-focused fieldset': {
                                                    border: 'none',
                                                },
                                            },
                                        }}
                                    />
                                </Box>
                            </Box>

                            {/* Landlord Information */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                                <Typography fontSize={'15px'} variant="h6" sx={{ fontWeight: 'bold' }}>
                                    IHR VERMIETER
                                </Typography>
                                <CustomTooltip 
                                    title="Vermieter"
                                    content={
                                        <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: '0.95rem' }}>
                                            Bitte übernehmen Sie die vollständigen Daten Ihres Vermieters 
                                            aus dem Mietvertrag. Vertretungen (z.B. Hausverwaltungen) 
                                            müssen nicht übernommen werden. Liegt die Adresse Ihrer 
                                            Vermietung im Ausland, kontaktieren Sie uns bitte unter der 
                                            kostenlosen Hotline 0800 – 01 22 333
                                        </Typography>
                                    }
                                />
                            </Box>

                            <Box sx={{ mb: 4 }}>
                                <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium', mb: 1 }}>
                                    Name Ihres Vermieters <span style={{color: 'red'}}>*</span>
                                </Typography>
                                <TextField
                                    fullWidth
                                    placeholder="Name Ihres Vermieters eingeben"
                                    value={formData.vermieterName}
                                    onChange={(e) => setFormData(prev => ({...prev, vermieterName: e.target.value}))}
                                    InputProps={{
                                        endAdornment: formData.vermieterName ? (
                                            <InputAdornment position="end">
                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                            </InputAdornment>
                                        ) : null,
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '4px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #d0d0d0',
                                            minHeight: '38px',
                                            boxShadow: formData.vermieterName 
                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                : 'none',
                                            '& .MuiInputBase-input': {
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                            },
                                            '& fieldset': {
                                                border: 'none',
                                            },
                                            '&:hover': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&:hover fieldset': {
                                                border: 'none',
                                            },
                                            '&.Mui-focused': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: 'none',
                                            },
                                        },
                                    }}
                                />
                            </Box>

                            {/* Lease Information */}
                            <Typography fontSize={'15px'} variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                                MIETVERTRAG
                            </Typography>

                            <Box sx={{ mb: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                        Mietbeginn <span style={{color: 'red'}}>*</span>
                                    </Typography>
                                    <CustomTooltip 
                                        title="Mietbeginn"
                                        content={
                                            <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                Bitte geben Sie hier das im Mietvertrag angegebene Datum des 
                                                Mietbeginns an.
                                            </Typography>
                                        }
                                    />
                                </Box>
                                <TextField
                                    fullWidth
                                    type="date"
                                    placeholder="tt.mm.jjjj"
                                    value={formData.mietbeginn}
                                    onChange={(e) => setFormData(prev => ({...prev, mietbeginn: e.target.value}))}
                                    InputProps={{
                                        endAdornment: formData.mietbeginn ? (
                                            <InputAdornment position="end">
                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                            </InputAdornment>
                                        ) : null,
                                    }}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '4px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #d0d0d0',
                                            minHeight: '38px',
                                            boxShadow: formData.mietbeginn 
                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                : 'none',
                                            '& .MuiInputBase-input': {
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                            },
                                            '& fieldset': {
                                                border: 'none',
                                            },
                                            '&:hover': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&:hover fieldset': {
                                                border: 'none',
                                            },
                                            '&.Mui-focused': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: 'none',
                                            },
                                        },
                                    }}
                                />
                            </Box>

                            <Box sx={{ mb: 3 }}>
                                <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium', mb: 2 }}>
                                    Ist der Mietvertrag befristet? <span style={{color: 'red'}}>*</span>
                                </Typography>
                                <FormControl>
                                    <RadioGroup
                                        value={formData.mietvertragBefristet}
                                        onChange={(e) => setFormData(prev => ({...prev, mietvertragBefristet: e.target.value}))}
                                    >
                                        <FormControlLabel
                                            value="nein"
                                            control={<Radio />}
                                            label="Nein"
                                        />
                                        <FormControlLabel
                                            value="ja"
                                            control={<Radio />}
                                            label="Ja, der Mietvertrag ist befristet"
                                        />
                                    </RadioGroup>
                                </FormControl>
                            </Box>
                        </Box>
                    )}

                    {/* Payment Information Section - Step 3 */}
                    {currentStep === 3 && (
                        <Box sx={{ mb: 4, p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                            {/* Banking Information */}
                            <Typography fontSize={'15px'} variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                                BANKVERBINDUNG
                            </Typography>

                            <Box sx={{ mb: 3 }}>
                                <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium', mb: 1 }}>
                                    IBAN <span style={{color: 'red'}}>*</span>
                                </Typography>
                                <TextField
                                    fullWidth
                                    placeholder="DE00000000000000000000"
                                    value={formData.iban}
                                    onChange={(e) => setFormData(prev => ({...prev, iban: e.target.value}))}
                                    InputProps={{
                                        endAdornment: formData.iban ? (
                                            <InputAdornment position="end">
                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                            </InputAdornment>
                                        ) : null,
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '4px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #d0d0d0',
                                            minHeight: '38px',
                                            boxShadow: formData.iban 
                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                : 'none',
                                            '& .MuiInputBase-input': {
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                            },
                                            '& fieldset': {
                                                border: 'none',
                                            },
                                            '&:hover': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&:hover fieldset': {
                                                border: 'none',
                                            },
                                            '&.Mui-focused': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: 'none',
                                            },
                                        },
                                    }}
                                />
                            </Box>

                            <Box sx={{ mb: 4 }}>
                                <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium', mb: 1 }}>
                                    Kreditinstitut <span style={{color: 'red'}}>*</span>
                                </Typography>
                                <TextField
                                    fullWidth
                                    placeholder="Muster Bank"
                                    value={formData.kreditinstitut}
                                    onChange={(e) => setFormData(prev => ({...prev, kreditinstitut: e.target.value}))}
                                    InputProps={{
                                        endAdornment: formData.kreditinstitut ? (
                                            <InputAdornment position="end">
                                                <CheckIcon sx={{ color: '#8BC34A', fontSize: '1rem' }} />
                                            </InputAdornment>
                                        ) : null,
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '4px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #d0d0d0',
                                            minHeight: '38px',
                                            boxShadow: formData.kreditinstitut 
                                                ? 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                                                : 'none',
                                            '& .MuiInputBase-input': {
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                            },
                                            '& fieldset': {
                                                border: 'none',
                                            },
                                            '&:hover': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&:hover fieldset': {
                                                border: 'none',
                                            },
                                            '&.Mui-focused': {
                                                border: '1px solid #8BC34A',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: 'none',
                                            },
                                        },
                                    }}
                                />
                            </Box>

                            {/* Delivery Method */}
                            <Typography fontSize={'15px'} variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                                VERSAND DER BÜRGSCHAFT
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                                Bitte legen Sie fest, wie Sie Ihre Bürgschaftsurkunde erhalten möchten. Um die Umwelt zu schonen und die Urkunde direkt digital zu erhalten, empfehlen wir Ihnen die digitale Bürgschaft.
                            </Typography>

                            <FormControl sx={{ mb: 4 }}>
                                <RadioGroup
                                    value={formData.versandMethode}
                                    onChange={(e) => setFormData(prev => ({...prev, versandMethode: e.target.value}))}
                                >
                                    <FormControlLabel
                                        value="digital"
                                        control={<Radio />}
                                        label="Digital (Versand sofort per E-Mail)"
                                    />
                                    <FormControlLabel
                                        value="post"
                                        control={<Radio />}
                                        label="Gedruckte Bürgschaftsurkunde (Versand in wenigen Tagen per Post)"
                                    />
                                </RadioGroup>
                            </FormControl>

                            {/* Kaution Amount Section */}
                            <Box sx={{ p: 3, border: '1px solid #ddd', borderRadius: 1, bgcolor: 'white' }}>
                                <Box sx={{ mb: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                            Wie hoch ist Ihre Kaution?
                                        </Typography>
                                        <CustomTooltip 
                                            title="Beitragshöhe"
                                            content={
                                                <>
                                                    <Typography variant="body1" sx={{ mb: 1.5, lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                        Ihr Beitrag für Ihre Mietbürgschaft richtet sich nach Höhe der 
                                                        Bürgschaftssumme und der Zahlweise.
                                                    </Typography>
                                                    <Box sx={{ mb: 1.5 }}>
                                                        <Typography variant="body1" sx={{ mb: 0.7, lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                            • bei Zahlweise jährlich: <strong>4,70 % der Bürgschaftssumme</strong>
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ mb: 0.7, lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                            • bei Zahlweise halbjährlich: <strong>4,90 % der Bürgschaftssumme</strong>
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ mb: 0.7, lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                            • bei Zahlweise vierteljährlich: <strong>5,20 % der Bürgschaftssumme</strong>
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ mb: 1, lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                            • bei Zahlweise monatlich: <strong>5,50 % der Bürgschaftssumme</strong>
                                                        </Typography>
                                                    </Box>
                                                    <Typography variant="body1" sx={{ mb: 0.7, lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                        Die Auswahl zur monatlichen oder jährlichen Zahlweise treffen Sie 
                                                        in Schritt 3 (Zahlung).
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ mb: 0.7, lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                        Die erste Abbuchung erfolgt ca. 14 Tage nach Antragstellung.
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ mb: 0.7, lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                        Bitte geben Sie die Höhe der Mietkaution gemäß Mietvertrag an. 
                                                        Laut Gesetz darf die Mietkaution nicht höher als das 3-fache der 
                                                        Kaltmiete sein.
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: '0.95rem' }}>
                                                        Wir bieten Bürgschaften von <strong>400 EUR bis maximal 15.000 EUR</strong> an.
                                                    </Typography>
                                                </>
                                            }
                                        />
                                    </Box>
                                    <Box sx={{ position: 'relative', maxWidth: 300 }}>
                                        <TextField
                                            type="number"
                                            value={kautionAmount}
                                            onChange={(e) => setKautionAmount(e.target.value)}
                                            fullWidth
                                            error={parseFloat(kautionAmount) < 400 || parseFloat(kautionAmount) > 15000}
                                            helperText={parseFloat(kautionAmount) < 400 ? "Die Kaution muss mindestens 400€ betragen" : parseFloat(kautionAmount) > 15000 ? "Die Kaution darf maximal 15000€ betragen" : ""}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            {parseFloat(kautionAmount) >= 400 && parseFloat(kautionAmount) <= 15000 ? (
                                                                <CheckIcon sx={{ color: '#4caf50' }} />
                                                            ) : null}
                                                            <Typography sx={{ fontWeight: 'bold' }}>€</Typography>
                                                        </Box>
                                                    </InputAdornment>
                                                ),
                                                sx: { fontSize: '1.1rem' }
                                            }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '4px',
                                                    backgroundColor: '#FFFFFF',
                                                    border: (parseFloat(kautionAmount) < 400 || parseFloat(kautionAmount) > 15000) ? '1px solid #f44336' : '1px solid #4caf50',
                                                    minHeight: '38px',
                                                    boxShadow: (parseFloat(kautionAmount) < 400 || parseFloat(kautionAmount) > 15000) ? 
                                                        'inset 0 2px 8px rgba(244, 67, 54, 0.4), inset 0 1px 4px rgba(244, 67, 54, 0.3)' :
                                                        'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)',
                                                    '& .MuiInputBase-input': {
                                                        padding: '4px 8px',
                                                        fontSize: '0.8rem',
                                                    },
                                                    '& fieldset': { 
                                                        border: 'none',
                                                    },
                                                    '&:hover': {
                                                        border: (parseFloat(kautionAmount) < 400 || parseFloat(kautionAmount) > 15000) ? '1px solid #f44336' : '1px solid #4caf50',
                                                    },
                                                    '&:hover fieldset': { 
                                                        border: 'none',
                                                    },
                                                    '&.Mui-focused': {
                                                        border: (parseFloat(kautionAmount) < 400 || parseFloat(kautionAmount) > 15000) ? '1px solid #f44336' : '1px solid #4caf50',
                                                    },
                                                    '&.Mui-focused fieldset': { 
                                                        border: 'none',
                                                    }
                                                }
                                            }}
                                        />
                                    </Box>
                                </Box>

                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium', mb: 2 }}>
                                        Welche Zahlungsweise bevorzugen Sie?
                                    </Typography>

                                    <FormControl>
                                        <RadioGroup
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                        >
                                            <FormControlLabel
                                                value="monthly"
                                                control={<Radio />}
                                                label={
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                            Monatlich: {monthlyEstimate.toFixed(2)} €
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                            <FormControlLabel
                                                value="yearly"
                                                control={<Radio />}
                                                label={
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                            Jährlich: {yearlyEstimate.toFixed(2)} €
                                                        </Typography>
                                                        <Typography variant="caption" color="textSecondary">
                                                            Das entspricht {(yearlyEstimate / 12).toFixed(2)} € monatlich
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        </RadioGroup>
                                    </FormControl>
                                </Box>

                                <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                                    Es gibt KEINE versteckten Gebühren und Kosten.
                                </Typography>
                            </Box>

                            {/* Security Check */}
                            <Typography fontSize={'15px'} variant="h6" gutterBottom sx={{ fontWeight: 'bold', mt: 4, mb: 3 }}>
                                SICHERHEIT SPRÜFUNG
                            </Typography>

                            {/* reCAPTCHA Verification */}
                            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                                <ReCAPTCHA
                                    sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" // Test site key - replace with your actual site key
                                    onChange={(value) => setRecaptchaValue(value)}
                                    onExpired={() => setRecaptchaValue(null)}
                                />
                            </Box>

                            {!recaptchaValue && (
                                <Box sx={{ mb: 2, textAlign: 'center' }}>
                                    <Typography variant="body2" color="error">
                                        Bitte bestätigen Sie, dass Sie kein Roboter sind.
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Final Step - Summary and Submit - Step 4 */}
                    {currentStep === 4 && (
                        <Box sx={{ 
                            mb: 2, 
                            p: 2, 
                            // borderRadius: '4px',
                            backgroundColor: '#FFFFFF',
                            // border: '1px solid #d0d0d0',
                            // boxShadow: 'inset 0 2px 8px rgba(139, 195, 74, 0.3), inset 0 1px 4px rgba(139, 195, 74, 0.2)'
                        }}>
                            {/* Consent Checkboxes at the top */}
                            {!hideConsentSection && (
                                <Box sx={{ mb: 4, p: 0 }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={privacyAccepted}
                                                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                                                sx={{
                                                    color: '#8BC34A',
                                                    transform: 'scale(1.2)',
                                                    mr: 2,
                                                    '&.Mui-checked': {
                                                        color: '#8BC34A',
                                                    },
                                                }}
                                            />
                                        }
                                        label={
                                            <Typography variant="body1" sx={{ 
                                                fontSize: '16px',
                                                lineHeight: 1.6,
                                                color: '#333'
                                            }}>
                                                Ich habe die{' '}
                                                <Typography component="span" sx={{ 
                                                    color: '#FF9800', 
                                                    textDecoration: 'underline', 
                                                    cursor: 'pointer',
                                                    fontWeight: 'medium'
                                                }}>
                                                    Datenschutzbestimmungen
                                                </Typography>
                                                {' '}zur Kenntnis genommen.
                                            </Typography>
                                        }
                                        sx={{ 
                                            alignItems: 'flex-start', 
                                            mb: 3,
                                            ml: 0,
                                            '& .MuiFormControlLabel-label': {
                                                ml: 1
                                            }
                                        }}
                                    />
                                    
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={documentsAccepted}
                                                onChange={(e) => setDocumentsAccepted(e.target.checked)}
                                                sx={{
                                                    color: '#8BC34A',
                                                    transform: 'scale(1.2)',
                                                    mr: 2,
                                                    '&.Mui-checked': {
                                                        color: '#8BC34A',
                                                    },
                                                }}
                                            />
                                        }
                                        label={
                                            <Typography variant="body1" sx={{ 
                                                fontSize: '16px',
                                                lineHeight: 1.6,
                                                color: '#333'
                                            }}>
                                                Ich habe die Dokumente{' '}
                                                <Typography component="span" sx={{ 
                                                    color: '#FF9800', 
                                                    textDecoration: 'underline', 
                                                    cursor: 'pointer',
                                                    fontWeight: 'medium'
                                                }}>
                                                    Beratungsprotokoll
                                                </Typography>
                                                ,{' '}
                                                <Typography component="span" sx={{ 
                                                    color: '#FF9800', 
                                                    textDecoration: 'underline', 
                                                    cursor: 'pointer',
                                                    fontWeight: 'medium'
                                                }}>
                                                    Produktinformationsblatt
                                                </Typography>
                                                ,{' '}
                                                <Typography component="span" sx={{ 
                                                    color: '#FF9800', 
                                                    textDecoration: 'underline', 
                                                    cursor: 'pointer',
                                                    fontWeight: 'medium'
                                                }}>
                                                    Versicherungsbedingungen
                                                </Typography>
                                                {' '}und{' '}
                                                <Typography component="span" sx={{ 
                                                    color: '#FF9800', 
                                                    textDecoration: 'underline', 
                                                    cursor: 'pointer',
                                                    fontWeight: 'medium'
                                                }}>
                                                    Widerrufsbelehrung
                                                </Typography>
                                                {' '}unten zur Kenntnis genommen und möchte die Kautionsbürgschaft zu den darin enthaltenen Bedingungen abschließen.
                                            </Typography>
                                        }
                                        sx={{ 
                                            alignItems: 'flex-start',
                                            ml: 0,
                                            '& .MuiFormControlLabel-label': {
                                                ml: 1
                                            }
                                        }}
                                    />
                                </Box>
                            )}

                            {/* Show conditions link when hidden */}
                            {hideConsentSection && (
                                <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
                                    <Typography 
                                        onClick={() => setHideConsentSection(false)}
                                        sx={{ 
                                            color: '#FF9800', 
                                            textDecoration: 'underline', 
                                            cursor: 'pointer',
                                            fontSize: '16px',
                                            fontWeight: 'medium',
                                            '&:hover': {
                                                color: '#e68900'
                                            }
                                        }}
                                    >
                                        ↑ Bedingungen anzeigen
                                    </Typography>
                                </Box>
                            )}

                            {/* Show KautionFrei Process Steps if burgschaftData exists */}
                            {burgschaftData ? (
                                <Box>
                                    {/* Return to Summary Button */}
                                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                                        <Button
                                            variant="outlined"
                                            onClick={() => {
                                                setShowSummary(true);
                                                setBurgschaftData(null);
                                                setStatusData(null);
                                                setCountdown(null);
                                                setTimeout(() => {
                                                    window.scrollTo({ 
                                                        top: 0, 
                                                        behavior: 'smooth',
                                                        block: 'start'
                                                    });
                                                }, 100);
                                            }}
                                            sx={{
                                                minWidth: 180,
                                                color: '#666',
                                                border: '1px solid #ddd',
                                                textTransform: 'none',
                                                fontSize: '0.9rem',
                                                '&:hover': {
                                                    backgroundColor: '#f5f5f5',
                                                    border: '1px solid #999'
                                                }
                                            }}
                                        >
                                            ← Zurück zur Zusammenfassung
                                        </Button>
                                    </Box>
                                    
                                    <Typography variant="h6" sx={{ mb: 3, color: "#2e7d32", textAlign: "center" }}>
                                        KautionFrei Prozess Schritte
                                    </Typography>

                                    {/* Step 1: Application Submitted */}
                                    <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
                                        <Box sx={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: "50%",
                                            bgcolor: "#4caf50",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            mr: 2,
                                            mt: 0.5,
                                            flexShrink: 0
                                        }}>
                                            <Typography variant="caption" sx={{ color: "white", fontWeight: "bold" }}>
                                                ✓
                                            </Typography>
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body1" sx={{ fontWeight: "medium", mb: 0.5 }}>
                                                Schritt 1: Antrag eingereicht
                                            </Typography>
                                            <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
                                                ✅ Erfolgreich erstellt - Vertrags-ID: {burgschaftData.cid}
                                            </Typography>
                                            <Typography variant="caption" color="textSecondary">
                                                Nächster Schritt: {burgschaftData.skip_to || "Wartet auf Prüfung"}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Connecting Line */}
                                    <Box sx={{
                                        width: 2,
                                        height: 24,
                                        bgcolor: statusData ? "#4caf50" : (countdown !== null ? "#ff9800" : "#e0e0e0"),
                                        ml: "13px",
                                        mb: 1
                                    }} />

                                    {/* Step 2: Status Verification */}
                                    <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
                                        <Box sx={{
                                            width: 28,
                                            height: 28,
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
                                            <Typography variant="body1" sx={{ fontWeight: "medium", mb: 0.5 }}>
                                                Schritt 2: Status Überprüfung
                                            </Typography>
                                            {statusData ? (
                                                <Box>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                                        <Typography variant="body2" color="success.main">
                                                            ✅ Status abgerufen:
                                                        </Typography>
                                                        <Chip
                                                            label={statusData.state}
                                                            color={getStatusColor(statusData.state)}
                                                            size="small"
                                                        />
                                                    </Box>
                                                    <Typography variant="caption" color="textSecondary" sx={{ display: "block" }}>
                                                        Bestell-ID: {statusData.orderId} | Rate: {statusData.rate}€ | Digital: {statusData.digital === "true" ? "Ja" : "Nein"}
                                                    </Typography>
                                                </Box>
                                            ) : countdown !== null ? (
                                                <Box>
                                                    <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
                                                        🔄 Antragsstatus wird in {countdown} Sekunden überprüft...
                                                    </Typography>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={(10 - countdown) * 10}
                                                        sx={{ height: 8, borderRadius: 4, width: "100%" }}
                                                    />
                                                </Box>
                                            ) : (
                                                <Typography variant="body2" color="textSecondary">
                                                    Bereit für Statusprüfung...
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>

                                    {/* Connecting Line */}
                                    {statusData && (
                                        <Box sx={{
                                            width: 2,
                                            height: 24,
                                            bgcolor: (statusData.state === "accepted" || statusData.state === "rejected") ? "#4caf50" : "#e0e0e0",
                                            ml: "13px",
                                            mb: 1
                                        }} />
                                    )}

                                    {/* Step 3: Final Status */}
                                    <Box sx={{ display: "flex", alignItems: "flex-start", mb: 3 }}>
                                        <Box sx={{
                                            width: 28,
                                            height: 28,
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
                                            <Typography variant="body1" sx={{ fontWeight: "medium", mb: 0.5 }}>
                                                Schritt 3: Prozess abgeschlossen
                                            </Typography>
                                            {statusData?.state === "accepted" ? (
                                                <Typography variant="body2" color="success.main">
                                                    🎉 Antrag genehmigt! Ihre KautionFrei Bürgschaft wurde bewilligt.
                                                </Typography>
                                            ) : statusData?.state === "rejected" ? (
                                                <Typography variant="body2" color="error.main">
                                                    ❌ Antrag abgelehnt. Bitte kontaktieren Sie den Support für weitere Informationen.
                                                </Typography>
                                            ) : statusData ? (
                                                <Typography variant="body2" color="warning.main">
                                                    ⏳ Antrag ist derzeit: {statusData.state}
                                                </Typography>
                                            ) : (
                                                <Typography variant="body2" color="textSecondary">
                                                    Wartet auf finale Entscheidung...
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>

                                    {/* Get Current Status Button */}
                                    {statusData && !countdown && !isProcessCompleted && (
                                        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                size="medium"
                                                onClick={checkCurrentStatus}
                                                disabled={statusLoading}
                                                startIcon={
                                                    statusLoading ? <CircularProgress size={16} /> : <CachedIcon />
                                                }
                                                sx={{ minWidth: 180 }}
                                            >
                                                {statusLoading ? "Überprüfung..." : "Aktuellen Status abrufen"}
                                            </Button>
                                        </Box>
                                    )}
                                    
                                    {/* Process Completed Notice */}
                                    {isProcessCompleted && (
                                        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
                                            <Alert severity="success" sx={{ width: '100%' }}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 1 }}>
                                                        🎉 Prozess erfolgreich abgeschlossen!
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        Dieser Link wurde deaktiviert. Ihr Antrag ist finalisiert mit Status: 
                                                        <strong> {statusData?.state?.toUpperCase()}</strong>
                                                    </Typography>
                                                </Box>
                                            </Alert>
                                        </Box>
                                    )}
                                </Box>
                            ) : (
                                /* Show Summary when burgschaftData does not exist */
                                showSummary && (
                                <>
                                    <Typography variant="h6" gutterBottom sx={{ 
                                        fontWeight: 'bold', 
                                        mb: 3, 
                                        textAlign: 'center',
                                        fontSize: '18px',
                                        color: '#333333',
                                        letterSpacing: '0.5px'
                                    }}>
                                        ZUSAMMENFASSUNG
                                    </Typography>

                                    {/* Summary Sections */}
                                    <Box sx={{ mb: 3 }}>
                                        {/* Mietobjekt Section */}
                                        <SummarySection title="MIETOBJEKT">
                                            <SummaryItem label="Adresse" value={`${formData.mietobjektStrasse} ${formData.mietobjektHausnummer}, ${formData.mietobjektPostleitzahl} ${formData.mietobjektStadt}`} />
                                            <SummaryItem label="Mietbeginn" value={formData.mietbeginn} />
                                            <SummaryItem label="Monatskaltmiete" value="" />
                                            <SummaryItem label="Mietvertrag befristet" value={formData.mietvertragBefristet === 'ja' ? 'Ja' : 'Nein'} />
                                            <SummaryItem label="Mietvertrag befristet bis" value="" />
                                            <SummaryItem label="Name Ihres Vermieters" value={formData.vermieterName} />
                                        </SummarySection>

                                        {/* Mieter Section */}
                                        <SummarySection title="MIETER" isLast={true}>
                                            <SummaryItem label="Anrede" value={formData.anrede} />
                                            <SummaryItem label="Name" value={`${formData.vorname} ${formData.nachname}`} />
                                            <SummaryItem label="Geburtsdatum" value={formData.geburtsdatum} />
                                            <SummaryItem label="Nationalität" value={formData.nationalitat} />
                                            <SummaryItem label="E-Mail" value={formData.emailAdresse} />
                                        </SummarySection>
                                    </Box>

                                    {/* Final Submit Button */}
                                    <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
                                        <Button
                                            variant="outlined"
                                            size="large"
                                            onClick={handleSubmitClick}
                                            disabled={processing || parseFloat(kautionAmount) < 400 || parseFloat(kautionAmount) > 15000 || !recaptchaValue}
                                            startIcon={processing ? <CircularProgress size={20} /> : null}
                                            sx={{
                                                minWidth: 250,
                                                py: 0.5,
                                                fontSize: '0.8rem',
                                                fontWeight: 'normal',
                                                borderRadius: '4px',
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #FF9800',
                                                color: '#FF9800',
                                                textTransform: 'none',
                                                boxShadow: 'inset 0 2px 8px rgba(255, 152, 0, 0.3), inset 0 1px 4px rgba(255, 152, 0, 0.2)',
                                                '&:hover': {
                                                    backgroundColor: '#FF9800',
                                                    color: '#FFFFFF',
                                                    border: '1px solid #FF9800',
                                                },
                                                '&:disabled': { 
                                                    bgcolor: (parseFloat(kautionAmount) < 400 || parseFloat(kautionAmount) > 15000) || !recaptchaValue ? '#ffcdd2' : '#f5f5f5',
                                                    color: (parseFloat(kautionAmount) < 400 || parseFloat(kautionAmount) > 15000) || !recaptchaValue ? '#c62828' : '#999999',
                                                    border: '1px solid #d0d0d0',
                                                    boxShadow: 'inset 0 2px 8px rgba(200, 200, 200, 0.3), inset 0 1px 4px rgba(200, 200, 200, 0.2)'
                                                }
                                            }}
                                        >
                                            {processing ? "Verarbeitung..." : 
                                             (parseFloat(kautionAmount) < 400 || parseFloat(kautionAmount) > 15000) ? "Kaution muss zwischen 400€ und 15000€ liegen" : 
                                             (!privacyAccepted || !documentsAccepted) ? "Bitte akzeptieren Sie alle Bedingungen" :
                                             "ZU KAUTIONFREI WEITERLEITEN"}
                                        </Button>
                                    </Box>
                                </>
                                )
                            )}

                        </Box>
                    )}

                    {/* Navigation Buttons */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
                        <Button
                            variant="text"
                            onClick={() => {
                                setCurrentStep(Math.max(1, currentStep - 1));
                                setTimeout(() => {
                                    // Smooth scroll to top with animation
                                    window.scrollTo({ 
                                        top: 0, 
                                        behavior: 'smooth',
                                        block: 'start'
                                    });
                                    document.documentElement.scrollTo({
                                        top: 0,
                                        behavior: 'smooth'
                                    });
                                    document.body.scrollTo({
                                        top: 0,
                                        behavior: 'smooth'
                                    });
                                    // Also try scrolling the main container
                                    const container = document.querySelector('.MuiContainer-root');
                                    if (container) {
                                        container.scrollTo({
                                            top: 0,
                                            behavior: 'smooth'
                                        });
                                    }
                                }, 100);
                            }}
                            disabled={currentStep === 1}
                            sx={{ 
                                minWidth: 120,
                                color: '#FF9800',
                                textTransform: 'none',
                                fontSize: '0.95rem',
                                fontWeight: 'normal',
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 152, 0, 0.04)',
                                    textDecoration: 'underline'
                                },
                                '&:disabled': {
                                    color: '#ccc'
                                }
                            }}
                        >
                            ← Zurück zum Start
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => {
                                setCurrentStep(Math.min(4, currentStep + 1));
                                setTimeout(() => {
                                    // Smooth scroll to top with animation
                                    window.scrollTo({ 
                                        top: 0, 
                                        behavior: 'smooth',
                                        block: 'start'
                                    });
                                    document.documentElement.scrollTo({
                                        top: 0,
                                        behavior: 'smooth'
                                    });
                                    document.body.scrollTo({
                                        top: 0,
                                        behavior: 'smooth'
                                    });
                                    // Also try scrolling the main container
                                    const container = document.querySelector('.MuiContainer-root');
                                    if (container) {
                                        container.scrollTo({
                                            top: 0,
                                            behavior: 'smooth'
                                        });
                                    }
                                }, 100);
                            }}
                            disabled={currentStep === 4 || (currentStep === 3 && !recaptchaValue)}
                            endIcon={<ChevronRightIcon sx={{ color: '#FF9800', width: '35px', height: '35px' }} />}
                            sx={{
                                minWidth: 210,
                                minHeight: 40,
                                backgroundColor: '#FFFFFF',
                                color: '#ff7c00',
                                border: '1.5px solid #ff7c00',
                                textTransform: 'uppercase',
                                fontSize: '15px',
                                fontWeight: '',
                                borderRadius: '25px',
                                padding: '4px 10px',
                                '&:disabled': {
                                    backgroundColor: '#f5f5f5',
                                    border: '2px solid #ccc',
                                    color: '#ccc'
                                }
                            }}
                        >
                            {getNextStepButtonText(currentStep)}
                        </Button>
                    </Box>

                    {/* reCAPTCHA validation message */}
                    {currentStep === 3 && !recaptchaValue && (
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                            <Typography variant="body2" color="error" sx={{ fontStyle: 'italic' }}>
                                Bitte vervollständigen Sie die Sicherheitsprüfung, um fortzufahren.
                            </Typography>
                        </Box>
                    )}

                        </Box>
                        
                        {/* Right Column - Sidebar */}
                        <Box sx={{ 
                            flex: 1.2, 
                            backgroundColor: '#f4f4eb',
                            // borderRadius: 2,
                            p: 3,
                            minHeight: '600px',
                            // boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                            display: { xs: 'none', md: 'block' }
                        }}>
                            
                            {/* Mieter Information Card */}
                            <Box sx={{ 
                                mb: 3, 
                                p: 2, 
                                // backgroundColor: '#f8f9fa',
                                // borderRadius: 2,
                                // border: '1px solid #e9ecef'
                            }}>
                                <Typography variant="h6" sx={{ 
                                    fontWeight: 'bold', 
                                    mb: 2, 
                                    color: '#2e7d32',
                                    fontSize: '1rem'
                                }}>
                                    Mieter: Anrede und Kontakt
                                </Typography>
                                <Typography variant="body2" sx={{ 
                                    fontSize: '14px', 
                                    color: '#383838',
                                    lineHeight: 1.4,
                                    mb: 1
                                }}>
                                    Tragen Sie die Angaben zu Ihrer Person als Mieter hier ein.
                                </Typography>
                                
                               
                                
                                <Typography variant="body2" sx={{ 
                                    fontSize: '14px', 
                                    color: '#383838',
                                    lineHeight: 1.4
                                }}>
                                    Sie können auch einen zweiten Mieter hinzufügen. Der zweite Mieter ist optional und nicht erforderlich, auch wenn mehr als eine Person in Mietobjekt steht.
                                </Typography>
                            </Box>
 {/* Divider */}
                                <Box sx={{ 
                                    width: '100%', 
                                    height: '1.5px', 
                                    backgroundColor: '#e0e0e0', 
                                    my: 1.5 
                                }} />

                            {/* Trust Badges */}
                            <Box sx={{ mb: 3, display: 'flex', gap: 2, justifyContent: 'space-evenly' }}>
                                <Box sx={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <img 
                                        src={siegelFocusmoney} 
                                        alt="Focus Money Siegel" 
                                        style={{ 
                                            height: '77px', 
                                            width: 'auto',
                                            borderRadius: '4px'
                                        }} 
                                    />
                                </Box>
                                <Box sx={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <img 
                                        src={siegelGetested} 
                                        alt="Getested Siegel" 
                                        style={{ 
                                            height: '77px', 
                                            width: 'auto',
                                            borderRadius: '4px'
                                        }} 
                                    />
                                </Box>
                            </Box>
 <Box sx={{ 
                                    width: '100%', 
                                    height: '1.5px', 
                                    backgroundColor: '#e0e0e0', 
                                    my: 1.5 
                                }} />
                            {/* KautionFrei Rating */}
                            <Box sx={{ 
                                mb: 3, 
                                p: 1.5, 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1.5
                            }}>
                                {/* Professional Badge/Seal */}
                                <Box sx={{ 
                                    width: 50,
                                    height: 50,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <img 
                                        src={kfLogo} 
                                        alt="KautionFrei Logo" 
                                        style={{ 
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain'
                                        }} 
                                    />
                                </Box>
                                
                                {/* Text Content */}
                                <Box sx={{ textAlign: 'left' }}>
                                    <Typography variant="h6" sx={{ 
                                        fontSize: '0.9rem', 
                                        fontWeight: 'bold',
                                        color: '#999',
                                        mb: 0.3,
                                        letterSpacing: '0.3px'
                                    }}>
                                        KAUTIONFREI
                                    </Typography>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3 }}>
                                        <Box sx={{ display: 'flex', gap: 0.1 }}>
                                            {[1,2,3,4,5].map((star) => (
                                                <Typography key={star} sx={{ 
                                                    color: '#ffc107', 
                                                    fontSize: '0.9rem',
                                                    lineHeight: 1
                                                }}>★</Typography>
                                            ))}
                                        </Box>
                                        <Typography sx={{ 
                                            fontSize: '0.75rem', 
                                            fontWeight: '600',
                                            color: '#999',
                                            ml: 0.3
                                        }}>
                                            4,9/5
                                        </Typography>
                                    </Box>
                                    
                                    <Typography sx={{ 
                                        fontSize: '0.7rem', 
                                        color: '#999',
                                        fontWeight: '500'
                                    }}>
                                        39.186 Stimmen
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Support Section */}
                            <Box sx={{ 
                                p: 2, 
                                // backgroundColor: '#f8f9fa',
                                // borderRadius: 2,
                                // border: '1px solid #e9ecef'
                            }}>
                                <Typography variant="h6" sx={{ 
                                    fontWeight: 'bold', 
                                    mb: 2, 
                                    color: '#4caf50',
                                    fontSize: '0.9rem'
                                }}>
                                    Kostenloser Support
                                </Typography>
                                <Typography variant="body2" sx={{ 
                                    fontSize: '0.75rem', 
                                    color: '#6c757d',
                                    mb: 2
                                }}>
                                    Bei Fragen? Wir helfen Ihnen gerne weiter:
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ 
                                        width: 20, 
                                        height: 20, 
                                        backgroundColor: '#333',
                                        borderRadius: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Typography sx={{ color: 'white', fontSize: '0.7rem' }}>📞</Typography>
                                    </Box>
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}>
                                        +49/0 1 72 208 (24 Stunden)
                                    </Typography>
                                </Box>
                            </Box>

                        </Box>
                        
                    </Box>

                    {/* Footer */}
                    <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #eee', textAlign: 'center' }}>
                        <Typography variant="caption" color="textSecondary">
                            Link ID: {linkId}
                        </Typography>
                    </Box>
                </CardContent>
            </Card>

        </Container>
    </Box>
            </LocalizationProvider>
        </ThemeProvider>
    );
};export default ClientView;
