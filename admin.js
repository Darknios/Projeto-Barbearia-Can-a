(function () {
  "use strict";

  const config = window.CANAA_SUPABASE || {};
  const placeholderValues = ["COLE_AQUI_A_URL_DO_PROJETO", "COLE_AQUI_A_ANON_KEY"];
  const storageKey = "canaa_admin_password";
  const sessionKey = "canaa_admin_session_password";

  const loginView = document.getElementById("loginView");
  const dashboardView = document.getElementById("dashboardView");
  const loginForm = document.getElementById("adminLoginForm");
  const loginButton = document.getElementById("loginButton");
  const passwordInput = document.getElementById("adminPassword");
  const rememberInput = document.getElementById("rememberPassword");
  const loginStatus = document.getElementById("loginStatus");
  const adminStatus = document.getElementById("adminStatus");
  const logoutButton = document.getElementById("logoutButton");
  const refreshButton = document.getElementById("refreshButton");
  const filterStart = document.getElementById("filterStart");
  const filterEnd = document.getElementById("filterEnd");
  const filterStatus = document.getElementById("filterStatus");
  const filterSearch = document.getElementById("filterSearch");
  const appointmentsTable = document.getElementById("appointmentsTable");
  const appointmentsList = document.getElementById("appointmentsList");
  const appointmentsCount = document.getElementById("appointmentsCount");
  const emptyState = document.getElementById("emptyState");
  const scheduleForm = document.getElementById("scheduleForm");
  const scheduleSummary = document.getElementById("scheduleSummary");
  const scheduleTimesList = document.getElementById("scheduleTimesList");
  const newScheduleTime = document.getElementById("newScheduleTime");
  const addScheduleTime = document.getElementById("addScheduleTime");
  const saveScheduleButton = document.getElementById("saveScheduleButton");
  const workingDayInputs = Array.from(document.querySelectorAll('input[name="workingDay"]'));

  const statToday = document.getElementById("statToday");
  const statScheduled = document.getElementById("statScheduled");
  const statCancelled = document.getElementById("statCancelled");
  const statTotal = document.getElementById("statTotal");
  const defaultTimes = normalizeTimeList(config.availableTimes || [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00"
  ]);
  const defaultWorkingDays = normalizeWorkingDays(config.workingDays || [0, 1, 2, 3, 4, 5, 6]);
  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  let supabaseClient = null;
  let adminPassword = "";
  let searchTimer = 0;
  let scheduleTimes = defaultTimes.slice();
  let scheduleWorkingDays = new Set(defaultWorkingDays);

  init();

  function init() {
    setupSupabase();
    setupDefaultDates();
    bindEvents();
    restorePassword();
  }

  function setupSupabase() {
    const isConfigured = Boolean(
      config.url &&
      config.anonKey &&
      !placeholderValues.includes(config.url) &&
      !placeholderValues.includes(config.anonKey)
    );

    if (!isConfigured) {
      setStatus(loginStatus, "Painel em fase de ativação. Finalize a configuração antes de usar.", "warning");
      loginButton.disabled = true;
      return;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      setStatus(loginStatus, "Não foi possível carregar o painel. Confira sua conexão e tente novamente.", "error");
      loginButton.disabled = true;
      return;
    }

    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  }

  function bindEvents() {
    loginForm.addEventListener("submit", handleLogin);
    logoutButton.addEventListener("click", logout);
    refreshButton.addEventListener("click", loadAppointments);
    filterStart.addEventListener("change", loadAppointments);
    filterEnd.addEventListener("change", loadAppointments);
    filterStatus.addEventListener("change", loadAppointments);
    filterSearch.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(loadAppointments, 280);
    });

    appointmentsTable.addEventListener("click", handleAppointmentAction);
    appointmentsList.addEventListener("click", handleAppointmentAction);
    scheduleForm.addEventListener("submit", saveScheduleSettings);
    addScheduleTime.addEventListener("click", addScheduleTimeFromInput);
    scheduleTimesList.addEventListener("click", handleScheduleTimeAction);
    newScheduleTime.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addScheduleTimeFromInput();
      }
    });
    workingDayInputs.forEach((input) => {
      input.addEventListener("change", function () {
        scheduleWorkingDays = new Set(collectWorkingDays());
        updateScheduleSummary();
      });
    });
  }

  function setupDefaultDates() {
    const today = new Date();
    const end = addDays(today, 30);

    filterStart.value = toISODate(today);
    filterEnd.value = toISODate(end);
  }

  function restorePassword() {
    const savedPassword = localStorage.getItem(storageKey) || sessionStorage.getItem(sessionKey);

    if (!savedPassword || !supabaseClient) {
      return;
    }

    passwordInput.value = savedPassword;
    rememberInput.checked = Boolean(localStorage.getItem(storageKey));
    adminPassword = savedPassword;
    showDashboard();
    loadAppointments();
    loadScheduleSettings();
  }

  async function handleLogin(event) {
    event.preventDefault();

    if (!supabaseClient) {
      return;
    }

    const password = passwordInput.value.trim();

    if (password.length < 6) {
      setStatus(loginStatus, "Digite a senha da barbearia.", "warning");
      return;
    }

    adminPassword = password;
    setLoading(loginButton, true);
    setStatus(loginStatus, "Entrando no painel...", "info");

    const ok = await loadAppointments({ silent: true });
    setLoading(loginButton, false);

    if (!ok) {
      adminPassword = "";
      return;
    }

    if (rememberInput.checked) {
      localStorage.setItem(storageKey, password);
      sessionStorage.removeItem(sessionKey);
    } else {
      sessionStorage.setItem(sessionKey, password);
      localStorage.removeItem(storageKey);
    }

    showDashboard();
    loadScheduleSettings({ silent: true });
  }

  async function loadAppointments(options) {
    if (!supabaseClient || !adminPassword) {
      return false;
    }

    const silent = Boolean(options && options.silent);

    if (!silent) {
      setStatus(adminStatus, "Carregando agendamentos...", "info");
    }

    const { data, error } = await supabaseClient.rpc("admin_listar_agendamentos", {
      p_senha: adminPassword,
      p_data_inicio: filterStart.value || null,
      p_data_fim: filterEnd.value || null,
      p_status: filterStatus.value || null,
      p_busca: filterSearch.value.trim() || null
    });

    if (error) {
      const message = getFriendlyError(error);
      setStatus(loginView.hidden ? adminStatus : loginStatus, message, "error");
      renderAppointments([]);
      return false;
    }

    renderAppointments(data || []);

    if (!silent) {
      setStatus(adminStatus, "Agenda atualizada.", "success");
    }

    return true;
  }

  async function handleAppointmentAction(event) {
    const button = event.target.closest("[data-action]");

    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "cancel") {
      await cancelAppointment(id, button);
    }
  }

  async function cancelAppointment(id, button) {
    if (!id || !adminPassword) {
      return;
    }

    const confirmed = window.confirm("Cancelar este agendamento?");

    if (!confirmed) {
      return;
    }

    button.disabled = true;
    setStatus(adminStatus, "Cancelando agendamento...", "info");

    const { error } = await supabaseClient.rpc("admin_cancelar_agendamento", {
      p_senha: adminPassword,
      p_id: id
    });

    if (error) {
      setStatus(adminStatus, getFriendlyError(error), "error");
      button.disabled = false;
      return;
    }

    setStatus(adminStatus, "Agendamento cancelado.", "success");
    await loadAppointments({ silent: true });
  }

  async function loadScheduleSettings(options) {
    if (!supabaseClient || !adminPassword) {
      return false;
    }

    const silent = Boolean(options && options.silent);

    if (!silent) {
      setStatus(adminStatus, "Carregando funcionamento...", "info");
    }

    const { data, error } = await supabaseClient.rpc("admin_obter_configuracao_agenda", {
      p_senha: adminPassword
    });

    if (error) {
      setStatus(adminStatus, getFriendlyError(error), "error");
      renderScheduleSettings();
      return false;
    }

    applyScheduleSettings(Array.isArray(data) ? data[0] : data);
    renderScheduleSettings();

    if (!silent) {
      setStatus(adminStatus, "Funcionamento atualizado na tela.", "success");
    }

    return true;
  }

  async function saveScheduleSettings(event) {
    event.preventDefault();

    if (!supabaseClient || !adminPassword) {
      return;
    }

    const days = collectWorkingDays();

    if (!days.length) {
      setStatus(adminStatus, "Escolha pelo menos um dia de funcionamento.", "warning");
      return;
    }

    if (!scheduleTimes.length) {
      setStatus(adminStatus, "Adicione pelo menos um horário para a agenda.", "warning");
      return;
    }

    setLoading(saveScheduleButton, true);
    setStatus(adminStatus, "Salvando funcionamento...", "info");

    const { data, error } = await supabaseClient.rpc("admin_salvar_configuracao_agenda", {
      p_senha: adminPassword,
      p_dias_funcionamento: days,
      p_horarios_disponiveis: scheduleTimes
    });

    setLoading(saveScheduleButton, false);

    if (error) {
      setStatus(adminStatus, getFriendlyError(error), "error");
      return;
    }

    applyScheduleSettings(Array.isArray(data) ? data[0] : data);
    renderScheduleSettings();
    setStatus(adminStatus, "Funcionamento salvo. A agenda do cliente já vai usar esses dias e horários.", "success");
  }

  function applyScheduleSettings(settings) {
    scheduleWorkingDays = new Set(normalizeWorkingDays(settings && settings.dias_funcionamento));
    scheduleTimes = normalizeTimeList(settings && settings.horarios_disponiveis);

    if (!scheduleWorkingDays.size) {
      scheduleWorkingDays = new Set(defaultWorkingDays);
    }

    if (!scheduleTimes.length) {
      scheduleTimes = defaultTimes.slice();
    }
  }

  function renderScheduleSettings() {
    workingDayInputs.forEach((input) => {
      input.checked = scheduleWorkingDays.has(Number(input.value));
    });

    renderScheduleTimes();
    updateScheduleSummary();
  }

  function renderScheduleTimes() {
    scheduleTimesList.replaceChildren();

    if (!scheduleTimes.length) {
      const empty = document.createElement("p");
      empty.className = "schedule-empty";
      empty.textContent = "Nenhum horário liberado.";
      scheduleTimesList.appendChild(empty);
      return;
    }

    scheduleTimes.forEach((time) => {
      const chip = document.createElement("span");
      const label = document.createElement("span");
      const remove = document.createElement("button");

      chip.className = "schedule-time-chip";
      label.textContent = time;
      remove.type = "button";
      remove.dataset.action = "remove-time";
      remove.dataset.time = time;
      remove.setAttribute("aria-label", `Remover horário ${time}`);
      remove.textContent = "x";
      chip.append(label, remove);
      scheduleTimesList.appendChild(chip);
    });
  }

  function updateScheduleSummary() {
    const days = Array.from(scheduleWorkingDays).sort((a, b) => a - b);
    const timeText = scheduleTimes.length === 1 ? "1 horário" : `${scheduleTimes.length} horários`;
    scheduleSummary.textContent = `${formatWorkingDays(days)} - ${timeText}`;
  }

  function addScheduleTimeFromInput() {
    const time = normalizeTime(newScheduleTime.value);

    if (!isValidTime(time)) {
      setStatus(adminStatus, "Informe um horário válido.", "warning");
      return;
    }

    if (!scheduleTimes.includes(time)) {
      scheduleTimes.push(time);
      scheduleTimes.sort();
      renderScheduleSettings();
    }

    newScheduleTime.value = "";
    newScheduleTime.focus();
  }

  function handleScheduleTimeAction(event) {
    const button = event.target.closest("[data-action='remove-time']");

    if (!button) {
      return;
    }

    scheduleTimes = scheduleTimes.filter((time) => time !== button.dataset.time);
    renderScheduleSettings();
  }

  function collectWorkingDays() {
    return workingDayInputs
      .filter((input) => input.checked)
      .map((input) => Number(input.value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      .sort((a, b) => a - b);
  }

  function renderAppointments(appointments) {
    appointmentsTable.replaceChildren();
    appointmentsList.replaceChildren();

    appointments.forEach((appointment) => {
      appointmentsTable.appendChild(createTableRow(appointment));
      appointmentsList.appendChild(createMobileCard(appointment));
    });

    const total = appointments.length;
    appointmentsCount.textContent = total === 1 ? "1 registro" : `${total} registros`;
    emptyState.hidden = total !== 0;
    updateStats(appointments);
  }

  function createTableRow(appointment) {
    const row = document.createElement("tr");
    row.append(
      createClientCell(appointment),
      createTextCell(appointment.servico),
      createTextCell(formatDateBR(appointment.data)),
      createTextCell(normalizeTime(appointment.hora)),
      createStatusCell(appointment.status),
      createActionsCell(appointment)
    );
    return row;
  }

  function createClientCell(appointment) {
    const cell = document.createElement("td");
    const name = document.createElement("strong");
    const phone = document.createElement("span");

    name.textContent = appointment.nome || "Sem nome";
    phone.textContent = formatPhone(appointment.telefone);

    cell.className = "client-cell";
    cell.append(name, phone);
    return cell;
  }

  function createTextCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text || "-";
    return cell;
  }

  function createStatusCell(status) {
    const cell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status-badge ${status === "cancelado" ? "is-cancelled" : "is-scheduled"}`;
    badge.textContent = status === "cancelado" ? "Cancelado" : "Agendado";
    cell.appendChild(badge);
    return cell;
  }

  function createActionsCell(appointment) {
    const cell = document.createElement("td");
    const wrap = document.createElement("div");
    const whatsapp = document.createElement("a");

    wrap.className = "row-actions";
    whatsapp.className = "mini-action";
    whatsapp.href = buildWhatsAppLink(appointment.telefone);
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener noreferrer";
    whatsapp.textContent = "WhatsApp";
    wrap.appendChild(whatsapp);

    if (appointment.status !== "cancelado") {
      const cancel = document.createElement("button");
      cancel.className = "mini-action cancel-action";
      cancel.type = "button";
      cancel.dataset.action = "cancel";
      cancel.dataset.id = appointment.id;
      cancel.textContent = "Cancelar";
      wrap.appendChild(cancel);
    }

    cell.appendChild(wrap);
    return cell;
  }

  function createMobileCard(appointment) {
    const card = document.createElement("article");
    const top = document.createElement("div");
    const name = document.createElement("strong");
    const badge = document.createElement("span");
    const details = document.createElement("dl");
    const actions = createActionsCell(appointment).firstElementChild;

    card.className = "appointment-mobile-card";
    top.className = "appointment-mobile-top";
    name.textContent = appointment.nome || "Sem nome";
    badge.className = `status-badge ${appointment.status === "cancelado" ? "is-cancelled" : "is-scheduled"}`;
    badge.textContent = appointment.status === "cancelado" ? "Cancelado" : "Agendado";
    top.append(name, badge);

    addDetail(details, "WhatsApp", formatPhone(appointment.telefone));
    addDetail(details, "Serviço", appointment.servico);
    addDetail(details, "Data", formatDateBR(appointment.data));
    addDetail(details, "Horário", normalizeTime(appointment.hora));

    card.append(top, details, actions);
    return card;
  }

  function addDetail(list, label, value) {
    const group = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");

    term.textContent = label;
    description.textContent = value || "-";
    group.append(term, description);
    list.appendChild(group);
  }

  function updateStats(appointments) {
    const today = toISODate(new Date());
    const scheduled = appointments.filter((item) => item.status === "agendado");
    const cancelled = appointments.filter((item) => item.status === "cancelado");
    const todayAppointments = scheduled.filter((item) => item.data === today);

    statToday.textContent = String(todayAppointments.length);
    statScheduled.textContent = String(scheduled.length);
    statCancelled.textContent = String(cancelled.length);
    statTotal.textContent = String(appointments.length);
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    adminStatus.hidden = true;
  }

  function logout() {
    adminPassword = "";
    passwordInput.value = "";
    localStorage.removeItem(storageKey);
    sessionStorage.removeItem(sessionKey);
    dashboardView.hidden = true;
    loginView.hidden = false;
    setStatus(loginStatus, "Senha removida deste aparelho.", "success");
  }

  function setLoading(button, isLoading) {
    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);
  }

  function setStatus(element, message, type) {
    element.hidden = false;
    element.className = `status-panel ${type || "info"}`;
    element.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    element.appendChild(paragraph);
  }

  function getFriendlyError(error) {
    const message = `${error.message || ""} ${error.details || ""}`.toLowerCase();

    if (message.includes("senha_invalida")) {
      return "Senha incorreta. Confira e tente novamente.";
    }

    if (
      message.includes("admin_obter_configuracao_agenda") ||
      message.includes("admin_salvar_configuracao_agenda") ||
      message.includes("horario_agenda_permitido")
    ) {
      return "A configuração de funcionamento ainda não foi ativada. Execute o SQL atualizado no Supabase.";
    }

    if (message.includes("dias_vazios")) {
      return "Escolha pelo menos um dia de funcionamento.";
    }

    if (message.includes("horarios_vazios")) {
      return "Adicione pelo menos um horário para a agenda.";
    }

    if (message.includes("horario_invalido")) {
      return "Um dos horários está inválido. Use o formato HH:MM.";
    }

    if (message.includes("dia_invalido")) {
      return "Um dos dias selecionados está inválido.";
    }

    if (message.includes("function") || message.includes("admin_listar_agendamentos")) {
      return "O painel ainda não foi ativado. Finalize a configuração antes de usar.";
    }

    if (message.includes("periodo_invalido")) {
      return "A data inicial precisa ser menor que a data final.";
    }

    return "Não consegui carregar os dados agora. Confira sua conexão e tente novamente.";
  }

  function normalizeWorkingDays(days) {
    if (!Array.isArray(days)) {
      return [];
    }

    return Array.from(
      new Set(
        days
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      )
    ).sort((a, b) => a - b);
  }

  function normalizeTimeList(times) {
    if (!Array.isArray(times)) {
      return [];
    }

    return Array.from(
      new Set(
        times
          .map(normalizeTime)
          .filter(isValidTime)
      )
    ).sort();
  }

  function isValidTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function formatWorkingDays(days) {
    if (!days.length) {
      return "Nenhum dia aberto";
    }

    if (days.length === 7) {
      return "Todos os dias";
    }

    return days.map((day) => dayNames[day]).join(", ");
  }

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function toISODate(date) {
    const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return copy.toISOString().slice(0, 10);
  }

  function normalizeTime(value) {
    return String(value || "").slice(0, 5);
  }

  function formatDateBR(value) {
    if (!value) {
      return "-";
    }

    const parts = String(value).split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  }

  function formatPhone(value) {
    const digits = onlyDigits(value);

    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return value || "-";
  }

  function buildWhatsAppLink(value) {
    let digits = onlyDigits(value);

    if (digits && !digits.startsWith("55")) {
      digits = `55${digits}`;
    }

    return `https://wa.me/${digits}`;
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }
})();
