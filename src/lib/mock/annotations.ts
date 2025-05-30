export const mockAnnotations = new Map<string, string>([
  // Root level directories
  ['src', 'This directory contains the main source code of the application. It includes React components, context providers, and utility functions organized in a modular structure.'],
  ['public', 'This directory houses static assets and public files for the web application. It includes the index.html file, favicon, and other static resources that are served directly.'],
  ['server', 'This directory contains the backend server code and API endpoints. It implements the server-side logic, database connections, and external service integrations.'],
  ['tests', 'This directory contains all test files and testing utilities. It includes unit tests, integration tests, and test helpers for ensuring code quality and reliability.'],
  
  // src subdirectories
  ['src/components', 'This directory contains React components used throughout the application. It includes UI components, layout components, and specialized feature components.'],
  ['src/context', 'This directory contains React context providers and hooks. It manages global state and provides shared functionality across the application.'],
  ['src/utils', 'This directory contains utility functions and helper methods. It includes common functions for data manipulation, formatting, and business logic.'],
  ['src/hooks', 'This directory contains custom React hooks. It includes reusable logic and state management patterns used across components.'],
  ['src/styles', 'This directory contains styling files and theme configurations. It includes global styles, theme definitions, and styling utilities.'],
  ['src/assets', 'This directory contains static assets used in the application. It includes images, icons, and other media files.'],
  ['src/types', 'This directory contains TypeScript type definitions. It includes interfaces, types, and type utilities used throughout the application.'],
  ['src/api', 'This directory contains API integration code. It includes API clients, request handlers, and response transformers.'],
  
  // server subdirectories
  ['server/routes', 'This directory contains API route definitions and handlers. It organizes endpoints by feature and includes middleware and validation.'],
  ['server/models', 'This directory contains database models and schemas. It defines data structures and relationships for the application.'],
  ['server/services', 'This directory contains business logic and service layer code. It implements core functionality and external service integrations.'],
  ['server/middleware', 'This directory contains Express middleware functions. It includes authentication, logging, and request processing middleware.'],
  ['server/config', 'This directory contains configuration files and environment settings. It manages application configuration and environment variables.'],
  
  // tests subdirectories
  ['tests/unit', 'This directory contains unit tests for individual components and functions. It includes isolated tests for specific functionality.'],
  ['tests/integration', 'This directory contains integration tests for feature workflows. It tests interactions between multiple components and services.'],
  ['tests/e2e', 'This directory contains end-to-end tests for complete user flows. It tests the application from a user perspective.'],
  
  // Additional common directories
  ['docs', 'This directory contains project documentation and guides. It includes API documentation, setup instructions, and development guidelines.'],
  ['scripts', 'This directory contains utility scripts and build tools. It includes deployment scripts, database migrations, and development utilities.'],
  ['config', 'This directory contains configuration files for various tools. It includes ESLint, Prettier, and other development tool configurations.'],
  ['migrations', 'This directory contains database migration files. It includes schema changes and data transformations for the database.'],
  ['seeds', 'This directory contains database seed files. It includes initial data and test data for development and testing.'],
  
  // Nested component directories
  ['src/components/ui', 'This directory contains reusable UI components. It includes buttons, inputs, modals, and other common interface elements.'],
  ['src/components/layout', 'This directory contains layout components. It includes page layouts, navigation, and structural components.'],
  ['src/components/features', 'This directory contains feature-specific components. It includes components that implement specific application features.'],
  
  // Nested server directories
  ['server/routes/api', 'This directory contains API route handlers. It organizes endpoints by version and includes request validation.'],
  ['server/routes/auth', 'This directory contains authentication-related routes. It includes login, registration, and session management endpoints.'],
  ['server/routes/users', 'This directory contains user-related routes. It includes user management and profile endpoints.'],
  
  // Nested test directories
  ['tests/unit/components', 'This directory contains unit tests for React components. It includes tests for component rendering and behavior.'],
  ['tests/unit/hooks', 'This directory contains unit tests for custom hooks. It includes tests for hook behavior and state management.'],
  ['tests/unit/utils', 'This directory contains unit tests for utility functions. It includes tests for helper methods and data processing.'],
]); 