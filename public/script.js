const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:80'
    : '';

console.log('Hostname:', window.location.hostname);
console.log('API_BASE_URL definido como:', API_BASE_URL);

let employeesData = [];
let filteredData = [];

const dataTable = document.getElementById('dataTable');
const addDataBtn = document.getElementById('addDataBtn');
const exportBtn = document.getElementById('exportBtn');
const modal = document.getElementById('dataModal');
const deleteModal = document.getElementById('deleteModal');
const closeBtn = document.querySelector('.close');
const employeeForm = document.getElementById('employeeForm');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const employeeFilter = document.getElementById('employeeFilter');
const branchFilter = document.getElementById('branchFilter');
let currentDeleteId = null;

// Função para calcular o IMC
const calculateIMC = () => {
    const weight = parseFloat(document.getElementById('weight').value) || 0;
    const height = parseFloat(document.getElementById('height').value) || 0;
    const imc = height > 0 ? (weight / (height * height)).toFixed(1) : 0;
    document.getElementById('imc').value = imc;
};

// Adicionar listeners para peso e altura
document.getElementById('weight').addEventListener('input', calculateIMC);
document.getElementById('height').addEventListener('input', calculateIMC);

async function fetchEmployees() {
    try {
        const url = `${API_BASE_URL}/api/employees`;
        console.log('Buscando funcionários em', url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`);
        employeesData = await response.json();
        filteredData = [...employeesData];
        console.log('Funcionários carregados:', employeesData);
        renderTable();
        renderSummaryCards();
        renderCharts();
        populateEmployeeSuggestions();
        populateBranchFilter();
    } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
        alert('Não foi possível carregar os dados. Certifique-se de que o servidor está rodando.');
    }
}

const countIndicators = () => {
    const counts = {
        HAS: 0, DM: 0, Cardíaco: 0, Asmático: 0, CA: 0, Ansiedade: 0, Renal: 0, Depressão: 0, Trombose: 0,
        Hérnia: 0, Epilepsia: 0, Tendinite: 0, Psiquiátrico: 0,
        medication: 0, smoker: 0, drinker: 0, pcd: 0,
        imcBelow18: 0, imc18to24: 0, imc24to29: 0, imc29to34: 0, imc34to39: 0, imcAbove39: 0
    };

    filteredData.forEach(employee => {
        employee.conditions.forEach(condition => {
            if (counts.hasOwnProperty(condition)) counts[condition]++;
        });
        if (employee.medication && employee.medication.trim() !== "") counts.medication++;
        if (employee.smoker === "Sim") counts.smoker++;
        if (employee.drinker === "Sim") counts.drinker++;
        if (employee.pcd.startsWith("Sim")) counts.pcd++;
        const imc = parseFloat(employee.imc);
        if (imc < 18) counts.imcBelow18++;
        else if (imc >= 18 && imc < 24) counts.imc18to24++;
        else if (imc >= 24 && imc < 29) counts.imc24to29++;
        else if (imc >= 29 && imc < 34) counts.imc29to34++;
        else if (imc >= 34 && imc < 39) counts.imc34to39++;
        else if (imc >= 39) counts.imcAbove39++;
    });

    return counts;
};

const renderTable = () => {
    console.log('Renderizando tabela com dados:', filteredData);
    const tbody = dataTable.querySelector('tbody');
    tbody.innerHTML = '';

    filteredData.forEach((employee, index) => {
        const familyHistoryStr = Object.entries(employee.familyHistory || {})
            .filter(([condition, who]) => Array.isArray(who) && who.length > 0)
            .map(([condition, who]) => `${condition}: ${who.join(', ')}`)
            .join('; ');
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${employee.name}</td>
            <td>${employee.age || 'N/A'}</td>
            <td>${employee.weight || 'N/A'}</td>
            <td>${employee.height || 'N/A'}</td>
            <td>${employee.sector}</td>
            <td>${employee.branch || 'N/A'}</td>
            <td>${employee.conditions.join(', ')}</td>
            <td>${employee.medication || 'Nenhuma'}</td>
            <td>${employee.pcd}</td>
            <td>${employee.smoker}</td>
            <td>${employee.drinker}</td>
            <td>${employee.imc}</td>
            <td>${employee.fractured}</td>
            <td>${employee.fracturedPart || 'N/A'}</td>
            <td>${employee.hospitalized}</td>
            <td>${employee.hospitalizationReason || 'N/A'}</td>
            <td>${employee.lastCheckup || 'N/A'}</td>
            <td>${familyHistoryStr || 'Nenhum'}</td>
            <td>${employee.healthComplaint || 'Nenhuma'}</td>
            <td>
                <button class="action-btn edit-btn" data-index="${index}">Editar</button>
                <button class="action-btn delete-btn" data-index="${index}">Excluir</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            editEmployee(this.getAttribute('data-index'));
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            showDeleteConfirmation(this.getAttribute('data-index'));
        });
    });
};

const renderSummaryCards = () => {
    document.getElementById('totalEmployees').querySelector('.number').textContent = filteredData.length;
    const counts = countIndicators();
    document.getElementById('medicationUsers').querySelector('.number').textContent = counts.medication;
    document.getElementById('pcdCount').querySelector('.number').textContent = counts.pcd;
};

const renderHealthConditionsChart = () => {
    const counts = countIndicators();
    const chart = document.getElementById('healthConditionsChart');
    chart.innerHTML = '';
    const selectedFilters = Array.from(document.getElementById('healthConditionsFilter').selectedOptions).map(option => option.value);
    
    const allConditions = [
        { key: 'HAS', label: 'Hipertensão' },
        { key: 'DM', label: 'Diabetes' },
        { key: 'Cardíaco', label: 'Cardíaco' },
        { key: 'Asmático', label: 'Asmático' },
        { key: 'CA', label: 'Câncer' },
        { key: 'Ansiedade', label: 'Ansiedade' },
        { key: 'Renal', label: 'Renal' },
        { key: 'Depressão', label: 'Depressão' },
        { key: 'Trombose', label: 'Trombose' },
        { key: 'Hérnia', label: 'Hérnia' },
        { key: 'Epilepsia', label: 'Epilepsia' },
        { key: 'Tendinite', label: 'Tendinite' },
        { key: 'Psiquiátrico', label: 'Psiquiátrico' }
    ];

    const conditions = selectedFilters.includes('all') ? allConditions : allConditions.filter(condition => selectedFilters.includes(condition.key));

    if (conditions.length === 0) {
        chart.textContent = 'Selecione pelo menos uma condição para exibir o gráfico.';
        return;
    }

    const maxValue = Math.max(...conditions.map(c => counts[c.key]), 1);
    const chartHeight = chart.clientHeight - 40;
    const barContainer = document.createElement('div');
    barContainer.style.cssText = 'display: flex; height: 100%; align-items: flex-end; justify-content: space-around;';
    
    conditions.forEach(condition => {
        const value = counts[condition.key];
        const height = maxValue > 0 ? (value / maxValue) * chartHeight : 0;
        const barWrapper = document.createElement('div');
        barWrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; flex-grow: 1;';
        const bar = document.createElement('div');
        bar.className = 'bar health-condition';
        bar.style.cssText = `width: 80%; height: ${height}px;`;
        bar.textContent = value;
        const label = document.createElement('div');
        label.style.cssText = 'margin-top: 8px; text-align: center; font-size: 0.75rem; word-wrap: break-word; width: 100%;';
        label.textContent = condition.label;
        barWrapper.appendChild(bar);
        barWrapper.appendChild(label);
        barContainer.appendChild(barWrapper);
    });
    
    chart.appendChild(barContainer);
};

const renderImcChart = () => {
    const counts = countIndicators();
    const chart = document.getElementById('imcChart');
    chart.innerHTML = '';
    const selectedFilters = Array.from(document.getElementById('imcFilter').selectedOptions).map(option => option.value);
    
    const allImcCategories = [
        { key: 'imcBelow18', label: 'Abaixo de 18' },
        { key: 'imc18to24', label: '18-24' },
        { key: 'imc24to29', label: '24-29' },
        { key: 'imc29to34', label: '29-34' },
        { key: 'imc34to39', label: '34-39' },
        { key: 'imcAbove39', label: 'Acima de 39' }
    ];

    const imcCategories = selectedFilters.includes('all') ? allImcCategories : allImcCategories.filter(category => selectedFilters.includes(category.key));

    if (imcCategories.length === 0) {
        chart.textContent = 'Selecione pelo menos uma categoria para exibir o gráfico.';
        return;
    }

    const maxValue = Math.max(...imcCategories.map(c => counts[c.key]), 1);
    const chartHeight = chart.clientHeight - 40;
    const barContainer = document.createElement('div');
    barContainer.style.cssText = 'display: flex; height: 100%; align-items: flex-end; justify-content: space-around;';
    
    imcCategories.forEach(category => {
        const value = counts[category.key];
        const height = maxValue > 0 ? (value / maxValue) * chartHeight : 0;
        const barWrapper = document.createElement('div');
        barWrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; flex-grow: 1;';
        const bar = document.createElement('div');
        bar.className = 'bar imc-category';
        bar.style.cssText = `width: 80%; height: ${height}px;`;
        bar.textContent = value;
        const label = document.createElement('div');
        label.style.cssText = 'margin-top: 8px; text-align: center; font-size: 0.75rem;';
        label.textContent = category.label;
        barWrapper.appendChild(bar);
        barWrapper.appendChild(label);
        barContainer.appendChild(barWrapper);
    });
    
    chart.appendChild(barContainer);
};

const renderHabitsChart = () => {
    const counts = countIndicators();
    const chart = document.getElementById('habitsChart');
    chart.innerHTML = '';
    const selectedFilters = Array.from(document.getElementById('habitsFilter').selectedOptions).map(option => option.value);
    
    const allHabits = [
        { key: 'smoker', label: 'Fumantes' },
        { key: 'drinker', label: 'Etilistas' },
        { key: 'medication', label: 'Medicação' }
    ];

    const habits = selectedFilters.includes('all') ? allHabits : allHabits.filter(habit => selectedFilters.includes(habit.key));

    if (habits.length === 0) {
        chart.textContent = 'Selecione pelo menos um hábito para exibir o gráfico.';
        return;
    }

    const maxValue = Math.max(...habits.map(h => counts[h.key]), 1);
    const chartHeight = chart.clientHeight - 40;
    const barContainer = document.createElement('div');
    barContainer.style.cssText = 'display: flex; height: 100%; align-items: flex-end; justify-content: space-around;';
    
    habits.forEach(habit => {
        const value = counts[habit.key];
        const height = maxValue > 0 ? (value / maxValue) * chartHeight : 0;
        const barWrapper = document.createElement('div');
        barWrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; flex-grow: 1;';
        const bar = document.createElement('div');
        bar.className = 'bar habits';
        bar.style.cssText = `width: 80%; height: ${height}px;`;
        bar.textContent = value;
        const label = document.createElement('div');
        label.style.cssText = 'margin-top: 8px; text-align: center; font-size: 0.75rem;';
        label.textContent = habit.label;
        barWrapper.appendChild(bar);
        barWrapper.appendChild(label);
        barContainer.appendChild(barWrapper);
    });
    
    chart.appendChild(barContainer);
};

const renderCharts = () => {
    console.log('Renderizando gráficos');
    renderHealthConditionsChart();
    renderImcChart();
    renderHabitsChart();
};

const populateEmployeeSuggestions = () => {
    const datalist = document.getElementById('employeeSuggestions');
    datalist.innerHTML = '<option value="all">Todos os Funcionários</option>';

    employeesData.forEach(employee => {
        const option = document.createElement('option');
        option.value = employee.name;
        option.textContent = employee.name;
        datalist.appendChild(option);
    });
};

const populateBranchFilter = () => {
    const branchFilter = document.getElementById('branchFilter');
    branchFilter.innerHTML = '<option value="all">Todas as Unidades</option>';

    const uniqueBranches = [...new Set(employeesData.map(employee => employee.branch).filter(Boolean))];
    uniqueBranches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch;
        option.textContent = branch;
        branchFilter.appendChild(option);
    });
};

const editEmployee = (index) => {
    console.log('Editando funcionário no índice:', index);
    const employee = filteredData[index];
    document.getElementById('name').value = employee.name;
    document.getElementById('age').value = employee.age || '';
    document.getElementById('weight').value = employee.weight || '';
    document.getElementById('height').value = employee.height || '';
    document.getElementById('sector').value = employee.sector;
    document.getElementById('branch').value = employee.branch || '';
    document.querySelectorAll('input[name="condition"]').forEach(checkbox => checkbox.checked = false);
    employee.conditions.forEach(condition => {
        const checkbox = document.querySelector(`input[name="condition"][value="${condition}"]`);
        if (checkbox) checkbox.checked = true;
    });
    document.getElementById('medication').value = employee.medication || '';
    document.getElementById('pcd').value = employee.pcd;
    document.querySelectorAll('input[name="smoker"]').forEach(radio => radio.checked = radio.value === employee.smoker);
    document.querySelectorAll('input[name="drinker"]').forEach(radio => radio.checked = radio.value === employee.drinker);
    document.getElementById('imc').value = employee.imc;
    document.querySelectorAll('input[name="fractured"]').forEach(radio => radio.checked = radio.value === employee.fractured);
    document.getElementById('fracturedPart').value = employee.fracturedPart || '';
    document.querySelectorAll('input[name="hospitalized"]').forEach(radio => radio.checked = radio.value === employee.hospitalized);
    document.getElementById('hospitalizationReason').value = employee.hospitalizationReason || '';
    document.getElementById('lastCheckup').value = employee.lastCheckup || '';
    // Limpar todas as caixas de seleção de histórico familiar
    document.querySelectorAll('input[name="familyHistory"]').forEach(checkbox => checkbox.checked = false);
    document.querySelectorAll('input[name^="family"][name$="Who"]').forEach(checkbox => checkbox.checked = false);
    // Preencher caixas de seleção de histórico familiar
    console.log('Dados de familyHistory:', employee.familyHistory); // Log para depuração
    if (employee.familyHistory && typeof employee.familyHistory === 'object') {
        Object.entries(employee.familyHistory).forEach(([condition, who]) => {
            console.log(`Condição: ${condition}, Parentes:`, who); // Log para depuração
            const checkbox = document.querySelector(`input[name="familyHistory"][value="${condition}"]`);
            if (checkbox) {
                checkbox.checked = true;
            } else {
                console.warn(`Checkbox para condição ${condition} não encontrado`);
            }
            if (Array.isArray(who)) {
                who.forEach(value => {
                    const whoCheckbox = document.querySelector(`input[name="family${condition}Who"][value="${value}"]`);
                    if (whoCheckbox) {
                        whoCheckbox.checked = true;
                    } else {
                        console.warn(`Checkbox para parente ${value} da condição ${condition} não encontrado`);
                    }
                });
            } else {
                console.warn(`Parentes para condição ${condition} não é um array:`, who);
            }
        });
    } else {
        console.warn('familyHistory não está definido ou não é um objeto:', employee.familyHistory);
    }
    document.getElementById('healthComplaint').value = employee.healthComplaint || '';
    document.getElementById('employeeId').value = employee.id;
    calculateIMC();
    modal.style.display = 'block';
};

const showDeleteConfirmation = (index) => {
    console.log('Mostrando confirmação de exclusão para índice:', index);
    currentDeleteId = index;
    deleteModal.style.display = 'block';
};

const deleteEmployee = async (index) => {
    const employee = filteredData[index];
    try {
        console.log('Excluindo funcionário com ID:', employee.id);
        const response = await fetch(`${API_BASE_URL}/api/employees/${employee.id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error(`Erro ao excluir: ${response.status}`);
        await fetchEmployees();
        deleteModal.style.display = 'none';
    } catch (error) {
        console.error('Erro ao excluir:', error);
        alert('Erro ao excluir funcionário.');
    }
};

const addNewEmployee = async () => {
    const name = document.getElementById('name').value;
    const age = parseInt(document.getElementById('age').value) || null;
    const weight = parseFloat(document.getElementById('weight').value) || null;
    const height = parseFloat(document.getElementById('height').value) || null;
    const sector = document.getElementById('sector').value;
    const branch = document.getElementById('branch').value;
    const conditions = Array.from(document.querySelectorAll('input[name="condition"]:checked')).map(el => el.value);
    const medication = document.getElementById('medication').value || '';
    const pcd = document.getElementById('pcd').value;
    const smoker = document.querySelector('input[name="smoker"]:checked')?.value || 'Não';
    const drinker = document.querySelector('input[name="drinker"]:checked')?.value || 'Não';
    const imc = height > 0 ? (weight / (height * height)).toFixed(1) : 0;
    const fractured = document.querySelector('input[name="fractured"]:checked')?.value || 'Não';
    const fracturedPart = document.getElementById('fracturedPart').value || '';
    const hospitalized = document.querySelector('input[name="hospitalized"]:checked')?.value || 'Não';
    const hospitalizationReason = document.getElementById('hospitalizationReason').value || '';
    const lastCheckup = document.getElementById('lastCheckup').value || '';
    // Coletar histórico familiar das caixas de seleção
    const familyHistoryCheckboxes = Array.from(document.querySelectorAll('input[name="familyHistory"]:checked'));
    const familyHistory = {};
    familyHistoryCheckboxes.forEach(checkbox => {
        const condition = checkbox.value;
        const who = Array.from(document.querySelectorAll(`input[name="family${condition}Who"]:checked`)).map(el => el.value);
        familyHistory[condition] = who.length > 0 ? who : [];
    });
    console.log('Salvando familyHistory:', familyHistory); // Log para depuração
    const healthComplaint = document.getElementById('healthComplaint').value || '';
    const employeeId = document.getElementById('employeeId').value;

    if (!name || !sector || !branch || !weight || !height || !age) {
        alert('Preencha todos os campos obrigatórios (Nome, Idade, Setor, Filial, Peso, Altura).');
        return;
    }

    const newEmployee = {
        id: employeeId ? parseInt(employeeId) : undefined,
        name, age, weight, height, sector, branch, conditions, medication, pcd, smoker, drinker, imc,
        fractured, fracturedPart, hospitalized, hospitalizationReason, lastCheckup, familyHistory, healthComplaint
    };

    try {
        const url = `${API_BASE_URL}/api/employees`;
        console.log('Enviando dados para', url, 'com:', newEmployee);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newEmployee)
        });
        if (!response.ok) throw new Error(`Erro ao salvar: ${response.status}`);
        modal.style.display = 'none';
        employeeForm.reset();
        document.getElementById('employeeId').value = '';
        await fetchEmployees();
    } catch (error) {
        console.error('Erro ao adicionar:', error);
        alert('Erro ao salvar funcionário.');
    }
};

