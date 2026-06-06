# Migração para Supabase

Este projeto agora agenda direto pelo Supabase, sem depender dos arquivos PHP antigos.

Para um passo a passo mais simples de uso diário, leia `COMO_USAR.md`.

## Configuração

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute o arquivo `supabase_agendamentos.sql`.
3. Vá em Project Settings > API.
4. Copie a Project URL e a anon public key.
5. Cole esses valores no arquivo `supabase-config.js`.

Se o seu projeto estiver com a Data API restrita, exponha a tabela `agendamentos`
e as funções `listar_horarios_ocupados`, `obter_configuracao_agenda`,
`admin_obter_configuracao_agenda` e `admin_salvar_configuracao_agenda`.

Se o Supabase já tinha sido configurado antes desta versão, execute novamente o
arquivo `supabase_agendamentos.sql` no SQL Editor para criar os campos e funções
de funcionamento da agenda.

## Arquivos principais

- `index.html`: estrutura da página de agendamento.
- `admin.html`: painel simples para a barbearia ver os agendamentos.
- `style.css`: visual reformulado e responsivo.
- `script.js`: validação, consulta da configuração da agenda, horários ocupados, insert no Supabase e WhatsApp.
- `admin.js`: login por senha simples, filtros, resumo, cancelamento e configuração de funcionamento.
- `supabase-config.js`: URL, anon key, tabela, WhatsApp, dias e horários padrão.
- `supabase_agendamentos.sql`: tabelas, horário único, funções de agenda e policies.

## Painel da barbearia

Abra `admin.html` para ver os agendamentos e ajustar os dias/horários de funcionamento.

A senha inicial é:

```txt
canaa2026
```

Para trocar a senha, rode no SQL Editor do Supabase:

```sql
select public.definir_senha_admin_barbearia('nova-senha-aqui');
```

Use uma senha com pelo menos 6 caracteres. Depois de configurar o banco, evite subir
`supabase_agendamentos.sql` para uma hospedagem pública, porque ele mostra a senha inicial.

## Segurança

Visitantes podem inserir agendamentos e chamar a função que lista apenas horários ocupados.
Eles não recebem nomes ou telefones de outros clientes. A constraint única no banco impede dois
agendamentos ativos no mesmo dia e horário.

O painel não usa Supabase Auth. Ele usa uma senha simples validada por função no banco.
Isso é mais fácil para uso diário, mas menos forte do que login com usuário e senha do Supabase.
