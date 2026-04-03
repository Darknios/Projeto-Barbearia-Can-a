<?php

$host = "localhost";
$user = "root";
$pass = "";
$db = "barbearia";

$conn = new mysqli($host,$user,$pass,$db);

if($conn->connect_error){
die("Erro na conexão");
}

$nome = $_POST['nome'];
$telefone = $_POST['telefone'];
$servico = $_POST['servico'];
$data = $_POST['data'];
$hora = $_POST['hora'];

/* VERIFICA SE HORÁRIO JÁ EXISTE */

$sql_verifica = "SELECT * FROM agendamentos 
WHERE data='$data' AND hora='$hora'";

$result = $conn->query($sql_verifica);

if($result->num_rows > 0){

echo "horario_ocupado";
exit;

}

/* SALVA AGENDAMENTO */

$sql = "INSERT INTO agendamentos 
(nome,telefone,servico,data,hora)
VALUES
('$nome','$telefone','$servico','$data','$hora')";

if($conn->query($sql) === TRUE){

echo "ok";

}else{

echo "erro";

}

?>