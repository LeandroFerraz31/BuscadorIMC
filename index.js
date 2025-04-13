const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Caminho do banco com fallback
const dbPath = process.env.RENDER && fs.existsSync('/data') 
    ? '/data/employees.db' 
    : path.join(__dirname, 'employees.db');
console.log('Caminho do banco:', dbPath);

if (process.env.RENDER) {
    const dataDir = '/data';
    if (!fs.existsSync(dataDir)) {
        console.warn('Diretório /data não existe. Usando fallback:', dbPath);
    } else {
        console.log('Diretório /data existe. Verificando permissões...');
        try {
            fs.accessSync(dataDir, fs.constants.W_OK);
            console.log('Diretório /data é gravável.');
        } catch (err) {
            console.error('Erro ao verificar permissões de /data:', err.message);
        }
    }
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Erro ao abrir/criar banco:', err.message);
    } else {
        console.log('Conectado ao banco SQLite em', dbPath);
    }
});

const createTableSQL = `CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    weight REAL NOT NULL,
    height REAL NOT NULL,
    sector TEXT NOT NULL,
    branch TEXT NOT NULL,
    conditions TEXT NOT NULL,
    medication TEXT,
    pcd TEXT NOT NULL,
    smoker TEXT NOT NULL,
    drinker TEXT NOT NULL,
    imc REAL NOT NULL,
    fractured TEXT NOT NULL,
    fracturedPart TEXT,
    hospitalized TEXT NOT NULL,
    hospitalizationReason TEXT,
    lastCheckup TEXT,
    familyHistory TEXT,
    healthComplaint TEXT
)`;

db.run(createTableSQL, (err) => {
    if (err) console.error('Erro ao criar tabela:', err.message);
    else console.log('Tabela employees criada ou já existente');
});

const addColumnIfNotExists = (column, type) => {
    db.run(`ALTER TABLE employees ADD COLUMN ${column} ${type}`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error(`Erro ao adicionar coluna ${column}:`, err.message);
        } else {
            console.log(`Coluna ${column} adicionada ou já existente`);
        }
    });
};

addColumnIfNotExists('age', 'INTEGER');
addColumnIfNotExists('weight', 'REAL');
addColumnIfNotExists('height', 'REAL');
addColumnIfNotExists('fractured', 'TEXT');
addColumnIfNotExists('fracturedPart', 'TEXT');
addColumnIfNotExists('hospitalized', 'TEXT');
addColumnIfNotExists('hospitalizationReason', 'TEXT');
addColumnIfNotExists('lastCheckup', 'TEXT');
addColumnIfNotExists('familyHistory', 'TEXT');
addColumnIfNotExists('healthComplaint', 'TEXT');

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/employees', (req, res) => {
    console.log('GET /api/employees solicitado');
    db.all('SELECT * FROM employees', (err, rows) => {
        if (err) {
            console.error('Erro ao buscar:', err.message);
            return res.status(500).json({ error: 'Erro ao carregar funcionários' });
        }
        const employees = rows.map(row => ({
            ...row,
            conditions: JSON.parse(row.conditions || '[]'),
            familyHistory: JSON.parse(row.familyHistory || '{}')
        }));
        res.json(employees);
    });
});

app.post('/api/employees', (req, res) => {
    console.log('POST /api/employees recebido:', req.body);
    const {
        name, age, weight, height, sector, branch, conditions, medication, pcd,
        smoker, drinker, imc, fractured, fracturedPart, hospitalized,
        hospitalizationReason, lastCheckup, familyHistory, healthComplaint, id
    } = req.body;

    const stmt = id
        ? db.prepare(`UPDATE employees SET name=?, age=?, weight=?, height=?, sector=?, branch=?, conditions=?, medication=?, pcd=?, smoker=?, drinker=?, imc=?, fractured=?, fracturedPart=?, hospitalized=?, hospitalizationReason=?, lastCheckup=?, familyHistory=?, healthComplaint=? WHERE id=?`)
        : db.prepare(`INSERT INTO employees (name, age, weight, height, sector, branch, conditions, medication, pcd, smoker, drinker, imc, fractured, fracturedPart, hospitalized, hospitalizationReason, lastCheckup, familyHistory, healthComplaint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const params = id
        ? [name, age, weight, height, sector, branch, JSON.stringify(conditions), medication, pcd, smoker, drinker, imc, fractured, fracturedPart, hospitalized, hospitalizationReason, lastCheckup, JSON.stringify(familyHistory), healthComplaint, id]
        : [name, age, weight, height, sector, branch, JSON.stringify(conditions), medication, pcd, smoker, drinker, imc, fractured, fracturedPart, hospitalized, hospitalizationReason, lastCheckup, JSON.stringify(familyHistory), healthComplaint];

    stmt.run(params, function(err) {
        if (err) {
            console.error('Erro ao salvar:', err.message);
            return res.status(500).json({ error: 'Erro ao salvar funcionário' });
        }
        res.status(id ? 200 : 201).json({ id: this.lastID || id });
    });
    stmt.finalize();
});

// Novo endpoint para webhook do n8n
app.post('/api/webhook/n8n', (req, res) => {
    console.log('Webhook do n8n recebido:', req.body);
    // Processar dados do n8n (ex.: inserir funcionário)
    const { name, age, weight, height, sector, branch, conditions } = req.body;
    if (name && sector && branch) {
        db.run(
            `INSERT INTO employees (name, age, weight, height, sector, branch, conditions, pcd, smoker, drinker, imc) VALUES (?, ?, ?, ?, ?, ?, ?, 'Não', 'Não', 'Não', 0)`,
            [name, age || 30, weight || 70, height || 1.7, sector, branch, JSON.stringify(conditions || [])],
            function(err) {
                if (err) {
                    console.error('Erro ao processar webhook:', err.message);
                    return res.status(500).json({ error: 'Erro ao processar webhook' });
                }
                console.log('Funcionário adicionado via n8n:', { id: this.lastID });
                res.status(201).json({ id: this.lastID });
            }
        );
    } else {
        res.status(400).json({ error: 'Dados inválidos no webhook' });
    }
});

app.delete('/api/employees/:id', (req, res) => {
    console.log('DELETE /api/employees/:id solicitado, ID:', req.params.id);
    db.run('DELETE FROM employees WHERE id = ?', req.params.id, (err) => {
        if (err) {
            console.error('Erro ao excluir:', err.message);
            return res.status(500).json({ error: 'Erro ao excluir funcionário' });
        }
        res.status(204).send();
    });
});

app.get('/', (req, res) => {
    console.log('Servindo index.html');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

process.on('SIGTERM', () => {
    db.close(() => {
        console.log('Banco de dados fechado');
        process.exit(0);
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});