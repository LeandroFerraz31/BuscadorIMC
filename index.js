require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const isSquareCloud = process.env.SQUARECLOUD === 'true' || 
                     process.env.HOSTNAME?.includes('squarecloud') || 
                     process.env.PORT === '80';

const PORT = process.env.PORT || (isSquareCloud ? 80 : 3000);
const HOST = isSquareCloud ? '0.0.0.0' : 'localhost';

// Configurar CORS para permitir o domínio do Square Cloud
app.use(cors({
  origin: [
    'https://buscaativadesaude.squareweb.app',
    'https://buscaativadesaude.squareweb.app/' // substitua pelo seu domínio real
  ],
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type']
}));
// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Iniciar o servidor
app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em ${HOST}:${PORT}`);
});