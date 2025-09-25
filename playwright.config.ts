/**
 * Playwright Configuration for E2E Testing
 * 
 * Configures Playwright for end-to-end testing of the complete user journey
 * including Stripe checkout, MCP orchestrator, and browser automation.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Global test configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Test timeout
  timeout: 300000, // 5 minutes for complete flow
  
  // Global setup and teardown - disabled for manual server startup
  // globalSetup: './tests/e2e/global-setup.ts',
  // globalTeardown: './tests/e2e/global-teardown.ts',
  
  // Reporter configuration
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  
  // Test configuration
  use: {
    // Base URL for tests
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    
    // Browser context options
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Timeouts
    actionTimeout: 30000,
    navigationTimeout: 30000,
    
    // Browser options
    launchOptions: {
      slowMo: 100, // Slow down actions for better debugging
    },
    
    // Viewport
    viewport: { width: 1280, height: 720 },
    
    // User agent
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  
  // Browser projects
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // Web server configuration - disabled for manual server startup
  // webServer: {
  //   command: process.platform === 'win32' ? 'npm run dev' : 'NODE_ENV=development npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000, // 2 minutes for server startup
  //   env: {
  //     NODE_ENV: 'development'
  //   }
  // },
  
  // Test output directory
  outputDir: 'test-results/',
  
  // Test metadata
  metadata: {
    testName: 'Complete User Journey E2E',
    description: 'End-to-end test of the complete user flow from landing page to browser automation',
    version: '1.0.0',
    author: 'ReviewerAI',
  },
});

