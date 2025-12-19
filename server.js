require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 8000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// MongoDB Configuration
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;
let db;

// Connect to MongoDB
async function connectDB() {
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log("Connected to MongoDB successfully");
    } catch (err) {
        console.error("MongoDB Connection Error:", err);
    }
}
connectDB();

// Mime types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    // Enable CORS just in case
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- API: CHAT (AI PROXY) ---
    if (req.url === '/api.php' && req.method === 'POST') {
        handleChatRequest(req, res);
        return;
    }

    // --- API: SAVE USER (GOOGLE AUTH) ---
    if (req.url === '/api/save-user' && req.method === 'POST') {
        handleSaveUser(req, res);
        return;
    }

    // --- API: SAVE CHAT ---
    if (req.url === '/api/save-chat' && req.method === 'POST') {
        handleSaveChat(req, res);
        return;
    }

    // --- API: GET HISTORY ---
    if (req.url === '/api/get-history' && req.method === 'POST') {
        handleGetHistory(req, res);
        return;
    }

    // --- API: GET CHAT DETAILS ---
    if (req.url === '/api/get-chat' && req.method === 'POST') {
        handleGetChat(req, res);
        return;
    }

    // Serve Static Files
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 File Not Found');
            } else {
                res.writeHead(500);
                res.end('500 Internal Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// --- API HANDLERS ---

function handleSaveUser(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            if (!db) {
                sendJson(res, 503, { success: false, message: 'Database not connected' });
                return;
            }
            const userData = JSON.parse(body);
            const usersCollection = db.collection('users');

            // Upsert user based on email (or sub ID)
            const result = await usersCollection.updateOne(
                { email: userData.email },
                { $set: userData },
                { upsert: true }
            );

            console.log(`User stored: ${userData.email}`);
            sendJson(res, 200, { success: true, message: 'User saved', result });
        } catch (e) {
            console.error("Save User Error:", e);
            sendJson(res, 500, { success: false, message: 'Server Error' });
        }
    });
}



function handleSaveChat(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            if (!db) {
                sendJson(res, 503, { success: false, message: 'Database not connected' });
                return;
            }
            const chatData = JSON.parse(body);
            const chatsCollection = db.collection('chats');

            // Validate required fields
            if (!chatData.id || !chatData.userId) {
                sendJson(res, 400, { success: false, message: 'Missing chat ID or User ID' });
                return;
            }

            // Upsert chat
            const result = await chatsCollection.updateOne(
                { id: chatData.id },
                { $set: chatData },
                { upsert: true }
            );

            console.log(`Chat saved: ${chatData.id}`);
            sendJson(res, 200, { success: true, message: 'Chat saved', result });
        } catch (e) {
            console.error("Save Chat Error:", e);
            sendJson(res, 500, { success: false, message: 'Server Error' });
        }
    });
}

function handleGetHistory(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            if (!db) {
                sendJson(res, 503, { success: false, message: 'Database not connected' });
                return;
            }
            const { userId } = JSON.parse(body);
            const chatsCollection = db.collection('chats');

            // Get all chats for user, sort by timestamp desc
            const history = await chatsCollection
                .find({ userId: userId })
                .project({ id: 1, title: 1, timestamp: 1 }) // Only get summary fields
                .sort({ timestamp: -1 })
                .toArray();

            sendJson(res, 200, { success: true, history });
        } catch (e) {
            console.error("Get History Error:", e);
            sendJson(res, 500, { success: false, message: 'Server Error' });
        }
    });
}

function handleGetChat(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            if (!db) {
                sendJson(res, 503, { success: false, message: 'Database not connected' });
                return;
            }
            const { chatId, userId } = JSON.parse(body);
            const chatsCollection = db.collection('chats');

            // Get specific chat, verify user ownership
            const chat = await chatsCollection.findOne({ id: chatId, userId: userId });

            if (chat) {
                sendJson(res, 200, { success: true, chat });
            } else {
                sendJson(res, 404, { success: false, message: 'Chat not found' });
            }
        } catch (e) {
            console.error("Get Chat Error:", e);
            sendJson(res, 500, { success: false, message: 'Server Error' });
        }
    });
}

