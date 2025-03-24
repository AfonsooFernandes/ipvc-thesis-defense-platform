# Plataforma de Gestão de Defesas de Teses de Mestrado

Este repositório contém o projeto de uma plataforma para gestão das defesas de teses de mestrado no IPVC. O objetivo principal é facilitar a organização e o acompanhamento das defesas, desde o registo de temas até a gestão de datas e resultados.

## Índice
- [Descrição](#descrição)
- [Funcionalidades](#funcionalidades)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Como Usar](#como-usar)
- [Roadmap](#roadmap)
- [Contribuindo](#contribuindo)
- [Licença](#licença)
- [Contato](#contato)
- [Autores](#autores)

---

## Descrição
A plataforma visa oferecer:
- **Registo de Teses**: Permitir que estudantes registem informações básicas sobre suas dissertações, como título, área de pesquisa, orientador, etc.
- **Gestão de Agendamentos**: Organizar os horários de defesa, alinhar disponibilidade de salas e membros.
- **Acompanhamento**: Fornecer relatórios e dashboards para que a coordenação e os orientadores acompanhem em que etapa cada aluno se encontra.

## Funcionalidades
1. **Autenticação**: Registro e login de utilizadores (estudantes, professores e coordenadores).
2. **Registo de Teses**: Inserir e atualizar dados das dissertações de forma simples.
3. **Gestão de Bancas**: Adicionar ou remover membros, definindo papéis e horários.
4. **Calendário de Defesas**: Visualização de datas e horários, com possibilidade de atualizações rápidas.
5. **Notificações**: Alertas por e-mail ou dentro da aplicação quando uma defesa é marcada ou atualizada.
6. **Relatórios**: Geração de relatórios para acompanhamento administrativo.

## Tecnologias Utilizadas
- **Front-end**: HTML, JavaScript e CSS
- **Back-end**: Node.js
- **Base de Dados**: PostgreSQL

## Requisitos
- **[Linguagem/Versão]** (Node.js 16+)
- **[Base de Dados]** (PostgreSQL 13)

## Instalação
1. **Clone o repositório**:
   ```bash
   git clone https://github.com/AfonsooFernandes/ipvc-thesis-defense-platform
   ```

2. **Acesse o diretório do projeto**:  
   ```bash  
   cd plataforma-defesas-mestrado-ipvc    
   ``` 

3. **Instale as dependências**:  
   ```bash  
   npm install    
   ``` 

4. **Configurar a base de dados**:  

5. **Iniciar o projeto**:
    ```bash  
   npm start   
   ``` 

## Como Usar  
1. Acesse a plataforma pelo browser em `http://localhost:3000` após iniciar o servidor.  
2. Faça login com uma conta de estudante, professor ou coordenador.  
3. Registe uma tese ou gere defesas conforme seu perfil de utilizador.  
4. Utilize o calendário para agendar defesas e acompanhe os relatórios gerados.  

## Roadmap    
- [ ] Suporte a múltiplos idiomas.  
- [ ] Exportação de relatórios em PDF.  
- [ ] Painel de estatísticas para coordenadores.  

## Autores  
- **Afonso Fernandes**  
- **Pedro Correia** - [GitHub](https://github.com/PedroCorreiaaa)     