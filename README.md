# 💈 Sistema de Agendamento para Barbearia

Este projeto é um **sistema de agendamento online para barbearia**, desenvolvido com **HTML, CSS, JavaScript, PHP e MySQL**.
Ele permite que clientes escolham uma data e horário disponível para realizar agendamentos de serviços como **corte, barba ou corte + barba**.

O sistema foi desenvolvido com foco em **simplicidade, usabilidade e integração com WhatsApp**, permitindo que o barbeiro receba rapidamente os dados do cliente.

---

# 🌐 Demonstração do Projeto

A aplicação está disponível online:

🔗 https://barbeariacanaa.netlify.app/

---

# 🚀 Funcionalidades

✔ Agendamento online de serviços
✔ Calendário visual para seleção de datas
✔ Bloqueio de horários já agendados
✔ Horários exibidos como **disponíveis ou ocupados**
✔ Armazenamento dos agendamentos em banco de dados **MySQL**
✔ Integração com **WhatsApp** para envio do agendamento
✔ Interface simples e responsiva

---

# 🛠 Tecnologias Utilizadas

* **HTML5**
* **CSS3**
* **JavaScript**
* **MySQL - (SUPERBASE) **
* **Flatpickr (biblioteca de calendário)**

---

# 📂 Estrutura do Projeto

```
projeto-barbearia/
│
├── index.html
├── style.css
├── script.js
│
├── salvar_agendamento.php
├── buscar_horarios.php
│
├── Logo.png
│
└── README.md
```

---

# ⚙️ Como Executar o Projeto Localmente

1️⃣ Clone o repositório

```
git clone https://github.com/seu-usuario/projeto-barbearia.git
```

2️⃣ Coloque os arquivos dentro do servidor local WAMP

```
htdocs/
```

3️⃣ Crie o banco de dados **barbearia**

```sql
CREATE DATABASE barbearia;
```

4️⃣ Crie a tabela de agendamentos

```sql
CREATE TABLE agendamentos (

id INT AUTO_INCREMENT PRIMARY KEY,
nome VARCHAR(100),
telefone VARCHAR(20),
servico VARCHAR(50),
data DATE,
hora TIME

);
```

5️⃣ Configure a conexão com o banco nos arquivos:

```
salvar_agendamento.php
buscar_horarios.php
```

---

# 💡 Melhorias Futuras

Algumas melhorias que podem ser implementadas no sistema:

* Painel administrativo para o barbeiro
* Cancelamento de agendamentos
* Login administrativo
* Notificação automática para clientes
* Melhor responsividade para dispositivos móveis
* Dashboard de agendamentos

---

# 👨‍💻 Autor

**Sanderson Rhawan**

Desenvolvedor em formação com foco em **desenvolvimento web e análise de dados**.

🔗 GitHub:
https://github.com/seu-usuario

---

# 📄 Licença

Este projeto foi desenvolvido para fins de **estudo e portfólio**.
