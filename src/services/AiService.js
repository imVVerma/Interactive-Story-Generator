/**
 * REAL AI SERVICE (Multi-User & BYOK Support)
 * Communicates with the proxy server for Auth, Settings, and AI generation.
 */

import { createClient } from '@supabase/supabase-js';

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api';

// Initialize Supabase Client
const SUPABASE_URL = 'https://geueapflyepyuxfluhrx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdldWVhcGZseWVweXV4Zmx1aHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTcwMzEsImV4cCI6MjA4MzM3MzAzMX0.DbenDkizSQ_1XnEJWTibmKVNVQ-bv4xsuoD7kt9XYMg';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Google OAuth: Sign In
 */
export const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
            queryParams: {
                prompt: 'select_account', // This forces Google to show the account picker
                access_type: 'offline'
            }
        }
    });
    if (error) throw error;
    return data;
};

/**
 * Google OAuth: Sign Out
 */
export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

/**
 * Sync Google User with Backend
 */
export const syncGoogleUser = async (email) => {
    const response = await fetch(`${API_BASE_URL}/auth/google-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sync Google user');
    }
    return await response.json();
};

/**
 * Auth: Register a new user
 */
export const registerUser = async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Registration failed');
    }
    return await response.json();
};

/**
 * Auth: Login
 */
export const loginUser = async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
    }
    return await response.json();
};

/**
 * User: Save Gemini API Key
 */
export const saveUserKey = async (token, geminiKey) => {
    const response = await fetch(`${API_BASE_URL}/user/key`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ geminiKey }),
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save API key');
    }
    return await response.json();
};

/**
 * User: Get Profile Info
 */
export const getUserInfo = async (token) => {
    const response = await fetch(`${API_BASE_URL}/user/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch user profile');
    }
    return await response.json();
};

/**
 * AI: Analyze Image (Authenticated)
 */
export const analyzeImageSafety = async (file, token) => {
    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Analysis failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Frontend AI Error (Analyze):', error);
        return {
            safe: false,
            reason: error.message.includes('Failed to fetch')
                ? "Backend server is not running or unreachable."
                : error.message
        };
    }
};

/**
 * AI: Generate Story Segment (Authenticated)
 */
export const generateStorySegment = async (imageMetadata, tone, previousContext, index, token) => {
    try {
        const response = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                metadata: imageMetadata,
                tone,
                previousContext,
                index
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Story generation failed');
        }

        const data = await response.json();
        return data.segment;
    } catch (error) {
        console.error('Frontend AI Error (Generate):', error);
        return `[Story Generation Error: ${error.message}] Our journey continued through ${imageMetadata.subject}, but the words failed us for a moment.`;
    }
};
