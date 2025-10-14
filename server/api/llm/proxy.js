/**
 * LLM Proxy Routes - Secure API Key Handling
 * 
 * This module provides secure proxy endpoints for LLM API calls,
 * preventing API key exposure in the frontend.
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

// OpenAI proxy endpoint
router.post('/openai', async (req, res) => {
  try {
    const { messages, model = 'gpt-4o', temperature = 0.7, max_tokens = 1000 } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        success: false
      });
    }

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model,
      messages,
      temperature,
      max_tokens
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('OpenAI proxy error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error?.message || 'OpenAI API request failed',
      success: false
    });
  }
});

// Groq proxy endpoint
router.post('/groq', async (req, res) => {
  try {
    const { messages, model = 'llama-3.1-70b-versatile', temperature = 0.7, max_tokens = 1000 } = req.body;

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: 'Groq API key not configured',
        success: false
      });
    }

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model,
      messages,
      temperature,
      max_tokens
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Groq proxy error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error?.message || 'Groq API request failed',
      success: false
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    endpoints: ['/openai', '/groq'],
    configured: {
      openai: !!process.env.OPENAI_API_KEY,
      groq: !!process.env.GROQ_API_KEY
    },
    timestamp: new Date().toISOString()
  });
});

export default router;