const exportToExcel = () => {
    console.log('Exportando dados para Excel');
    const worksheetData = filteredData.map(employee => ({
        Nome: employee.name,
        Idade: employee.age,
        Peso: employee.weight,
        Altura: employee.height,
        Setor: employee.sector,
        Filial: employee.branch,
        Patologia: employee.conditions.join(', '),
        Medicação: employee.medication || 'Nenhuma',
        PCD: employee.pcd,
        Fumante: employee.smoker,
        Etilista: employee.drinker,
        IMC: employee.imc,
        Fraturou: employee.fractured,
        'Parte Fraturada': employee.fracturedPart || 'N/A',
        Internado: employee.hospitalized,
        'Motivo Internação': employee.hospitalizationReason || 'N/A',
        'Último Check-up': employee.lastCheckup || 'N/A',
        'Histórico Familiar': Object.entries(employee.familyHistory || {})
            .filter(([condition, who]) => Array.isArray(who) && who.length > 0)
            .map(([condition, who]) => `${condition}: ${who.join(', ')}`)
            .join('; ') || 'Nenhum',
        'Queixa de Saúde': employee.healthComplaint || 'Nenhuma'
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Funcionários');
    XLSX.writeFile(workbook, 'funcionarios_saude.xlsx');
};

const applyFilters = () => {
    console.log('Aplicando filtros');
    const employeeName = employeeFilter.value.toLowerCase();
    const selectedBranch = branchFilter.value;

    filteredData = employeesData.filter(employee => {
        const matchesName = employeeName === 'all' || employee.name.toLowerCase().includes(employeeName);
        const matchesBranch = selectedBranch === 'all' || employee.branch === selectedBranch;
        return matchesName && matchesBranch;
    });

    renderTable();
    renderSummaryCards();
    renderCharts();
};

const startAutoUpdate = () => {
    console.log('Iniciando atualização automática');
    setInterval(fetchEmployees, 60000);
};

const initApp = () => {
    console.log('Inicializando aplicativo');
    fetchEmployees();
    startAutoUpdate();
    calculateIMC();

    addDataBtn.addEventListener('click', () => {
        employeeForm.reset();
        document.getElementById('employeeId').value = '';
        document.getElementById('imc').value = '';
        modal.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    employeeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addNewEmployee();
    });

    exportBtn.addEventListener('click', exportToExcel);

    employeeFilter.addEventListener('input', applyFilters);
    branchFilter.addEventListener('change', applyFilters);

    confirmDeleteBtn.addEventListener('click', async () => {
        if (currentDeleteId !== null) {
            await deleteEmployee(currentDeleteId);
            currentDeleteId = null;
        }
    });

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'none';
        currentDeleteId = null;
    });

    document.getElementById('applyHealthFilter').addEventListener('click', renderHealthConditionsChart);
    document.getElementById('applyImcFilter').addEventListener('click', renderImcChart);
    document.getElementById('applyHabitsFilter').addEventListener('click', renderHabitsChart);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(`${this.getAttribute('data-tab')}-content`).classList.add('active');
        });
    });
};

window.onload = initApp;
