/**
 * Configuração da URL base da API, ajustada para ambiente local ou produção.
 * @constant {string} API_BASE_URL - URL da API (localhost:3000 localmente ou domínio do Square Cloud em produção).
 */
const API_BASE_URL = window.location.hostname.includes('squareweb.app')
  ? window.location.origin
  : 'http://localhost:3000';
console.log('API_BASE_URL definido como:', API_BASE_URL);

/**
 * Dados globais dos funcionários.
 * @type {Array<Object>} employeesData - Lista completa de funcionários carregada da API.
 * @type {Array<Object>} filteredData - Lista filtrada para exibição na tabela e gráficos.
 */
let employeesData = [];
let filteredData = [];

/**
 * Referências aos elementos DOM usados no script.
 */
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
let currentDeleteId = null;

/**
 * Carrega os dados dos funcionários da API e atualiza a interface.
 * @async
 */
async function fetchEmployees() {
  try {
    const url = `${API_BASE_URL}/api/employees`;
    console.log('Buscando funcionários em', url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }
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
    alert(`Não foi possível carregar os dados. Certifique-se de que o servidor está rodando. Detalhes: ${error.message}`);
  }
}

/**
 * Conta indicadores para os gráficos e cartões de resumo.
 * @returns {Object} Objeto com contagens de condições, hábitos e categorias de IMC.
 */
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

/**
 * Renderiza a tabela de dados detalhados com os funcionários filtrados.
 */
const renderTable = () => {
  console.log('Renderizando tabela com dados:', filteredData);
  const tbody = dataTable.querySelector('tbody');
  tbody.innerHTML = '';

  filteredData.forEach((employee, index) => {
    const familyHistoryStr = Object.entries(employee.familyHistory || {})
      .filter(([condition, who]) => who)
      .map(([condition, who]) => `${condition}: ${who}`)
      .join(', ');
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
      <td>${employee.fractured || 'N/A'}</td>
      <td>${employee.fracturedPart || 'N/A'}</td>
      <td>${employee.hospitalized || 'N/A'}</td>
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

/**
 * Atualiza os cartões de resumo com totais de funcionários, uso de medicação e PCDs.
 */
const renderSummaryCards = () => {
  document.getElementById('totalEmployees').querySelector('.number').textContent = filteredData.length;
  const counts = countIndicators();
  document.getElementById('medicationUsers').querySelector('.number').textContent = counts.medication;
  document.getElementById('pcdCount').querySelector('.number').textContent = counts.pcd;
};

/**
 * Renderiza o gráfico de condições de saúde com base nos filtros selecionados.
 */
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

/**
 * Renderiza o gráfico de distribuição de IMC com base nos filtros selecionados.
 */
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

/**
 * Renderiza o gráfico de hábitos com base nos filtros selecionados.
 */
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

/**
 * Renderiza todos os gráficos (Condições de Saúde, IMC, Hábitos).
 */
const renderCharts = () => {
  console.log('Renderizando gráficos');
  if (filteredData.length > 0) {
    renderHealthConditionsChart();
    renderImcChart();
    renderHabitsChart();
  } else {
    document.getElementById('healthConditionsChart').textContent = 'Nenhum dado para exibir. Adicione funcionários primeiro.';
    document.getElementById('imcChart').textContent = 'Nenhum dado para exibir. Adicione funcionários primeiro.';
    document.getElementById('habitsChart').textContent = 'Nenhum dado para exibir. Adicione funcionários primeiro.';
  }
};

/**
 * Popula a lista de sugestões de nomes de funcionários no filtro.
 */
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

/**
 * Popula o filtro de filiais com as unidades disponíveis.
 */
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

/**
 * Preenche o formulário com os dados de um funcionário para edição.
 * @param {number} index - Índice do funcionário na lista filteredData.
 */
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
  document.querySelectorAll('input[name="familyHistory"]').forEach(checkbox => checkbox.checked = false);
  document.querySelectorAll('input[name^="family"][name$="Who"]').forEach(input => input.value = '');
  if (employee.familyHistory) {
    Object.entries(employee.familyHistory).forEach(([condition, who]) => {
      const checkbox = document.querySelector(`input[name="familyHistory"][value="${condition}"]`);
      if (checkbox) checkbox.checked = true;
      const whoInput = document.querySelector(`input[name="family${condition}Who"]`);
      if (whoInput) whoInput.value = who || '';
    });
  }
  document.getElementById('healthComplaint').value = employee.healthComplaint || '';
  document.getElementById('employeeId').value = employee.id;
  modal.style.display = 'block';
};

/**
 * Exibe o modal de confirmação de exclusão.
 * @param {number} index - Índice do funcionário na lista filteredData.
 */
const showDeleteConfirmation = (index) => {
  console.log('Mostrando confirmação de exclusão para índice:', index);
  currentDeleteId = index;
  deleteModal.style.display = 'block';
};

/**
 * Exclui um funcionário da API e atualiza a interface.
 * @async
 * @param {number} index - Índice do funcionário na lista filteredData.
 */
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
    alert(`Erro ao excluir funcionário. Certifique-se de que o servidor está rodando. Detalhes: ${error.message}`);
  }
};