function handleChatRequest(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const inputData = JSON.parse(body);
            const text = (inputData.text || '').trim();

            if (!text) {
                sendJson(res, 400, { success: false, message: 'Input text cannot be empty.' });
                return;
            }

            // Agent now represents the Model ID from the UI
            const agentModel = inputData.agent || 'nex-agi/deepseek-v3.1-nex-n1:free';
            const action = inputData.action || 'generic_chat';

            // Construct System Instruction based on Action
            let systemInstruction = "You are a helpful AI assistant.";
            if (action === 'summarize') systemInstruction += " Your task is to provide a concise summary of the user's input.";
            else if (action === 'bullet_points') systemInstruction += " Your task is to extract key points from the input and present them as a bulleted list.";
            else if (action === 'draft_reply') systemInstruction += " Your task is to draft a professional reply based on the context provided.";

            // Helper - detect provider
            const isGemini = agentModel.includes('gemini');
            const isDeepSeek = agentModel.includes('deepseek');
            // Heuristic: If it has '/', 'free', or 'openrouter', assume OpenRouter for now.
            const isOpenRouter = agentModel.includes(':free') || agentModel.includes('openrouter') || agentModel.includes('/');

            let options, payload;

            if (isGemini) {
                // --- GOOGLE GEMINI CONFIGURATION ---
                payload = JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `${systemInstruction}\n\nUser Question: ${text}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024
                    }
                });

                options = {
                    hostname: 'generativelanguage.googleapis.com',
                    path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload)
                    }
                };

            } else if (isOpenRouter) {
                // --- OPENROUTER CONFIGURATION ---
                payload = JSON.stringify({
                    model: agentModel,
                    messages: [
                        { role: 'system', content: systemInstruction },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.7
                });

                options = {
                    hostname: 'openrouter.ai',
                    path: '/api/v1/chat/completions',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'HTTP-Referer': 'http://localhost:8000',
                        'X-Title': 'Dinzin AI Local',
                        'Content-Length': Buffer.byteLength(payload)
                    }
                };

            } else if (isDeepSeek) {
                // --- DEEPSEEK CONFIGURATION ---
                payload = JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: systemInstruction },
                        { role: 'user', content: text }
                    ],
                    temperature: 1.3
                });

                options = {
                    hostname: 'api.deepseek.com',
                    path: '/chat/completions',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                        'Content-Length': Buffer.byteLength(payload)
                    }
                };

            } else {
                // --- GROQ (LLAMA) CONFIGURATION (Default Fallback) ---
                payload = JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: systemInstruction },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.7,
                    max_tokens: 1024
                });

                options = {
                    hostname: 'api.groq.com',
                    path: '/openai/v1/chat/completions',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${GROQ_API_KEY}`,
                        'Content-Length': Buffer.byteLength(payload)
                    }
                };
            }

            const apiReq = https.request(options, (apiRes) => {
                let apiBody = '';
                apiRes.on('data', (chunk) => apiBody += chunk);
                apiRes.on('end', () => {
                    if (apiRes.statusCode !== 200) {
                        let provider = 'Groq';
                        if (isGemini) provider = 'Gemini';
                        if (isOpenRouter) provider = 'OpenRouter';
                        if (isDeepSeek) provider = 'DeepSeek';

                        console.error(`${provider} API Error:`, apiBody);
                        sendJson(res, 500, { success: false, message: `${provider} API Error: ` + apiBody });
                        return;
                    }

                    try {
                        const data = JSON.parse(apiBody);
                        let aiOutput = "No response generated.";

                        if (isGemini) {
                            aiOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini.";
                        } else {
                            aiOutput = data.choices?.[0]?.message?.content || "No response generated.";
                        }

                        sendJson(res, 200, {
                            success: true,
                            data: aiOutput,
                            message: 'Success',
                            timestamp: new Date().toISOString()
                        });
                    } catch (e) {
                        console.error('Parse Error:', e);
                        sendJson(res, 500, { success: false, message: 'Error parsing AI response' });
                    }
                });
            });

            apiReq.on('error', (e) => {
                console.error('Request Error:', e);
                sendJson(res, 500, { success: false, message: 'Network error calling AI provider' });
            });

            apiReq.write(payload);
            apiReq.end();

        } catch (err) {
            console.error(err);
            sendJson(res, 400, { success: false, message: 'Invalid JSON input or server error.' });
        }
    });
}

function sendJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

server.listen(PORT, () => {
    console.log(`Node.js Server running at http://localhost:${PORT}/`);
    console.log('Serving PHP compatible endpoint at /api.php');
});
