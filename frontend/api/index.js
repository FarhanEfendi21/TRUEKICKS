// File: frontend/api/index.js

import express from 'express';
import serverless from 'serverless-http'; // Helper untuk Serverless
import cors from 'cors';
import dotenv from 'dotenv';
// PENTING: Sesuaikan path ini jika supabase.js Anda ada di lokasi lain!
import supabase from '../backend/config/supabase.js'; 

dotenv.config();

// Definisikan seluruh aplikasi Express Anda
const app = express();
app.use(cors());
app.use(express.json());

// === 1. ROUTE TEST (Test Vercel) ===
app.get('/api', (req, res) => {
    // Note: Vercel otomatis memetakan folder /api ke /api. 
    // Endpoint ini diakses via /api
    res.send('Vercel Serverless API Running! 🚀');
});

// === ROUTE PRODUK & LAYANAN (Salin semua route GET & POST di bawah ini) ===

// ROUTE 2: GET SNEAKERS
app.get('/api/sneakers', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('sneakers')
            .select('*, categories(name), sales(discount_percent, active)') 
            .order('id', { ascending: true });
        
        if (error) throw error;
        // Kita langsung return data mentah (raw) di sini,
        // Tapi pastikan semua helper fungsi seperti formatProductWithSale
        // sudah disalin ke file utilitas yang bisa diakses oleh fungsi ini.
        // Untuk penyelesaian cepat, kita return data mentah dulu.
        res.json(data); 
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ROUTE 3: POST LOGIN
app.post('/api/login', async (req, res) => {
    // ... salin logika login dari index.js lama Anda
    res.status(400).json({ message: "Login logic needs to be here." }); 
});

// ROUTE 4: POST ORDERS
app.post('/api/orders', async (req, res) => {
    // ... salin logika order/checkout dari index.js lama Anda
    res.status(400).json({ message: "Order logic needs to be here." });
});

// ROUTE 5: ROUTE DETAIL PRODUK
app.get('/api/detail/:table/:id', async (req, res) => {
    // ... salin logika detail produk dari index.js lama Anda
    res.status(400).json({ message: "Detail route logic needs to be here." });
});

// ROUTE 6: ROUTE CATEGORIES
app.get('/api/categories', async (req, res) => {
    // ... salin logika categories dari index.js lama Anda
    res.status(400).json({ message: "Categories logic needs to be here." });
});


// === Export Aplikasi Express sebagai Serverless Function ===
// serverless(app) adalah yang mengubah Express menjadi format Vercel Function
export default serverless(app);