/**
 * Calcula o IMC automaticamente com base no peso e altura.
 * Fórmula: IMC = peso (kg) / (altura (m) * altura (m)).
 * Atualiza o campo imc no formulário.
 */
const calculateIMC = () => {
  const weight = parseFloat(document.getElementById('weight').value);
  const height = parseFloat(document.getElementById('height').value);
  const imcField = document.getElementById('imc');

  if (weight > 0 && height > 0) {
    const imc = (weight / (height * height)).toFixed(1);
    imcField.value = imc;
  } else {
    imcField.value = '';
  }
};

/**
 * Adiciona ou atualiza um funcionário na API.
 * @async
 */
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
  const imc = parseFloat(document.getElementById('imc').value);
  const fractured = document.querySelector('input[name="fractured"]:checked')?.value || 'Não';
  const fracturedPart = document.getElementById('fracturedPart').value || '';
  const hospitalized = document.querySelector('input[name="hospitalized"]:checked')?.value || 'Não';
  const hospitalizationReason = document.getElementById('hospitalizationReason').value || '';
  const lastCheckup = document.getElementById('lastCheckup').value || '';
  const familyHistoryCheckboxes = Array.from(document.querySelectorAll('input[name="familyHistory"]:checked'));
  const familyHistory = {};
  familyHistoryCheckboxes.forEach(checkbox => {
    const condition = checkbox.value;
    const whoInput = document.querySelector(`input[name="family${condition}Who"]`);
    familyHistory[condition] = whoInput ? whoInput.value : '';
  });
  const healthComplaint = document.getElementById('healthComplaint').value || '';
  const employeeId = document.getElementById('employeeId').value;

  if (!name || !sector || !branch || isNaN(imc)) {
    alert('Preencha todos os campos obrigatórios (Nome, Setor, Filial, Peso, Altura).');
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
    if (!response.ok) {
      throw new Error(`Erro ao salvar: ${response.status} ${response.statusText}`);
    }
    modal.style.display = 'none';
    employeeForm.reset();
    document.getElementById('employeeId').value = '';
    await fetchEmployees();
  } catch (error) {
    console.error('Erro ao adicionar:', error);
    alert(`Erro ao salvar funcionário. Certifique-se de que o servidor está rodando. Detalhes: ${error.message}`);
  }
};

/**
 * Exporta os dados para um arquivo Excel.
 */
