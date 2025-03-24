const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function connect() {
    try {
        await pool.connect();
    } catch (err) {
        console.error("Erro ao conectar à base de dados:", err);
        process.exit(1);
    }
}

async function close() {
    try {
        await pool.end();
        console.log("Conexão à base de dados fechada.");
    } catch (err) {
        console.error("Erro ao fechar a conexão à base de dados:", err);
    }
}

async function query(queryText, values) {
    try {
        console.log("Executando consulta:", queryText);
        const result = await pool.query(queryText, values);
        console.log("Consulta executada com sucesso.");
        return result;
    } catch (err) {
        console.error("Erro na consulta:", err);
        throw err;
    }
}

module.exports = {
    pool,
    connect,
    close,
    query,
};
