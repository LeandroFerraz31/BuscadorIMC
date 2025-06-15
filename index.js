const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do banco de dados para Square Cloud
const dbPath = process.env.SQUARE_CLOUD 
    ? '/app/storage/employees.db' 
    : path.join(__dirname, 'employees.db');
console.log('Caminho do banco:', dbPath);

if (process.env.SQUARE_CLOUD) {
    const storageDir = '/app/storage';
    try {
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
            console.log('Diretório /app/storage criado.');
        } else {
            console.log('Diretório /app/storage já existe.');
        }
        fs.accessSync(storageDir, fs.constants.W_OK);
        console.log('Permissões de escrita em /app/storage confirmadas.');
    } catch (err) {
        console.error('Erro ao configurar /app/storage:', err.message);
        process.exit(1);
    }
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
    console.log('Conectado ao banco SQLite.');
    db.run(`
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER,
            weight REAL,
            height REAL,
            sector TEXT NOT NULL,
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
    `, (err) => {
        if (err) {
            console.error('Erro ao criar tabela:', err.message);
            process.exit(1);
        }
        console.log('Tabela employees pronta.');
    });
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para obter todos os funcionários
app.get('/api/employees', (req, res) => {
    console.log('GET /api/employees solicitado');
    db.all(`SELECT * FROM employees`, [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar funcionários:', err.message);
            res.status(500).json({ error: 'Erro ao buscar dados' });
            return;
        }
        const employees = rows.map(row => ({
            ...row,
            conditions: row.conditions ? JSON.parse(row.conditions) : [],
            familyHistory: row.familyHistory ? JSON.parse(row.familyHistory) : {}
        }));
        res.json(employees);
    });
});

// Endpoint para adicionar ou atualizar um funcionário
app.post('/api/employees', (req, res) => {
    console.log('POST /api/employees recebido:', req.body);
    const {
        name, age, weight, height, sector, branch, conditions, medication, pcd,
        smoker, drinker, fractured, fracturedPart, hospitalized,
        hospitalizationReason, lastCheckup, familyHistory, healthComplaint, id
    } = req.body;

    // Calcular IMC
    const imc = height > 0 ? (weight / (height * height)).toFixed(1) : 0;

    const conditionsJson = JSON.stringify(conditions || []);
    const familyHistoryJson = JSON.stringify(familyHistory || {});

    if (id) {
        // Atualizar funcionário existente
        const stmt = db.prepare(`
            UPDATE employees SET
                name=?, age=?, weight=?, height=?, sector=?, branch=?, conditions=?,
                medication=?, pcd=?, smoker=?, drinker=?, imc=?, fractured=?,
                fracturedPart=?, hospitalized=?, hospitalizationReason=?, lastCheckup=?,
                familyHistory=?, healthComplaint=?
            WHERE id=?
        `);
        stmt.run(
            name, age, weight, height, sector, branch, conditionsJson,
            medication, pcd, smoker, drinker, imc, fractured,
            fracturedPart, hospitalized, hospitalizationReason, lastCheckup,
            familyHistoryJson, healthComplaint, id,
            function(err) {
                if (err) {
                    console.error('Erro ao atualizar:', err.message);
                    res.status(500).json({ error: 'Erro ao atualizar funcionário' });
                    return;
                }
                console.log('Funcionário atualizado, ID:', id);
                res.json({ message: 'Funcionário atualizado com sucesso' });
            }
        );
        stmt.finalize();
    } else {
        // Inserir novo funcionário
        const stmt = db.prepare(`
            INSERT INTO employees (
                name, age, weight, height, sector, branch, conditions, medication,
                pcd, smoker, drinker, imc, fractured, fracturedPart, hospitalized,
                hospitalizationReason, lastCheckup, familyHistory, healthComplaint
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            name, age, weight, height, sector, branch, conditionsJson, medication,
            pcd, smoker, drinker, imc, fractured, fracturedPart, hospitalized,
            hospitalizationReason, lastCheckup, familyHistoryJson, healthComplaint,
            function(err) {
                if (err) {
                    console.error('Erro ao inserir:', err.message);
                    res.status(500).json({ error: 'Erro ao salvar funcionário' });
                    return;
                }
                console.log('Funcionário inserido, ID:', this.lastID);
                res.json({ message: 'Funcionário salvo com sucesso', id: this.lastID });
            }
        );
        stmt.finalize();
    }
});

// Endpoint para excluir um funcionário
app.delete('/api/employees/:id', (req, res) => {
    const { id } = req.params;
    console.log('DELETE /api/employees/', id);
    const stmt = db.prepare(`DELETE FROM employees WHERE id=?`);
    stmt.run(id, function(err) {
        if (err) {
            console.error('Erro ao excluir:', err.message);
            res.status(500).json({ error: 'Erro ao excluir funcionário' });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Funcionário não encontrado' });
            return;
        }
        console.log('Funcionário excluído, ID:', id);
        res.json({ message: 'Funcionário excluído com sucesso' });
    });
    stmt.finalize();
});

// Iniciar o servidor
const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    app.timeout = 60000; // Aumentar o timeout para 60 segundos
});
