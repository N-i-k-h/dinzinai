<?php
ob_start(); // Start output buffering to capture any unwanted output
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST');
require_once 'config.php';

// Helper for sending JSON response
function sendResponse($success, $data = null, $message = null) {
    ob_end_clean(); // Clean the buffer before sending response
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message,
        'timestamp' => date('c')
    ]);
    exit;
}

// Logger function
function logRequest($action, $input, $result, $status) {
    $logEntry = sprintf(
        "[%s] Action: %s | Status: %s | Input: %s... | Result Length: %d\n",
        date('Y-m-d H:i:s'),
        $action,
        $status,
        substr(str_replace("\n", " ", $input), 0, 50),
        strlen($result ?? '')
    );
    // Suppress errors for file write to avoid breaking JSON
    @file_put_contents(LOG_FILE, $logEntry, FILE_APPEND);
}

// 1. Validate Request Method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, null, 'Invalid request method. POST required.');
}

// 2. Get and Validate Input
$json = file_get_contents('php://input');
$inputData = json_decode($json, true);

if (!$inputData) {
    sendResponse(false, null, 'Invalid JSON input.');
}

$text = isset($inputData['text']) ? trim($inputData['text']) : '';

// Basic Sanitization
$text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');

if (empty($text)) {
    sendResponse(false, null, 'Input text cannot be empty.');
}

// 3. AI Automation Logic - Generic Assistant
$systemPrompt = "You are a helpful AI assistant.";
$userPrompt = $text;
$action = 'generic_chat'; // Default action for logging

// 4. Call External API (OpenAI)
// 4. Call External API
$apiKey = defined('API_KEY') ? API_KEY : '';
$isMockMode = ($apiKey === 'YOUR_API_KEY_HERE' || empty($apiKey));

if ($isMockMode) {
    // ... (Keep existing mock logic, just updated variable names if needed)
    $dummyAnswers = [
        "This is a processed response from the AI simulation. I received your text: '{$text}'",
        "Here is the summary you asked for (simulated): The provided text discusses...",
        "Processed successfully! Your input was analyzed and this is the result."
    ];
    $mockResponse = $dummyAnswers[array_rand($dummyAnswers)];
    
    logRequest($action, $text, $mockResponse, 'Simulated');
    usleep(300000); 
    sendResponse(true, $mockResponse);
}

// Check provider type based on URL
$isGemini = strpos(API_URL, 'googleapis.com') !== false;

if ($isGemini) {
    // Google Gemini Payload
    $url = API_URL . '?key=' . $apiKey;
    $payload = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $systemPrompt . "\n\nUser: " . $userPrompt]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.7,
            'maxOutputTokens' => 500
        ]
    ];
    $headers = ['Content-Type: application/json'];
} else {
    // OpenAI / Groq Payload
    $url = API_URL;
    $payload = [
        'model' => defined('AI_MODEL') ? AI_MODEL : 'gpt-3.5-turbo',
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt]
        ],
        'temperature' => 0.7,
        'max_tokens' => 500
    ];
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ];
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);

curl_close($ch);

// 5. Process Response
if ($curlError) {
    logRequest($action, $text, $curlError, 'Curl Error');
    sendResponse(false, null, 'Network Error: ' . $curlError);
}

if ($httpCode !== 200) {
    $errorData = json_decode($response, true);
    $errorMsg = 'Unknown API Error';
    if ($isGemini) {
        $errorMsg = $errorData['error']['message'] ?? json_encode($errorData);
    } else {
        $errorMsg = $errorData['error']['message'] ?? 'Unknown API Error';
    }
    logRequest($action, $text, $errorMsg, 'API Error ' . $httpCode);
    sendResponse(false, null, 'AI Provider Error: ' . $errorMsg);
}

$decodedResponse = json_decode($response, true);
$aiOutput = 'No response generated.';

if ($isGemini) {
    $aiOutput = $decodedResponse['candidates'][0]['content']['parts'][0]['text'] ?? 'No response (Gemini).';
} else {
    $aiOutput = $decodedResponse['choices'][0]['message']['content'] ?? 'No response relative to OAI format.';
}

// 6. Return Output
logRequest($action, $text, $aiOutput, 'Success');
sendResponse(true, $aiOutput);
