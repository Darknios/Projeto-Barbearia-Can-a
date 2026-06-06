# Como usar o sistema da Barbearia Canaã

Este sistema tem duas telas:

- `index.html`: tela do cliente marcar horário.
- `admin.html`: tela da barbearia ver os agendamentos.

## 1. Configurar o Supabase

1. Entre no Supabase e crie um projeto.
2. Abra o SQL Editor.
3. Cole e execute todo o conteúdo do arquivo `supabase_agendamentos.sql`.
4. Vá em Project Settings > API.
5. Copie a Project URL.
6. Copie a anon public key.
7. Abra o arquivo `supabase-config.js`.
8. Troque:

```js
url: "COLE_AQUI_A_URL_DO_PROJETO",
anonKey: "COLE_AQUI_A_ANON_KEY",
```

pelos dados reais do Supabase.

Se você já tinha rodado uma versão antiga do SQL, rode o arquivo
`supabase_agendamentos.sql` de novo. Ele atualiza o banco para permitir alterar
dias e horários pelo painel.

## 2. Cliente marcando horário

O cliente abre `index.html`.

Ele preenche:

1. Nome.
2. WhatsApp.
3. Serviço.
4. Data.
5. Horário.

Depois clica em **Confirmar agendamento**.

O sistema salva no Supabase e abre o WhatsApp com a mensagem pronta para a barbearia.

## 3. Barbearia vendo os dados

A barbearia abre `admin.html`.

Senha inicial:

```txt
canaa2026
```

Depois de entrar, a barbearia pode:

- Ver os agendamentos.
- Filtrar por data.
- Filtrar por status.
- Buscar por nome, telefone ou serviço.
- Escolher os dias de funcionamento.
- Adicionar ou remover horários disponíveis.
- Abrir WhatsApp do cliente.
- Cancelar agendamento.

## 4. Trocar a senha do painel

No SQL Editor do Supabase, rode:

```sql
select public.definir_senha_admin_barbearia('nova-senha-aqui');
```

Use uma senha simples para o barbeiro lembrar, mas não deixe fácil demais.

## 5. Colocar no ar

Envie estes arquivos para a hospedagem:

- `index.html`
- `admin.html`
- `style.css`
- `script.js`
- `admin.js`
- `supabase-config.js`
- `Logo.png`
- `manifest.webmanifest`
- `apple-touch-icon.png`

Não precisa enviar os arquivos PHP antigos. Eles ficaram desativados.

Evite publicar `supabase_agendamentos.sql`, porque ele mostra a senha inicial usada na primeira configuração.

## 6. Links para usar no celular

Depois de hospedar, salve dois links no celular da barbearia:

- Link dos clientes: `https://seu-site.com/index.html`
- Link da barbearia: `https://seu-site.com/admin.html`

No Android ou iPhone, abra o link no navegador e use a opção **Adicionar à tela inicial**.
