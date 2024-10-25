const express = require('express');
const cors = require('cors');
const os = require('os');

const app = express();

app.use(cors());
app.use(express.json());

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName of Object.keys(interfaces)) {
        const interface = interfaces[interfaceName];
        for (const iface of interface) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1'; // Fallback to localhost if no suitable IP is found
}

const OLLAMA_HOST = `http://${getLocalIpAddress()}:11434`;

// Add this line at the top of your file
let fetch;

// Wrap your server setup in an async function
async function setupServer() {
    // Dynamically import node-fetch
    ({ default: fetch } = await
        import ('node-fetch'));

    // Check Ollama connection
    app.get('/api/check-connection', async(req, res) => {
        try {
            const response = await fetch(`${OLLAMA_HOST}/api/tags`);
            if (response.ok) {
                const data = await response.json();
                res.json({ status: 'connected', data });
            } else {
                res.status(response.status).json({ status: 'error', message: 'Failed to connect to Ollama' });
            }
        } catch (error) {
            console.error('Error checking Ollama connection:', error);
            res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    });

    // Update the existing /api/models endpoint
    app.get('/api/models', async(req, res) => {
        try {
            const response = await fetch(`${OLLAMA_HOST}/api/tags`);
            if (response.ok) {
                const data = await response.json();
                res.json(data.models);
            } else {
                res.status(response.status).json({ error: 'Failed to fetch models' });
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Chat endpoint
    app.post('/api/chat', async(req, res) => {
        const { model, messages } = req.body;

        if (!model || !messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid request body' });
        }

        try {
            const ollamaResponse = await fetch(`${OLLAMA_HOST}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: true,
                }),
            });

            if (!ollamaResponse.ok) {
                throw new Error(`Ollama API error: ${ollamaResponse.statusText}`);
            }

            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });

            // Use ollamaResponse.body directly as a readable stream
            ollamaResponse.body.on('data', (chunk) => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.trim() !== '') {
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.message && parsed.message.content) {
                                res.write(`data: ${parsed.message.content}\n\n`);
                            } else if (parsed.error) {
                                console.error('Ollama API error:', parsed.error);
                                res.write(`data: Error: ${parsed.error}\n\n`);
                            }
                        } catch (e) {
                            console.error('Error parsing JSON:', e);
                        }
                    }
                }
            });

            ollamaResponse.body.on('end', () => {
                res.write('data: [DONE]\n\n');
                res.end();
            });

        } catch (error) {
            console.error('Server error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            } else {
                res.write(`data: Error: ${error.message}\n\n`);
                res.end();
            }
        }
    });

    // Add this new endpoint
    app.get('/api/local-ip', (req, res) => {
        const localIp = getLocalIpAddress();
        res.json({ ip: localIp });
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Proxy server running on port ${PORT}`);
    });
}

// Call the setup function
setupServer().catch(console.error);