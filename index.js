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

// CORS
app.use(cors({
  origin: ['https://buscaativadesaude.squareweb.app'],
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type']
}));

// JSON parser
app.use(express.json());

// Banco de Dados SQLite
const dbFile = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbFile);

// Cria tabela se não existir
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      age INTEGER,
      weight REAL,
      height REAL,
      sector TEXT,
      branch TEXT,
      conditions TEXT,
      medication TEXT,
      pcd TEXT,
      smoker TEXT,
      drinker TEXT,
      imc REAL,
      fractured TEXT,
      fracturedPart TEXT,
      hospitalized TEXT,
      hospitalizationReason TEXT,
      lastCheckup TEXT,
      familyHistory TEXT,
      healthComplaint TEXT
    )
  `);
});

// Rotas da API
app.get('/api/employees', (req, res) => {
  db.all('SELECT * FROM employees', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const parsed = rows.map(emp => ({
      ...emp,
      conditions: JSON.parse(emp.conditions || '[]'),
      familyHistory: JSON.parse(emp.familyHistory || '{}'),
    }));
    res.json(parsed);
  });
});

app.post('/api/employees', (req, res) => {
  const e = req.body;
  db.run(`
    INSERT INTO employees (
      name, age, weight, height, sector, branch, conditions, medication, pcd,
      smoker, drinker, imc, fractured, fracturedPart, hospitalized,
      hospitalizationReason, lastCheckup, familyHistory, healthComplaint
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      e.name, e.age, e.weight, e.height, e.sector, e.branch,
      JSON.stringify(e.conditions || []),
      e.medication, e.pcd, e.smoker, e.drinker, e.imc,
      e.fractured, e.fracturedPart, e.hospitalized,
      e.hospitalizationReason, e.lastCheckup,
      JSON.stringify(e.familyHistory || {}),
      e.healthComplaint
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.delete('/api/employees/:id', (req, res) => {
  db.run('DELETE FROM employees WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(204).send();
  });
});

// Servir frontend
app.use(express.static(path.join(__dirname, 'public')));

// Iniciar servidor
app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});
