<?php

$conn = new mysqli("localhost","root","","barbearia");

if($conn->connect_error){
die("Erro na conexão");
}

$data = $_GET['data'];

$sql = "SELECT hora FROM agendamentos WHERE data='$data'";

$result = $conn->query($sql);

$horarios = [];

while($row = $result->fetch_assoc()){
$horarios[] = $row['hora'];
}

echo json_encode($horarios);

?>