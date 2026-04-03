const form = document.getElementById("formAgendamento");
const dataInput = document.getElementById("data");
const selectHora = document.getElementById("hora");

flatpickr("#data",{

dateFormat:"Y-m-d",
minDate:"today",

disable:[
function(date){
return(date.getDay() === 1);
}
]

});

dataInput.addEventListener("change", function(){

let data = this.value;

fetch("buscar_horarios.php?data=" + data)

.then(res => res.json())

.then(horarios => {

let horas = [
"08:00","09:00","10:00","11:00",
"12:00","13:00","14:00","15:00",
"16:00","17:00"
];

/* limpa select */
selectHora.innerHTML = '<option value="">Escolha um horário</option>';

horas.forEach(hora => {

let option = document.createElement("option");

let horaBanco = hora + ":00";

option.value = hora;

if(horarios.includes(horaBanco)){

option.textContent = hora + " 🔴 Ocupado";
option.disabled = true;

}else{

option.textContent = hora + " 🟢 Disponível";

}

selectHora.appendChild(option);

});

});

});


form.addEventListener("submit",function(e){

e.preventDefault();

let formData = new FormData(this);

fetch("salvar_agendamento.php",{

method:"POST",
body:formData

})

.then(res=>res.text())

.then(res=>{

if(res=="horario_ocupado"){

alert("Esse horário já foi agendado");
return;

}

alert("Agendamento realizado!");

let nome = formData.get("nome");
let telefone = formData.get("telefone");
let servico = formData.get("servico");
let data = formData.get("data");
let hora = formData.get("hora");

let mensagem = `Novo agendamento:%0A
Nome: ${nome}%0A
Telefone: ${telefone}%0A
Serviço: ${servico}%0A
Data: ${data}%0A
Hora: ${hora}`;

let numeroBarbeiro = "5581998132454";

window.open(`https://wa.me/${numeroBarbeiro}?text=${mensagem}`);

});

});