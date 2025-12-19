# Dinzin AI Automation Tool
> Developer Intern Technical Assignment

A simple yet powerful AI automation tool built with **PHP** and **Vanilla JavaScript**. This tool enables users to process text using AI to summarize, generate replies, or convert content into bullet points.

## Features
- **Frontend**: Clean, modern UI with glassmorphism design (HTML5/CSS3).
- **Backend**: Robust PHP API Endpoint.
- **AI Integration**: Connects to OpenAI API (GPT-3.5/4).
- **Automation Logic**: Context-aware prompt engineering based on user selection.
- **Bonus Features**:
  - Loading indicators & animations.
  - Request logging (`requests.log`).
  - Input sanitization.
  - Error handling.
  - Copy to clipboard functionality.

## Setup Instructions

### Prerequisites
- A local server environment (e.g., XAMPP, WAMP, or PHP built-in server).
- An OpenAI API Key.

### Installation
1. Clone or download this repository into your server's root directory (e.g., `/htdocs` or `/www`).
2. Navigate to the project folder.
3. Open `config.php` and replace the placeholder API key with your actual OpenAI API Key:
   ```php
   define('OPENAI_API_KEY', 'sk-...');
   ```

### Running the Project
If using the PHP built-in server:
1. Open a terminal in the project directory.
2. Run:
   ```bash
   php -S localhost:8000
   ```
3. Open your browser and go to `http://localhost:8000`.

## API Documentation
The tool uses a single endpoint `api.php` which accepts POST requests.

**Endpoint**: `POST /api.php`
**Content-Type**: `application/json`

**Body:**
```json
{
  "text": "Your text content here...",
  "action": "summarize" // Options: "summarize", "reply", "bulletbox"
}
```

## Structure
- `index.html`: Main user interface.
- `style.css`: Custom styling (no frameworks).
- `script.js`: Frontend logic and API communication.
- `api.php`: Backend logic and API integration.
- `config.php`: Configuration settings.
- `requests.log`: Log of processed requests.
# dinzinai
