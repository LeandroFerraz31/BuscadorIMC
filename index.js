const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const isSquareCloud = process.env.SQUARE_CLOUD || process.env.HOSTNAME?.includes('squarecloud') || process.env.PORT === '80';
const PORT = isSquareCloud ? 80 : 3000;
const HOST = isSquareCloud ? '0.0.0.0' : 'localhost';

// Verificar o ambiente
console.log('Ambiente detectado:', isSquareCloud ? 'Square Cloud' : 'Local');
console.log('Porta:', PORT, 'Host:', HOST);

// Configurar caminho do banco de dados
const storageDir = path.join(__dirname, 'storage');
const dbPath = path.join(storageDir, 'employees.db');
console.log('Caminho do banco:', dbPath);

// Verificar permissões do diretório no Square Cloud
if (isSquareCloud) {
  try {
    // Verificar se o diretório existe
    if (!fs.existsSync(storageDir)) {
      console.error('Diretório /app/storage não existe.');
      process.exit(1);
    }

    // Verificar permissões de escrita
    const testFile = path.join(storageDir, 'test-write-permissions.txt');
    fs.writeFileSync(testFile, 'Teste de permissões', { flag: 'w' });
    console.log('Permissões de escrita confirmadas em /app/storage');
    fs.unlinkSync(testFile); // Remover o arquivo de teste
  } catch (err) {
    console.error('Erro ao verificar/acessar o diretório /app/storage:', err.message);
    process.exit(1);
  }
}

// Inicializar o banco de dados
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Erro ao abrir/criar banco:', err.message);
    process.exit(1);
  }
  console.log('Conectado ao banco SQLite em', dbPath);
});

// Função para criar a tabela
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const createTableSQL = `CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER,
      weight REAL,
      height REAL,
      sector TEXT NOT NULL,
      branch TEXT NOT NULL,
      conditions TEXT NOT NULL,
      medication TEXT,
      pcd TEXT NOT NULL,
      smoker TEXT NOT NULL,
      drinker TEXT NOT NULL,
      imc REAL,
      fractured TEXT,
      fracturedPart TEXT,
      hospitalized TEXT,
      hospitalizationReason TEXT,
      lastCheckup TEXT,
      familyHistory TEXT,
      healthComplaint TEXT
    )`;
    db.run(createTableSQL, (err) => {
      if (err) {
        console.error('Erro ao criar tabela:', err.message);
        return reject(err);
      }
      console.log('Tabela employees criada ou já existente');
      resolve();
    });
  });
}

// Função para verificar se uma coluna existe
function checkColumnExists(column) {
  return new Promise((resolve) => {
    db.all(`PRAGMA table_info(employees)`, (err, rows) => {
      if (err) {
        console.error(`Erro ao verificar colunas: ${err.message}`);
        return resolve(false);
      }
      const columnExists = rows.some(row => row.name === column);
      resolve(columnExists);
    });
  });
}

// Função para adicionar colunas, se necessário
function addColumnIfNotExists(column, type) {
  return new Promise(async (resolve, reject) => {
    const columnExists = await checkColumnExists(column);
    if (columnExists) {
      console.log(`Coluna ${column} já existe`);
      return resolve();
    }
    db.run(`ALTER TABLE employees ADD COLUMN ${column} ${type}`, (err) => {
      if (err) {
        console.error(`Erro ao adicionar coluna ${column}:`, err.message);
        reject(err);
      } else {
        console.log(`Coluna ${column} adicionada`);
        resolve();
      }
    });
  });
}

// Inicializar o banco de dados e adicionar colunas em sequência
async function setupDatabase() {
  try {
    await initializeDatabase();
    const columns = [
      { name: 'age', type: 'INTEGER' },
      { name: 'weight', type: 'REAL' },
      { name: 'height', type: 'REAL' },
      { name: 'fractured', type: 'TEXT' },
      { name: 'fracturedPart', type: 'TEXT' },
      { name: 'hospitalized', type: 'TEXT' },
      { name: 'hospitalizationReason', type: 'TEXT' },
      { name: 'lastCheckup', type: 'TEXT' },
      { name: 'familyHistory', type: 'TEXT' },
      { name: 'healthComplaint', type: 'TEXT' }
    ];
    for (const column of columns) {
      await addColumnIfNotExists(column.name, column.type);
    }
    console.log('Inicialização do banco de dados concluída');
  } catch (err) {
    console.error('Erro na inicialização do banco de dados:', err.message);
    process.exit(1);
  }
}

// Chamar a função de inicialização ao iniciar o servidor
setupDatabase();

// Configurar Express
app.use(cors({
  origin: isSquareCloud ? 'https://buscaativadesaude.squareweb.app' : 'http://localhost:3000',
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Endpoints
app.get('/api/employees', (req, res) => {
  console.log('GET /api/employees solicitado às', new Date().toISOString());
  db.all('SELECT * FROM employees', (err, rows) => {
    if (err) {
      console.error('Erro ao buscar:', err.message);
      return res.status(500).json({ error: 'Erro ao carregar funcionários' });
    }
    console.log('Funcionários encontrados:', rows.length);
    const employees = rows.map(row => ({
      ...row,
      conditions: JSON.parse(row.conditions || '[]'),
      familyHistory: JSON.parse(row.familyHistory || '{}')
    }));
    res.json(employees);
  });
});

app.post('/api/employees', (req, res) => {
  console.log('POST /api/employees recebido às', new Date().toISOString(), 'com dados:', req.body);
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

app.delete('/api/employees/:id', (req, res) => {
  console.log('DELETE /api/employees/:id solicitado às', new Date().toISOString(), 'ID:', req.params.id);
  db.run('DELETE FROM employees WHERE id = ?', req.params.id, (err) => {
    if (err) {
      console.error('Erro ao excluir:', err.message);
      return res.status(500).json({ error: 'Erro ao excluir funcionário' });
    }
    res.status(204).send();
  });
});

app.get('/', (req, res) => {
  console.log('Servindo index.html às', new Date().toISOString());
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
  db.get('SELECT 1', (err) => {
    if (err) {
      console.error('Erro no health check:', err.message);
      return res.status(500).json({ error: 'Database unavailable' });
    }
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
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

app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em ${HOST}:${PORT}`);
});