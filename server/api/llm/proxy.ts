/**
 * LLM Proxy Endpoint for Secure API Key Management
 * Handles OpenAI API requests without exposing keys to frontend
 */

import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// OpenAI proxy endpoint
router.post('/proxy', async (req, res) => {
  try {
    const { model, messages, ...options } = req.body;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages,
        ...options
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('OpenAI proxy error:', error);
    res.status(500).json({ error: 'OpenAI API request failed' });
  }
});

// Groq proxy endpoint
router.post('/groq-proxy', async (req, res) => {
  try {
    const { model, messages, ...options } = req.body;
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'llama-3.1-70b-versatile',
        messages,
        ...options
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Groq proxy error:', error);
    res.status(500).json({ error: 'Groq API request failed' });
  }
});

export default router;