<?php
// Config for API keys and environment settings

// Check for .env or environment variables in a real app
// For this task, we can set it here or ask user to input
// --- 1. OpenAI (Default) ---
// define('API_KEY', 'sk-...');
// define('API_URL', 'https://api.openai.com/v1/chat/completions');
// define('AI_MODEL', 'gpt-3.5-turbo');

// --- 2. Groq (Free & Fast) ---
// Get key: https://console.groq.com/keys
// define('API_KEY', 'gsk_...'); 
// define('API_URL', 'https://api.groq.com/openai/v1/chat/completions');
// define('AI_MODEL', 'llama3-70b-8192');

// --- 3. Google Gemini (Free Tier Available) ---
// Get key: https://aistudio.google.com/app/apikey
// define('API_KEY', 'AIza...');
// define('API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent');
// define('AI_MODEL', 'gemini-pro');

// ACTIVE CONFIGURATION (Google Gemini)
define('API_KEY', getenv('GEMINI_API_KEY') ?: 'YOUR_API_KEY_HERE');
define('API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent');
define('AI_MODEL', 'gemini-1.5-flash');
define('LOG_FILE', __DIR__ . '/requests.log');

// Set error reporting
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't output errors to the response, we return JSON errors
