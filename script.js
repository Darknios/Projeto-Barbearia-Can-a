(function () {
  "use strict";

  const config = window.CANAA_SUPABASE || {};
  const defaultAvailableTimes = [
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
  ];
  const defaultWorkingDays = normalizeWorkingDays(config.workingDays || [0, 1, 2, 3, 4, 5, 6]);
  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  const services = new Set(["Corte", "Barba", "Corte + Barba"]);
  const tableName = config.table || "agendamentos";
  const barberWhatsApp = config.barbeiroWhatsapp || "5581993778859";
  const placeholderValues = ["COLE_AQUI_A_URL_DO_PROJETO", "COLE_AQUI_A_ANON_KEY"];

  const form = document.getElementById("formAgendamento");
  const telefoneInput = document.getElementById("telefone");
  const dataInput = document.getElementById("data");
  const horaSelect = document.getElementById("hora");
  const statusBox = document.getElementById("statusMessage");
  const submitButton = document.getElementById("submitButton");
  const workingDaysText = document.getElementById("workingDaysText");
  const workingTimesText = document.getElementById("workingTimesText");
  const mobileScheduleText = document.getElementById("mobileScheduleText");
  const scheduleNote = document.getElementById("scheduleNote");

  let supabaseClient = null;
  let bookedTimes = new Set();
  let datePicker = null;
  let availableTimes = normalizeTimeList(config.availableTimes || defaultAvailableTimes);
  let workingDays = new Set(defaultWorkingDays);

  const isConfigured = Boolean(
    config.url &&
    config.anonKey &&
    !placeholderValues.includes(config.url) &&
    !placeholderValues.includes(config.anonKey)
  );

  init();

  async function init() {
    setupSupabase();
    await loadScheduleSettings();
    updateScheduleCopy();
    setupDatePicker();
    renderTimes();
    telefoneInput.addEventListener("input", maskPhone);
    form.addEventListener("submit", handleSubmit);
  }

  function setupSupabase() {
    if (!isConfigured) {
      submitButton.disabled = true;
      setStatus(
        "Agenda online em fase de ativação. Para agendar agora, fale com a barbearia pelo WhatsApp.",
        "warning"
      );
      return;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      submitButton.disabled = true;
      setStatus("Não foi possível carregar a agenda online. Tente novamente em instantes.", "error");
      return;
    }

    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  }

  async function loadScheduleSettings() {
    if (!supabaseClient) {
      return;
    }

    const { data, error } = await supabaseClient.rpc("obter_configuracao_agenda");

    if (error) {
      console.warn(error);
      return;
    }

    applyScheduleSettings(Array.isArray(data) ? data[0] : data);
  }

  function applyScheduleSettings(settings) {
    const nextTimes = normalizeTimeList(settings && settings.horarios_disponiveis);
    const nextDays = normalizeWorkingDays(settings && settings.dias_funcionamento);

    availableTimes = nextTimes.length ? nextTimes : normalizeTimeList(config.availableTimes || defaultAvailableTimes);
    workingDays = new Set(nextDays.length ? nextDays : defaultWorkingDays);
  }

  function setupDatePicker() {
    const pickerOptions = {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      minDate: "today",
      disable: [
        function (date) {
          return !workingDays.has(date.getDay());
        }
      ],
      locale: window.flatpickr && window.flatpickr.l10ns ? window.flatpickr.l10ns.pt : undefined,
      onChange: function (_selectedDates, dateString) {
        loadBookedTimes(dateString);
      }
    };

    if (window.flatpickr) {
      datePicker = window.flatpickr(dataInput, pickerOptions);
      return;
    }

    dataInput.type = "date";
    dataInput.min = new Date().toISOString().slice(0, 10);
    dataInput.addEventListener("change", function () {
      loadBookedTimes(dataInput.value);
    });
  }

  async function loadBookedTimes(dateString) {
    bookedTimes = new Set();

    if (!dateString) {
      renderTimes();
      return;
    }

    if (!isWorkingDate(dateString)) {
      renderTimes();
      setStatus("A barbearia não abre nessa data. Escolha outro dia.", "warning");
      return;
    }

    if (!supabaseClient) {
      renderTimes();
      return;
    }

    renderTimes(true);
    setStatus("Consultando horários disponíveis...", "info");

    const { data, error } = await supabaseClient.rpc("listar_horarios_ocupados", {
      p_data: dateString
    });

    if (error) {
      console.error(error);
      renderTimes();
      setStatus(
        "Não foi possível consultar os horários agora. Tente novamente em instantes ou fale com a barbearia.",
        "error"
      );
      return;
    }

    bookedTimes = new Set((data || []).map((item) => normalizeTime(item.hora)));
    renderTimes();

    const freeCount = availableTimes.filter((time) => !bookedTimes.has(time)).length;
    setStatus(
      freeCount === 1
        ? "Ainda tem 1 horário livre para essa data."
        : `Ainda tem ${freeCount} horários livres para essa data.`,
      freeCount > 0 ? "success" : "warning"
    );
  }

  function renderTimes(isLoading) {
    horaSelect.innerHTML = "";

    const selectedDate = dataInput.value;
    const dateClosed = Boolean(selectedDate && !isWorkingDate(selectedDate));
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = isLoading
      ? "Carregando horários..."
      : !selectedDate
        ? "Data primeiro"
        : dateClosed
          ? "Dia fechado"
          : availableTimes.length
            ? "Escolha um horário"
            : "Sem horários";
    horaSelect.appendChild(placeholder);

    horaSelect.disabled = Boolean(isLoading || !selectedDate || dateClosed || !availableTimes.length);

    if (!selectedDate || isLoading || dateClosed || !availableTimes.length) {
      return;
    }

    availableTimes.forEach((time) => {
      const option = document.createElement("option");
      const isBooked = bookedTimes.has(time);
      option.value = time;
      option.textContent = isBooked ? `${time} - ocupado` : `${time} - disponível`;
      option.disabled = isBooked;
      horaSelect.appendChild(option);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!supabaseClient) {
      setStatus("A agenda online ainda não está ativa. Fale com a barbearia para marcar seu horário.", "warning");
      return;
    }

    const appointment = collectAppointment();
    const validation = validateAppointment(appointment);

    if (validation) {
      setStatus(validation, "warning");
      return;
    }

    setLoading(true);
    setStatus("Salvando agendamento...", "info");

    const { error } = await supabaseClient.from(tableName).insert({
      nome: appointment.nome,
      telefone: appointment.telefone,
      servico: appointment.servico,
      data: appointment.data,
      hora: appointment.hora,
      status: "agendado",
      origem: "site"
    });

    if (error) {
      console.error(error);
      setLoading(false);

      if (error.code === "23505" || /duplicate|unique/i.test(error.message || "")) {
        bookedTimes.add(appointment.hora);
        renderTimes();
        setStatus("Esse horário acabou de ser reservado. Escolha outro horário livre.", "warning");
        return;
      }

      if (/horario_fora_funcionamento/i.test(`${error.message || ""} ${error.details || ""}`)) {
        setStatus("Esse dia ou horário não está mais disponível. Escolha outra opção.", "warning");
        return;
      }

      setStatus("Não consegui salvar o agendamento agora. Tente novamente em instantes ou fale com a barbearia.", "error");
      return;
    }

    bookedTimes.add(appointment.hora);
    const whatsappUrl = buildWhatsAppUrl(appointment);
    resetForm();
    setLoading(false);

    window.open(whatsappUrl, "_blank", "noopener");
    setStatus(
      "Agendamento salvo! Toque no botão abaixo para enviar a confirmação no WhatsApp.",
      "success",
      whatsappUrl
    );
  }

  function collectAppointment() {
    const formData = new FormData(form);

    return {
      nome: String(formData.get("nome") || "").trim(),
      telefoneOriginal: String(formData.get("telefone") || "").trim(),
      telefone: onlyDigits(String(formData.get("telefone") || "")),
      servico: String(formData.get("servico") || "").trim(),
      data: String(formData.get("data") || "").trim(),
      hora: String(formData.get("hora") || "").trim()
    };
  }

  function validateAppointment(appointment) {
    if (appointment.nome.length < 2) {
      return "Informe seu nome para continuar.";
    }

    if (appointment.telefone.length < 10 || appointment.telefone.length > 13) {
      return "Informe um WhatsApp válido com DDD.";
    }

    if (!services.has(appointment.servico)) {
      return "Escolha um serviço da lista.";
    }

    if (!appointment.data) {
      return "Escolha uma data para o atendimento.";
    }

    if (!isWorkingDate(appointment.data)) {
      return "A barbearia não abre nessa data. Escolha outro dia.";
    }

    if (!availableTimes.includes(appointment.hora)) {
      return "Escolha um horário disponível.";
    }

    if (bookedTimes.has(appointment.hora)) {
      return "Esse horário já está ocupado. Escolha outro.";
    }

    return "";
  }

  function resetForm() {
    form.reset();

    if (datePicker) {
      datePicker.clear();
    }

    bookedTimes = new Set();
    renderTimes();
  }

  function setLoading(isLoading) {
    submitButton.disabled = isLoading || !supabaseClient;
    submitButton.classList.toggle("is-loading", isLoading);
  }

  function setStatus(message, type, actionUrl) {
    statusBox.hidden = false;
    statusBox.className = `status-panel ${type || "info"}`;
    statusBox.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    statusBox.appendChild(paragraph);

    if (actionUrl) {
      const link = document.createElement("a");
      link.href = actionUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "whatsapp-cta";
      link.textContent = "Enviar confirmação no WhatsApp";
      statusBox.appendChild(link);
    }
  }

  function updateScheduleCopy() {
    const days = Array.from(workingDays).sort((a, b) => a - b);
    const daysText = formatWorkingDays(days);
    const timesText = formatTimeSummary(availableTimes);

    if (workingDaysText) {
      workingDaysText.textContent = daysText;
    }

    if (workingTimesText) {
      workingTimesText.textContent = timesText;
    }

    if (mobileScheduleText) {
      mobileScheduleText.textContent = `${daysText}, ${timesText}`;
    }

    if (scheduleNote) {
      const closedDays = [0, 1, 2, 3, 4, 5, 6].filter((day) => !workingDays.has(day));
      scheduleNote.textContent = closedDays.length
        ? `${formatDayList(closedDays)} ${closedDays.length === 1 ? "não aparece" : "não aparecem"} na agenda porque a barbearia está fechada.`
        : "Todos os dias estão liberados na agenda.";
    }
  }

  function isWorkingDate(value) {
    const parts = String(value || "").split("-").map(Number);

    if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
      return false;
    }

    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return workingDays.has(date.getDay());
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
    if (days.length === 7) {
      return "Todos os dias";
    }

    if (arraysEqual(days, [0, 2, 3, 4, 5, 6])) {
      return "Terça a domingo";
    }

    if (arraysEqual(days, [1, 2, 3, 4, 5])) {
      return "Segunda a sexta";
    }

    if (arraysEqual(days, [1, 2, 3, 4, 5, 6])) {
      return "Segunda a sábado";
    }

    if (arraysEqual(days, [2, 3, 4, 5, 6])) {
      return "Terça a sábado";
    }

    return formatDayList(days);
  }

  function formatTimeSummary(times) {
    if (!times.length) {
      return "Sem horários";
    }

    if (times.length === 1) {
      return times[0];
    }

    return `${times[0]} às ${times[times.length - 1]}`;
  }

  function formatDayList(days) {
    const names = days.map((day) => dayNames[day]).filter(Boolean);

    if (names.length <= 1) {
      return names[0] || "Nenhum dia";
    }

    if (names.length === 2) {
      return `${names[0]} e ${names[1]}`;
    }

    return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  }

  function arraysEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function normalizeTime(value) {
    return String(value || "").slice(0, 5);
  }

  function onlyDigits(value) {
    return value.replace(/\D/g, "");
  }

  function maskPhone() {
    telefoneInput.value = formatPhoneBR(onlyDigits(telefoneInput.value));
  }

  function formatPhoneBR(digits) {
    digits = digits.slice(0, 11);

    if (digits.length <= 2) {
      return digits.length ? `(${digits}` : "";
    }

    if (digits.length <= 6) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function formatDateBR(value) {
    const parts = value.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  }

  function buildWhatsAppUrl(appointment) {
    const message = [
      "Novo agendamento:",
      `Nome: ${appointment.nome}`,
      `Telefone: ${appointment.telefoneOriginal}`,
      `Serviço: ${appointment.servico}`,
      `Data: ${formatDateBR(appointment.data)}`,
      `Hora: ${appointment.hora}`
    ].join("\n");

    return `https://wa.me/${barberWhatsApp}?text=${encodeURIComponent(message)}`;
  }
})();
