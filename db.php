<?php

$host = "localhost";
$user = "root";
$pass = "287540";
$db = "barbearia";

$conn = new mysqli($host,$user,$pass,$db);

if($conn->connect_error){
die("Erro na conexão");
}

?>