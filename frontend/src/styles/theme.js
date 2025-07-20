// Custom theme configuration for Eco-S Order Management System
export const ecoSTheme = {
  token: {
    // Primary brand colors
    colorPrimary: '#1E88E5',        // Blue - Primary actions, links, focus states
    colorSuccess: '#43A047',        // Green - Success states, confirmations
    colorWarning: '#FFB300',        // Amber - Warnings, alerts
    colorError: '#F44336',          // Red - Errors, deletions
    colorInfo: '#1E88E5',           // Blue - Information, neutral actions
    
    // Background colors
    colorBgContainer: '#FFFFFF',     // Card/container backgrounds
    colorBgLayout: '#F4F6F8',       // Page/layout background
    colorBgElevated: '#FFFFFF',     // Modal, dropdown backgrounds
    colorBgMask: 'rgba(0, 0, 0, 0.45)', // Modal mask
    
    // Text colors
    colorText: '#212121',           // Primary text
    colorTextSecondary: '#757575',  // Secondary text
    colorTextTertiary: '#BDBDBD',   // Disabled/placeholder text
    colorTextQuaternary: '#E0E0E0', // Divider text
    
    // Border and divider colors
    colorBorder: '#E0E0E0',         // Default borders
    colorBorderSecondary: '#F5F5F5', // Secondary borders
    colorSplit: '#F5F5F5',          // Dividers
    
    // Component styling
    borderRadius: 8,                // Default border radius
    borderRadiusLG: 12,            // Large border radius
    borderRadiusSM: 6,             // Small border radius
    borderRadiusXS: 4,             // Extra small border radius
    
    // Typography
    fontSize: 14,                   // Base font size
    fontSizeLG: 16,                // Large font size
    fontSizeSM: 12,                // Small font size
    fontSizeXL: 20,                // Extra large font size
    fontSizeHeading1: 38,          // H1 size
    fontSizeHeading2: 30,          // H2 size
    fontSizeHeading3: 24,          // H3 size
    fontSizeHeading4: 20,          // H4 size
    fontSizeHeading5: 16,          // H5 size
    fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    
    // Spacing
    controlHeight: 36,              // Default control height
    controlHeightLG: 40,           // Large control height
    controlHeightSM: 28,           // Small control height
    controlHeightXS: 24,           // Extra small control height
    
    // Shadows
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.08)',
    boxShadowTertiary: '0 6px 24px rgba(0, 0, 0, 0.12)',
    
    // Motion
    motionDurationFast: '0.1s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s',
  },
  
  components: {
    // Button component customization
    Button: {
      borderRadius: 6,
      controlHeight: 36,
      fontWeight: 500,
      primaryShadow: '0 2px 4px rgba(30, 136, 229, 0.2)',
      dangerShadow: '0 2px 4px rgba(244, 67, 54, 0.2)',
    },
    
    // Card component customization
    Card: {
      borderRadius: 8,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      headerBg: '#FFFFFF',
      actionsBg: '#FAFAFA',
    },
    
    // Table component customization
    Table: {
      borderRadius: 8,
      headerBg: '#E3F2FD',
      headerColor: '#212121',
      headerSortActiveBg: '#BBDEFB',
      headerSortHoverBg: '#E1F5FE',
      rowHoverBg: '#F3F4F6',
      rowSelectedBg: '#E3F2FD',
      rowSelectedHoverBg: '#BBDEFB',
    },
    
    // Menu component customization
    Menu: {
      itemBg: '#FFFFFF',
      itemSelectedBg: '#E3F2FD',
      itemSelectedColor: '#1E88E5',
      itemHoverBg: '#F5F5F5',
      itemHoverColor: '#1E88E5',
      itemActiveBg: '#BBDEFB',
      subMenuItemBg: '#FFFFFF',
      groupTitleColor: '#757575',
    },
    
    // Input component customization
    Input: {
      borderRadius: 6,
      controlHeight: 36,
      activeBorderColor: '#1E88E5',
      hoverBorderColor: '#42A5F5',
      activeShadow: '0 0 0 2px rgba(30, 136, 229, 0.2)',
    },
    
    // Select component customization
    Select: {
      borderRadius: 6,
      controlHeight: 36,
      optionSelectedBg: '#E3F2FD',
      optionSelectedColor: '#1E88E5',
      optionActiveBg: '#F5F5F5',
    },
    
    // Layout component customization
    Layout: {
      headerBg: '#FFFFFF',
      headerHeight: 64,
      headerPadding: '0 24px',
      siderBg: '#FFFFFF',
      bodyBg: '#F4F6F8',
      footerBg: '#FFFFFF',
      triggerBg: '#E3F2FD',
      triggerColor: '#1E88E5',
    },
    
    // Modal component customization
    Modal: {
      borderRadius: 12,
      headerBg: '#FFFFFF',
      contentBg: '#FFFFFF',
      footerBg: '#FAFAFA',
    },
    
    // Drawer component customization
    Drawer: {
      borderRadius: 0,
      headerHeight: 56,
      bodyPadding: 24,
      footerPaddingBlock: 16,
      footerPaddingInline: 24,
    },
    
    // Tag component customization
    Tag: {
      borderRadiusSM: 4,
      defaultBg: '#F5F5F5',
      defaultColor: '#212121',
    },
    
    // Alert component customization
    Alert: {
      borderRadius: 8,
      withDescriptionPadding: '16px',
      withDescriptionPaddingVertical: 12,
    },
    
    // Progress component customization
    Progress: {
      defaultColor: '#1E88E5',
      remainingColor: '#F0F0F0',
    },
    
    // Statistic component customization
    Statistic: {
      titleFontSize: 14,
      contentFontSize: 24,
      titleColor: '#757575',
      contentColor: '#212121',
    },
    
    // DatePicker component customization
    DatePicker: {
      borderRadius: 6,
      controlHeight: 36,
      cellActiveWithRangeBg: '#E3F2FD',
      cellHoverWithRangeBg: '#F3F4F6',
    },
    
    // Steps component customization
    Steps: {
      iconSize: 24,
      titleLineHeight: 1.5,
      descriptionLineHeight: 1.5,
    },
    
    // Tabs component customization
    Tabs: {
      borderRadius: 6,
      cardBg: '#FFFFFF',
      cardGutter: 2,
      titleFontSize: 14,
      titleFontSizeLG: 16,
      titleFontSizeSM: 12,
    },
    
    // Badge component customization
    Badge: {
      textFontSize: 12,
      textFontSizeSM: 10,
      textFontWeight: 400,
    },
    
    // Tooltip component customization
    Tooltip: {
      borderRadius: 6,
      maxWidth: 250,
    },
    
    // Popover component customization
    Popover: {
      borderRadius: 8,
      titleMinWidth: 120,
      innerPadding: 16,
    },
  },
};

// CSS custom properties mapping
export const cssVariables = {
  '--eco-primary': '#1E88E5',
  '--eco-secondary': '#43A047',
  '--eco-background': '#F4F6F8',
  '--eco-card': '#FFFFFF',
  '--eco-text-primary': '#212121',
  '--eco-accent': '#FFB300',
  '--eco-primary-hover': '#1976D2',
  '--eco-primary-active': '#1565C0',
  '--eco-primary-light': '#E3F2FD',
  '--eco-secondary-hover': '#388E3C',
  '--eco-secondary-active': '#2E7D32',
  '--eco-secondary-light': '#E8F5E8',
  '--eco-accent-hover': '#FFA000',
  '--eco-accent-active': '#FF8F00',
  '--eco-accent-light': '#FFF8E1',
  '--eco-text-secondary': '#757575',
  '--eco-text-disabled': '#BDBDBD',
  '--eco-text-inverse': '#FFFFFF',
  '--eco-border-color': '#E0E0E0',
  '--eco-divider-color': '#F5F5F5',
  '--eco-success': '#43A047',
  '--eco-warning': '#FFB300',
  '--eco-error': '#F44336',
  '--eco-info': '#1E88E5',
};

export default ecoSTheme;
