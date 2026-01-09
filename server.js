import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Verification: Check if dist folder exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    console.log('✅ Dist folder found at:', distPath);
    const files = fs.readdirSync(distPath);
    console.log('📦 Files in dist:', files);
} else {
    console.warn('❌ Dist folder NOT found at:', distPath);
}

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Database Connection
const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// Set up Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// --- Encryption Helpers ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 chars
const ALGORITHM = 'aes-256-cbc';

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}

function decrypt(text, iv) {
    const ivBuffer = Buffer.from(iv, 'hex');
    const encryptedText = Buffer.from(text, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), ivBuffer);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// --- Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden: Invalid token' });
        req.user = user;
        next();
    });
};

// --- Auth Routes ---

app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        console.log(`[Auth] Attempting registration for: ${email}`);
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
            [email, hashedPassword]
        );
        console.log(`[Auth] Registration successful for: ${email}`);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Auth Error] Registration failed:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: `Registration failed: ${err.message}` });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        console.log(`[Auth] Attempting login for: ${email}`);
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'User not found' });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, email: user.email, hasKey: !!user.encrypted_gemini_key });
    } catch (err) {
        console.error('[Auth Error] Login internal error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/user/key', authenticateToken, async (req, res) => {
    const { geminiKey } = req.body;
    try {
        const { iv, encryptedData } = encrypt(geminiKey);
        await pool.query(
            'UPDATE users SET encrypted_gemini_key = $1, encryption_iv = $2 WHERE id = $3',
            [encryptedData, iv, req.user.id]
        );
        res.json({ message: 'API Key updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update API key' });
    }
});

app.get('/api/user/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT email, encrypted_gemini_key FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        res.json({ email: user.email, hasKey: !!user.encrypted_gemini_key });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// --- Gemini AI Helper ---
async function getGeminiModel(userId) {
    const result = await pool.query('SELECT encrypted_gemini_key, encryption_iv FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    if (!user || !user.encrypted_gemini_key) {
        throw new Error('Please add your Gemini API Key in settings.');
    }

    const decryptedKey = decrypt(user.encrypted_gemini_key, user.encryption_iv);
    const genAI = new GoogleGenerativeAI(decryptedKey);
    // Use gemini-flash-latest for stability
    return genAI.getGenerativeModel({ model: "gemini-flash-latest" });
}

/**
 * Helper: Convert Buffer to GenerativePart for Gemini
 */
function fileToGenerativePart(buffer, mimeType) {
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType
        },
    };
}

// --- AI Proxy Routes ---

app.post('/api/analyze', authenticateToken, upload.single('image'), async (req, res) => {
    console.log(`--- Image Analysis Request from User ${req.user.id} ---`);
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

        const model = await getGeminiModel(req.user.id);
        const imagePart = fileToGenerativePart(req.file.buffer, req.file.mimetype);

        const prompt = `
            Analyze this travel photo and provide a structured JSON-like response with exactly these fields:
            - subject: A concise description of the main focus (e.g., "Eiffel Tower", "plate of sushi", "misty jungle")
            - sentiment: One word for the mood (e.g., Peaceful, Energetic, Nostalgic, Vibrant)
            - lighting: A brief description of the light (e.g., Golden Hour, Overcast, Neon, Bright Sunlight)
            - labels: An array of 5 keywords/tags about the content.
            - safety: Return "safe" if the image is family-friendly, or "unsafe" otherwise.

            Format: return ONLY the JSON object.
        `;

        console.log('Calling Gemini for user...');
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text().trim();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Gemini failed to return structured analysis.');

        const analysis = JSON.parse(jsonMatch[0]);

        if (analysis.safety === 'unsafe') {
            return res.json({ safe: false, reason: "Inappropriate content detected." });
        }

        const metadata = {
            subject: analysis.subject,
            sentiment: analysis.sentiment,
            lighting: analysis.lighting,
            labels: analysis.labels,
            dominantColor: '#4f46e5'
        };

        res.json({ safe: true, metadata });
    } catch (error) {
        console.error('Analysis Error:', error.message);
        res.status(error.message.includes('API Key') ? 400 : 500).json({ error: error.message });
    }
});

app.post('/api/generate', authenticateToken, async (req, res) => {
    console.log(`--- Story Generation Request from User ${req.user.id} ---`);
    try {
        const { metadata, tone, previousContext, index } = req.body;
        if (!metadata) return res.status(400).json({ error: 'No metadata provided' });

        const model = await getGeminiModel(req.user.id);

        const prompt = `
            You are a creative storyteller and travel enthusiast. Write a deeply personal, relatable, and evocative travel journal entry (2-3 sentences) based on this photo metadata:
            - Focus: ${metadata.subject}
            - Mood/Atmosphere: ${metadata.sentiment}
            - Lighting: ${metadata.lighting}
            - Key Elements: ${(metadata.labels || []).join(', ')}
            - Desired Tone: ${tone}
            - Journey so far: ${previousContext || "The journey begins."}

            Guidelines:
            1. Write in the FIRST PERSON ("I" or "We").
            2. Do NOT just list the elements. Instead, weave the lighting and mood into a natural experience (e.g., instead of "The lighting is golden," say "The afternoon sun cast a warm, honey-like glow over...").
            3. Connect this moment to the "Journey so far" to ensure a cohesive story.
            4. Focus on the EMOTION and the SENSES (what it felt like to be there).
            
            Return ONLY the narrative text.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ segment: response.text().trim() });
    } catch (error) {
        console.error('Generation Error:', error.message);
        res.status(error.message.includes('API Key') ? 400 : 500).json({ error: error.message });
    }
});

// --- Middleware: Global Request Logger ---
app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
        console.log(`[Request] ${req.method} ${req.path}`);
    }
    next();
});

// --- Serve Static Frontend (Production Only) ---
console.log('Enabling static file serving from:', distPath);
app.use(express.static(distPath));

// Final catch-all: Serve index.html for navigation
app.use((req, res) => {
    // Only handle GET requests for navigation
    if (req.method !== 'GET') return res.status(404).end();

    // If it is an API request that wasn't handled, return 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }

    // IMPORTANT: If the request looks like a file (has an extension) 
    // and we reached this fallback, it means express.static MISSED it.
    // Do NOT serve index.html for missing assets!
    if (req.path.includes('.') && !req.path.endsWith('.html')) {
        console.warn(`[Static Missing] 404 for asset: ${req.path}`);
        return res.status(404).end();
    }

    // Otherwise, serve the frontend app (index.html)
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend build not found (index.html missing)');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
