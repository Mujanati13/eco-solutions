# Eco-S Order Management System - Usage Documentation

## Table of Contents
1. [Dashboard](#dashboard)
2. [Orders Management](#orders-management)
3. [User Management](#user-management)
4. [Activity Logs (Reports)](#activity-logs-reports)
5. [Session Time Tracking](#session-time-tracking)
6. [Profile Management](#profile-management)

---

## Dashboard

The Dashboard provides a comprehensive overview of the system's performance and key metrics.

### Features:
- **Order Statistics Cards**: Display total orders, pending orders, delivered orders, and revenue
- **Order Trends Chart**: Interactive line chart showing order trends over time
- **Order Status Distribution**: Pie chart showing distribution of orders by status
- **Performance Metrics**: Bar chart showing user performance data
- **Recent Activities**: Quick overview of recent system activities

### Functions:
- **Auto-refresh**: Dashboard data updates automatically
- **Interactive Charts**: Click on chart elements for detailed views
- **Date Range Selection**: Filter data by custom date ranges
- **Export Data**: Export dashboard data to CSV/Excel

### User Roles:
- **Admin**: Full access to all metrics and data
- **Employee**: Limited view based on assigned orders

---

## Orders Management

The Orders page is the core of the system for managing customer orders and delivery tracking.

### Features:
- **Order Listing**: Paginated table with all orders
- **Advanced Filtering**: Filter by status, assigned user, customer name, order number, dates
- **Order Creation**: Create new orders with customer and product details
- **Order Editing**: Update order information, status, and assignments
- **Order Assignment**: Assign orders to specific staff members
- **Bulk Import**: Import orders from Excel/CSV files
- **Export Orders**: Export filtered orders to CSV format
- **Status Tracking**: Track order progression through different statuses

### Functions:

#### Order Creation:
1. Click "Add Order" button
2. Fill in customer information (name, phone, address, city)
3. Add product details and pricing
4. Set delivery date and notes
5. Save to create order

#### Order Management:
- **View**: Click on order row to view details
- **Edit**: Click edit button to modify order information
- **Assign**: Use assign button to assign order to staff member
- **Status Update**: Change order status from dropdown
- **Delete**: Remove orders (admin only)

#### Import Orders:
1. Click "Import Orders" button
2. Upload Excel/CSV file with order data
3. Review import summary
4. Confirm import to add orders to system

#### Export Orders:
1. Apply desired filters (status, date range, assigned user)
2. Click "Export" button
3. Choose CSV format
4. Download will start automatically

### Order Statuses:
- **Pending**: Newly created orders awaiting confirmation
- **Confirmed**: Verified orders ready for processing
- **Processing**: Orders being prepared for shipment
- **Out for Delivery**: Orders dispatched to customers
- **Delivered**: Successfully completed orders
- **Cancelled**: Orders that were cancelled
- **Returned**: Orders returned by customers
- **On Hold**: Orders temporarily paused

### User Roles:
- **Admin**: Full access to all orders and management functions
- **Employee**: Access to assigned orders and limited management functions

---

## User Management

The Users page allows administrators to manage staff accounts and permissions.

### Features:
- **User Listing**: Table of all system users with details
- **User Creation**: Add new staff members
- **User Editing**: Update user information and roles
- **Performance Tracking**: View user performance metrics
- **Account Status**: Activate/deactivate user accounts
- **Role Management**: Assign admin or employee roles

### Functions:

#### Create User:
1. Click "Add User" button
2. Enter user details (username, email, name, phone)
3. Set password and confirm
4. Assign role (Admin/Employee)
5. Save to create account

#### Edit User:
1. Click edit button on user row
2. Update user information
3. Change role if needed
4. Save changes

#### User Performance:
- View total orders handled
- Check performance scores
- Monitor activity levels

### User Roles:
- **Admin**: Full access to user management
- **Employee**: Cannot access user management

---

## Activity Logs (Reports)

The Activity Logs page provides comprehensive tracking and reporting of all system activities.

### Features:
- **Activity Timeline**: Chronological list of all system activities
- **Advanced Filtering**: Filter by user, activity type, date range
- **Activity Statistics**: Overview cards showing activity counts by type
- **User Filter**: Filter activities by specific users
- **Grouping Options**: Group activities by day, month, or year
- **Detailed Metadata**: View detailed information about each activity
- **Pagination**: Navigate through large datasets efficiently

### Functions:

#### View Activities:
- Browse chronological list of all activities
- See activity type, user, timestamp, and description
- View detailed metadata for complex activities

#### Filter Activities:
1. **Date Range**: Select start and end dates using date picker
2. **Activity Type**: Choose from dropdown (login, logout, order actions, etc.)
3. **User Filter**: Select specific user from dropdown
4. **Apply Filters**: Activities update automatically

#### Group Activities:
- **By Day**: Group activities by individual days
- **By Month**: Group activities by months
- **By Year**: Group activities by years
- **No Grouping**: Show individual activities

#### Activity Types Tracked:
- **Login/Logout**: User authentication activities
- **Order Created**: New order creation
- **Order Updated**: Order modifications
- **Order Assigned**: Order assignments to users
- **Order Imported**: Bulk order imports
- **Order Exported**: Data export activities
- **User Updates**: User account modifications
- **Page Views**: Page navigation tracking

### User Roles:
- **Admin**: Full access to all user activities
- **Employee**: Limited to own activities

---

## Session Time Tracking

The Session Time Tracking page provides detailed insights into user login sessions and time management.

### Features:
- **Active Sessions**: View currently active user sessions
- **Session History**: Historical record of all sessions
- **Time Analytics**: Track session duration and patterns
- **Session Management**: End active sessions (admin only)
- **Performance Metrics**: Analyze user engagement and activity

### Functions:

#### View Sessions:
- See all active and historical sessions
- Monitor session duration and activity
- Track login/logout times

#### Session Management (Admin):
- Force end active sessions
- Monitor user activity levels
- Analyze usage patterns

#### Filter Sessions:
- Filter by user
- Filter by date range
- Filter by session status (active/ended)

### Metrics Displayed:
- **Session Duration**: Total time logged in
- **Activity Level**: User engagement during session
- **Login Frequency**: How often users log in
- **Peak Usage Times**: When system is most active

### User Roles:
- **Admin**: Full access to all user sessions
- **Employee**: View own sessions only

---

## Profile Management

The Profile page allows users to manage their personal account information and settings.

### Features:
- **Personal Information**: Update name, email, phone number
- **Password Management**: Change account password
- **Language Selection**: Choose interface language (English, French, Arabic)
- **Profile Picture**: Upload and manage profile image
- **Account Settings**: Configure personal preferences

### Functions:

#### Update Profile:
1. Navigate to Profile page
2. Edit personal information fields
3. Save changes

#### Change Password:
1. Click "Change Password"
2. Enter current password
3. Enter new password and confirm
4. Save to update

#### Language Settings:
- Select from English, French, or Arabic
- Interface updates immediately
- Preference saved for future sessions

### Security Features:
- Password complexity requirements
- Session timeout management
- Login history tracking

### User Roles:
- **All Users**: Full access to own profile management

---

## General System Features

### Multi-Language Support:
- **English**: Default language
- **French**: Full French translation
- **Arabic**: Complete Arabic translation with RTL support

### Authentication & Security:
- **JWT Token Authentication**: Secure session management
- **Role-Based Access Control**: Different permissions for admin/employee
- **Session Management**: Automatic logout for security
- **Password Security**: Encrypted password storage

### Data Export/Import:
- **Excel Import**: Support for .xlsx and .csv files
- **CSV Export**: Download filtered data sets
- **Bulk Operations**: Handle large datasets efficiently

### Responsive Design:
- **Mobile Friendly**: Works on phones and tablets
- **Desktop Optimized**: Full feature set on desktop
- **Cross-Browser**: Compatible with modern browsers

### Real-Time Features:
- **Auto-Refresh**: Data updates automatically
- **Activity Tracking**: Real-time activity logging
- **Session Monitoring**: Live session status updates

---

## Common Operations

### Creating Orders:
1. Navigate to Orders page
2. Click "Add Order" button
3. Fill customer information
4. Add product details
5. Set delivery preferences
6. Save order

### Managing Order Status:
1. Find order in Orders table
2. Click status dropdown
3. Select new status
4. Confirm change
5. Status updates with timestamp

### Assigning Orders:
1. Select order from table
2. Click "Assign" button
3. Choose staff member from dropdown
4. Confirm assignment
5. Order appears in assignee's list

### Importing Orders:
1. Prepare Excel/CSV file with required columns
2. Click "Import Orders" button
3. Upload file
4. Review mapping and preview
5. Confirm import
6. Check import results

### Viewing Reports:
1. Navigate to Activity Logs page
2. Set desired filters (date, user, type)
3. Review activity statistics
4. Use grouping for summary views
5. Export data if needed

---

## Troubleshooting

### Common Issues:

#### Login Problems:
- Check username and password
- Ensure account is active
- Contact admin if account is locked

#### Data Not Loading:
- Check internet connection
- Refresh the page
- Clear browser cache

#### Import Failures:
- Verify file format (Excel/CSV)
- Check required columns are present
- Ensure data format is correct

#### Permission Errors:
- Verify user role permissions
- Contact admin for access issues
- Check if account is active

### Support:
For technical support or questions about system usage, contact your system administrator or IT support team.

---

*Last Updated: July 6, 2025*
*Version: 1.0*
