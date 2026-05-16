/**
 * Types Index
 * Central export point for all type definitions
 * 
 * Types are organized by domain:
 * - common: Shared types used across multiple domains
 * - employee: Employee and HR management
 * - payroll: Salary and compensation
 * - revenue: Revenue and financial analysis
 * - dashboard: Dashboard analytics
 * - pos: Point of Sale system
 * - inventory: Inventory and supply chain
 * - marketing: Marketing and promotions
 * - shopee: Shopee marketplace integration
 * - app: Application state management
 */

// Re-export all types from domain-specific files
export * from './common';
export * from './employee';
export * from './payroll';
export * from './revenue';
export * from './dashboard';
export * from './pos';
export * from './inventory';
export * from './marketing';
export * from './shopee';
export * from './app';