const exportData = () => {
  console.log('Exportando dados');
  const counts = countIndicators();
  const reportData = [
    ["RELATÓRIO DE INDICADORES DE SAÚDE"],
    [],
    ["Total de Funcionários", filteredData.length],
    [],
    ["CONDIÇÕES DE SAÚDE"],
    ["Hipertensão (HAS)", counts.HAS],
    ["Diabetes (DM)", counts.DM],
    ["Cardíacos", counts.Cardíaco],
    ["Asmáticos", counts.Asmático],
    ["Câncer (CA)", counts.CA],
    ["Ansiedade", counts.Ansiedade],
    ["Renal", counts.Renal],
    ["Depressão", counts.Depressão],
    ["Trombose", counts.Trombose],
    ["Hérnia", counts.Hérnia],
    ["Epilepsia", counts.Epilepsia],
    ["Tendinite", counts.Tendinite],
    ["Psiquiátrico", counts.Psiquiátrico],
    [],
    ["INDICADORES DE IMC"],
    ["IMC abaixo de 18", counts.imcBelow18],
    ["IMC entre 18 e 24", counts.imc18to24],
    ["IMC entre 24 e 29", counts.imc24to29],
    ["IMC entre 29 e 34", counts.imc29to34],
    ["IMC entre 34 e 39", counts.imc34to39],
    ["IMC acima de 39", counts.imcAbove39],
    [],
    ["OUTROS INDICADORES"],
    ["Fumantes", counts.smoker],
    ["Etilistas", counts.drinker],
    ["Uso de medicação", counts.medication],
    ["PCDs", counts.pcd]
  ];

  const ws = XLSX.utils.aoa_to_sheet(reportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Indicadores de Saúde");
  XLSX.writeFile(wb, "indicadores_saude.xlsx");
};

/**
 * Aplica os filtros de funcionário e filial à tabela e gráficos.
 */
const applyFilters = () => {
  console.log('Aplicando filtros');
  const employeeFilterValue = employeeFilter.value.trim();
  const branchFilterValue = document.getElementById('branchFilter').value;

  if (employeeFilterValue && employeeFilterValue !== 'all') {
    const selectedEmployee = employeesData.find(employee => employee.name.toLowerCase() === employeeFilterValue.toLowerCase());
    if (selectedEmployee) {
      filteredData = [selectedEmployee];
    } else {
      filteredData = [...employeesData];
    }
  } else if (branchFilterValue !== 'all') {
    filteredData = employeesData.filter(employee => employee.branch === branchFilterValue);
  } else {
    filteredData = [...employeesData];
  }

  renderTable();
  renderSummaryCards();
  renderCharts();
};

/**
 * Inicializa o aplicativo, configurando eventos e carregando dados iniciais.
 */
const initApp = () => {
  console.log('Inicializando aplicativo');
  fetchEmployees();

  // Alternância de abas
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      document.getElementById(`${tab.getAttribute('data-tab')}-content`).classList.add('active');
    });
  });

  // Abrir modal para adicionar funcionário
  addDataBtn.addEventListener('click', () => {
    console.log('Abrindo modal para adicionar funcionário');
    employeeForm.reset();
    document.getElementById('employeeId').value = '';
    modal.style.display = 'block';
  });

  // Fechar modais
  closeBtn.addEventListener('click', () => modal.style.display = 'none');
  window.addEventListener('click', (event) => {
    if (event.target === modal) modal.style.display = 'none';
    if (event.target === deleteModal) deleteModal.style.display = 'none';
  });

  // Aplicar filtros dos gráficos
  document.getElementById('applyHealthFilter').addEventListener('click', renderHealthConditionsChart);
  document.getElementById('applyImcFilter').addEventListener('click', renderImcChart);
  document.getElementById('applyHabitsFilter').addEventListener('click', renderHabitsChart);

  // Filtros de funcionário e filial
  employeeFilter.addEventListener('change', applyFilters);
  employeeFilter.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') applyFilters();
  });
  document.getElementById('branchFilter').addEventListener('change', applyFilters);

  // Exportação de dados
  exportBtn.addEventListener('click', exportData);

  // Confirmação de exclusão
  confirmDeleteBtn.addEventListener('click', () => deleteEmployee(currentDeleteId));
  cancelDeleteBtn.addEventListener('click', () => deleteModal.style.display = 'none');

  // Submissão do formulário
  employeeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addNewEmployee();
  });

  // Cálculo automático do IMC
  const weightInput = document.getElementById('weight');
  const heightInput = document.getElementById('height');
  weightInput.addEventListener('input', calculateIMC);
  heightInput.addEventListener('input', calculateIMC);

  // Redesenhar gráficos ao redimensionar a janela
  window.addEventListener('resize', renderCharts);
};

/**
 * Inicializa o aplicativo quando o DOM estiver carregado.
 */
document.addEventListener('DOMContentLoaded', initApp);