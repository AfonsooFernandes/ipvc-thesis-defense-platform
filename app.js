const express = require("express");
const cors = require("cors");
const fs = require("fs");
const JSZip = require("jszip");
const path = require("path");
const FormData = require("form-data");
const fetch = require("node-fetch");
const db = require("./db");
const auth = require("./auth");
require("dotenv").config();
const { authenticateToken } = require('./auth'); 
const multer = require('multer');
const storage = multer.memoryStorage(); 
const upload = multer({ storage: storage })

const app = express();
const corsOptions = {
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

db.connect()
    .then(() => console.log("Conexão à base de dados estabelecida com sucesso."))
    .catch(err => console.error("Erro ao conectar à base de dados:", err.stack));   



app.listen(3000, () => {
    console.log("http://localhost:3000");
    });




// Gets para enviar carregar os ficheiros do frontend    
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "public/dashboard", "dashboard.html"));
});

app.get("/tese/:id_tese", (req, res) => {
    res.sendFile(path.join(__dirname, "public/tese", "tese.html"));
});

app.get("/tese/:id_tese/provas-parecer", (req, res) => {
    res.sendFile(path.join(__dirname, "public/provas-parecer/provas-parecer.html"));
});

app.get("/registar-tese", (req, res) => {
    res.sendFile(path.join(__dirname, "public/registar-tese", "registar-tese.html"));
});




// Carregar as teses para cada user
app.post('/dashboard', authenticateToken, async (req, res) => {
    console.log(req.body);  // Verifique se os filtros estão sendo recebidos corretamente

    const { userId, userType } = req.user;
    const { estadoTese, anoLetivo, dataDefesa } = req.body;  // Obtenha os filtros passados na requisição

    try {
        let result;
        let params = [userId];  // Inicializando com o userId para as queries
        let queryCondition = '';  // Inicializa com a primeira condição

        // Verificando filtros e adicionando parâmetros de forma dinâmica
        if (estadoTese) {
            params.push(estadoTese);  // Adiciona o estado da tese como parâmetro
            queryCondition += ` AND tese.id_estado = $${params.length}`;  // Usa o índice correto para o parâmetro
        }
        if (anoLetivo) {
            params.push(anoLetivo);
            queryCondition += ` AND alm.ano_letivo = $${params.length}`;
        }
        if (dataDefesa) {
            params.push(dataDefesa);
            queryCondition += ` AND tese.data_defesa::date = $${params.length}`;
        }

        console.log("Query Condition:", queryCondition);
        console.log("Parâmetros:", params);

        // Query para Alunos
        if (userType === 'aluno') {
            result = await db.query(`
                SELECT
                    tese.titulo_pt,
                    tese.data_defesa,
                    tese.id_tese,
                    tese.resumo AS resumo,
                    tese.nota_final AS nota,
                    aluno.nome AS aluno_nome,
                    mestrado.nome AS mestrado_nome,
                    mestrado.sigla AS mestrado_sigla,
                    estado_tese.descricao AS estado_descricao,
                    ARRAY_AGG(professor.nome) AS orientadores_nomes
                FROM
                    tese
                INNER JOIN
                    estado_tese ON tese.id_estado = estado_tese.id_estado_tese
                INNER JOIN
                    aluno ON tese.id_aluno = aluno.id_aluno
                INNER JOIN
                    ano_letivo_mestrado alm ON aluno.id_aluno = alm.id_aluno
                INNER JOIN
                    mestrado ON alm.id_mestrado = mestrado.id_mestrado
                LEFT JOIN
                    orientador_tese ON tese.id_tese = orientador_tese.id_tese
                LEFT JOIN
                    professor ON orientador_tese.id_professor = professor.id_professor
                WHERE
                    tese.id_aluno = $1
                    ${queryCondition}
                GROUP BY
                    tese.titulo_pt, tese.data_defesa, tese.id_tese, tese.resumo,
                    aluno.nome, mestrado.nome, mestrado.sigla, estado_tese.descricao;`,
                params
            );
        } else if (userType === 'professor') {
            result = await db.query(`
                SELECT
                    tese.titulo_pt,
                    tese.data_defesa,
                    tese.id_tese,
                    tese.resumo AS resumo,
                    aluno.nome AS aluno_nome,
                    estado_tese.descricao AS estado_descricao,
                    mestrado.nome AS mestrado_nome,
                    mestrado.sigla AS mestrado_sigla,
                    ARRAY_AGG(DISTINCT professor.nome) AS orientadores_nomes,
                    CASE
                        WHEN orientador_tese.id_professor IS NOT NULL THEN 'Orientador'
                        WHEN elemento_juri.id_professor IS NOT NULL THEN 'Júri'
                        ELSE NULL
                    END AS papel,
                    orientador_tese.data_despacho,
                    orientador_tese.data_aceitacao
                FROM
                    tese
                INNER JOIN
                    estado_tese ON tese.id_estado = estado_tese.id_estado_tese
                INNER JOIN
                    aluno ON tese.id_aluno = aluno.id_aluno
                INNER JOIN
                    ano_letivo_mestrado alm ON aluno.id_aluno = alm.id_aluno
                INNER JOIN
                    mestrado ON alm.id_mestrado = mestrado.id_mestrado
                LEFT JOIN
                    orientador_tese ON tese.id_tese = orientador_tese.id_tese
                LEFT JOIN
                    professor ON orientador_tese.id_professor = professor.id_professor
                LEFT JOIN
                    juri ON tese.id_tese = juri.id_tese
                LEFT JOIN
                    elemento_juri ON juri.id_juri = elemento_juri.id_juri AND elemento_juri.id_professor = $1
                WHERE
                    (orientador_tese.id_professor = $1 OR elemento_juri.id_professor = $1)
                    ${queryCondition}
                GROUP BY
                    tese.titulo_pt, tese.data_defesa, tese.id_tese, tese.resumo, aluno.nome,
                    estado_tese.descricao, mestrado.nome, mestrado.sigla,
                    orientador_tese.id_professor, elemento_juri.id_professor, orientador_tese.data_despacho, orientador_tese.data_aceitacao;`,
                params
            );
        } else if (userType === 'coordenador_mestrado') {
            result = await db.query(`
                SELECT
                    tese.titulo_pt,
                    tese.data_defesa,
                    tese.id_tese,
                    tese.resumo AS resumo,
                    aluno.nome AS aluno_nome,
                    estado_tese.descricao AS estado_descricao,
                    mestrado.nome AS mestrado_nome,
                    mestrado.sigla AS mestrado_sigla,
                    ARRAY_AGG(professor.nome) AS orientadores_nomes
                FROM
                    tese
                INNER JOIN
                    aluno ON tese.id_aluno = aluno.id_aluno
                INNER JOIN
                    estado_tese ON tese.id_estado = estado_tese.id_estado_tese
                INNER JOIN
                    ano_letivo_mestrado alm ON aluno.id_aluno = alm.id_aluno
                INNER JOIN
                    mestrado ON alm.id_mestrado = mestrado.id_mestrado
                INNER JOIN
                    coordenador_mestrado cm ON mestrado.id_mestrado = cm.id_mestrado
                LEFT JOIN
                    orientador_tese ON tese.id_tese = orientador_tese.id_tese
                LEFT JOIN
                    professor ON orientador_tese.id_professor = professor.id_professor
                WHERE
                    cm.id_professor = $1
                    AND (cm.data_fim IS NULL OR cm.data_fim > CURRENT_DATE)
                    ${queryCondition}
                GROUP BY
                    tese.titulo_pt, tese.data_defesa, tese.id_tese, tese.resumo,
                    aluno.nome, estado_tese.descricao, mestrado.nome, mestrado.sigla;`,
                params
            );
        } else {
            return res.status(403).json({ message: "Tipo de usuário inválido." });
        }

        if (!result.rows.length) {
            return res.status(200).json({ message: "Nenhum dado encontrado.", data: [] });
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Erro ao carregar o dashboard:", err);
        res.status(500).json({ message: "Erro ao carregar o dashboard." });
    }
});

// Processar pedidos de orientação
app.post("/aceitar-tese/:id_tese", authenticateToken, async (req, res) => {
    const id_tese = req.params.id_tese;
    const id_professor = req.user.userId;
    const dataFormatada = new Date().toISOString().split('T')[0];
    const id_tipo_documento = 1;
    try {
        db.query(
            `UPDATE orientador_tese 
                SET data_aceitacao = $3
            WHERE id_tese = $1 AND id_professor = $2
            `,
            [id_tese, id_professor,dataFormatada]
        );

        const result = await db.query(
            `SELECT 
            tese.titulo_pt AS titulo,
            aluno.n_cc AS n_cc_aluno,
            aluno.nome AS nome_aluno,
            aluno.numero AS n_aluno,
            aluno.ano AS ano_aluno,
            mestrado.nome AS nome_mestrado
            FROM tese
            JOIN aluno ON tese.id_aluno = aluno.id_aluno
            JOIN ano_letivo_mestrado ON aluno.id_aluno = ano_letivo_mestrado.id_aluno
            JOIN mestrado ON ano_letivo_mestrado.id_mestrado = mestrado.id_mestrado
            WHERE tese.id_tese = $1
            `,
            [id_tese]
        );

        const { titulo, n_cc_aluno, nome_aluno, n_aluno, ano_aluno, nome_mestrado} = result.rows[0];

        const templateData = {
            nome_aluno, 
            n_cc_aluno,
            n_aluno,
            ano_aluno,
            nome_mestrado,
            titulo, 
            data_aceitacao: dataFormatada
        };

        console.log("Dados para substituição no template:", templateData);


        const docxBuffer = await generateDocx("ACA-14-01-IMP-Proposta_dissertacao.docx", templateData);

        const docId = await saveDocumentToDatabase({
            id_tese,
            id_tipo_documento,
            nome_aluno,
            ficheiro: docxBuffer,
            extensao: "docx",
        });

        const pdfBuffer = await convertDocxToPdf(docxBuffer);

        const pdfId = await saveDocumentToDatabase({
            id_tese,
            id_tipo_documento,
            nome_aluno,
            ficheiro: pdfBuffer,
            extensao: "pdf",
        });

        const tituloDocumento = `${await getTipoDocumentoDescricao(id_tipo_documento)}_${nome_aluno}`;

        res.json({ pdfBuffer: pdfBuffer.toString("base64"), tituloDocumento });


    } catch (err) {
        console.error("Erro ao aceitar tese:", err);
        res.status(500).json({ message: "Erro ao aceitar tese." });
    }
})

app.post("/rejeitar-tese/:id_tese", authenticateToken, async (req, res) => {
    const id_tese = req.params.id_tese;
    const id_professor = req.user.userId;
    try {
        db.query(
            `DELETE FROM orientador_tese
            WHERE id_tese = $1 AND id_professor = $2
            `,
            [id_tese, id_professor]
        );
    } catch (err) {
        console.error("Erro ao rejeitar tese:", err);
        res.status(500).json({ message: "Erro ao rejeitar tese." });
    }
})




// Carregar página de uma tese
app.post("/tese/:id_tese", authenticateToken, async (req, res) => {
    const { id_tese } = req.params;
    const { userId, userType } = req.user;

    if (userType !== 'professor' && userType !== 'coordenador_mestrado') {
        return res.status(403).json({ message: "Acesso proibido. Somente professores ou coordenadores podem acessar os detalhes da tese." });
    }

    try {
        let query = '';
        let params = [];

        if (userType === 'coordenador_mestrado') {
            query = `
                SELECT 
                    tese.titulo_pt, 
                    tese.data_defesa, 
                    tese.id_tese,
                    tese.resumo AS resumo,
                    tese.nota_final AS nota,
                    aluno.nome AS aluno_nome,
                    estado_tese.descricao AS estado_tese_descricao, 
                    mestrado.nome AS mestrado_nome,
                    mestrado.sigla AS mestrado_sigla,
                    ARRAY_AGG(professor.nome) AS orientadores_nomes,
                    j.id_estado_juri AS estado_juri_id,
                    ARRAY_AGG(
                        JSON_BUILD_OBJECT(
                            'id_professor', ej.id_professor,
                            'id_cargo', ej.id_cargo,
                            'professor_nome', p.nome,
                            'cargo_descricao', c.descricao,
                            'observacoes', ej.observacoes,
                            'nota', ej.nota,
                            'id_juri', ej.id_juri
                        )
                    ) AS jurados,
                    ej_state.descricao AS estado_juri_descricao
                FROM 
                    tese
                INNER JOIN 
                    aluno ON tese.id_aluno = aluno.id_aluno
                INNER JOIN 
                    estado_tese ON tese.id_estado = estado_tese.id_estado_tese
                INNER JOIN 
                    ano_letivo_mestrado alm ON aluno.id_aluno = alm.id_aluno
                INNER JOIN 
                    mestrado ON alm.id_mestrado = mestrado.id_mestrado
                INNER JOIN 
                    coordenador_mestrado cm ON mestrado.id_mestrado = cm.id_mestrado
                LEFT JOIN 
                    orientador_tese ON tese.id_tese = orientador_tese.id_tese
                LEFT JOIN 
                    professor ON orientador_tese.id_professor = professor.id_professor
                LEFT JOIN 
                    juri j ON tese.id_tese = j.id_tese
                LEFT JOIN 
                    elemento_juri ej ON j.id_juri = ej.id_juri
                LEFT JOIN 
                    professor p ON ej.id_professor = p.id_professor
                LEFT JOIN 
                    cargo_elemento c ON ej.id_cargo = c.id_cargo
                LEFT JOIN 
                    estado_juri ej_state ON j.id_estado_juri = ej_state.id_estado_juri
                WHERE 
                    cm.id_professor = $1 
                    AND (cm.data_fim IS NULL OR cm.data_fim > CURRENT_DATE)
                    AND tese.id_tese = $2
                GROUP BY 
                    tese.titulo_pt, tese.data_defesa, tese.id_tese, tese.resumo, 
                    aluno.nome, estado_tese.descricao, mestrado.nome, mestrado.sigla, 
                    j.id_estado_juri, ej_state.descricao;
            `;
            params = [userId, id_tese];
        } else if (userType === 'professor') {
            query = `
                SELECT 
                    tese.titulo_pt, 
                    tese.data_defesa, 
                    tese.id_tese,
                    tese.resumo AS resumo,
                    tese.nota_final AS nota,
                    aluno.nome AS aluno_nome,
                    estado_tese.descricao AS estado_tese_descricao, 
                    mestrado.nome AS mestrado_nome,
                    mestrado.sigla AS mestrado_sigla,
                    ARRAY_AGG(professor.nome) AS orientadores_nomes,
                    j.id_estado_juri AS estado_juri_id,
                    ARRAY_AGG(
                        JSON_BUILD_OBJECT(
                            'id_professor', ej.id_professor,
                            'id_cargo', ej.id_cargo,
                            'professor_nome', p.nome,
                            'cargo_descricao', c.descricao,
                            'observacoes', ej.observacoes,
                            'nota', ej.nota,
                            'id_juri', ej.id_juri
                        )
                    ) AS jurados,
                    ej_state.descricao AS estado_juri_descricao
                FROM 
                    tese
                INNER JOIN 
                    aluno ON tese.id_aluno = aluno.id_aluno
                INNER JOIN 
                    estado_tese ON tese.id_estado = estado_tese.id_estado_tese
                INNER JOIN 
                    ano_letivo_mestrado alm ON aluno.id_aluno = alm.id_aluno
                INNER JOIN 
                    mestrado ON alm.id_mestrado = mestrado.id_mestrado
                LEFT JOIN 
                    orientador_tese ON tese.id_tese = orientador_tese.id_tese
                LEFT JOIN 
                    professor ON orientador_tese.id_professor = professor.id_professor
                LEFT JOIN 
                    juri j ON tese.id_tese = j.id_tese
                LEFT JOIN 
                    elemento_juri ej ON j.id_juri = ej.id_juri
                LEFT JOIN 
                    professor p ON ej.id_professor = p.id_professor
                LEFT JOIN 
                    cargo_elemento c ON ej.id_cargo = c.id_cargo
                LEFT JOIN 
                    estado_juri ej_state ON j.id_estado_juri = ej_state.id_estado_juri
                WHERE 
                    (orientador_tese.id_professor = $1 OR ej.id_professor = $1)  -- Verifica se o professor é orientador ou membro do juri
                    AND tese.id_tese = $2
                GROUP BY 
                    tese.titulo_pt, tese.data_defesa, tese.id_tese, tese.resumo, 
                    aluno.nome, estado_tese.descricao, mestrado.nome, mestrado.sigla, 
                    j.id_estado_juri, ej_state.descricao;
            `;
            params = [userId, id_tese];
        }

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Tese não encontrada ou acesso não autorizado." });
        }

        res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error("Erro ao acessar as informações da tese:", err);
        res.status(500).json({ message: "Erro ao acessar as informações da tese." });
    }
});

    // Carregar documentos de uma tese
app.get("/tese/:id_tese/documentos/download/:fileName/:fileExtension", authenticateToken, async (req, res) => {
    const { id_tese, fileName, fileExtension } = req.params; 
    const { userType } = req.user;

    console.log(`Recebido pedido para download: id_tese = ${id_tese}, fileName = ${fileName}, fileExtension = ${fileExtension}`);
    console.log(`Tipo de usuário: ${userType}`);

    if (userType == 'coordenador_mestrado' || userType == 'professor') {
        try {
            const result = await db.query(
                `SELECT ficheiro, extensao FROM documento WHERE id_tese = $1 AND titulo = $2 AND extensao = $3`,
                [id_tese, fileName, fileExtension]
            );
    
            if (result.rows.length === 0) {
                return res.status(404).send('Documento não encontrado.');
            }
    
            const document = result.rows[0];
            const fileBuffer = document.ficheiro;
    
            const mimeType = getMimeType(document.extensao);
    
            console.log(`Documento encontrado: ${fileName}.${fileExtension}, Tipo de Extensão: ${document.extensao}`);
    
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}.${fileExtension}"`);
            res.send(fileBuffer);
    
        } catch (err) {
            console.error("Erro ao carregar o arquivo:", err);
            res.status(500).send("Erro ao carregar o arquivo.");
        }
    }
    else{
        return res.status(403).json({ message: "Acesso proibido. Somente coordenadores de mestrado podem acessar os documentos da tese." });
    }

});

    // Upload de documentos
app.post("/tese/:id_tese/upload-documento", authenticateToken, upload.single('file'), async (req, res) => {
    const documento = req.file;
    const { id_tipo_documento } = req.body;
    const { id_tese } = req.params;

    if (!documento || !id_tese || !id_tipo_documento) {
        return res.status(400).json({ message: "Todos os campos obrigatórios devem estar preenchidos." });
    }

    const nomeAlunoResult = await db.query('SELECT aluno.nome FROM tese JOIN aluno ON tese.id_aluno = aluno.id_aluno WHERE id_tese = $1', [id_tese]);
    const nome_aluno = nomeAlunoResult.rows[0]?.nome;
    const extensao = path.extname(documento.originalname).toLowerCase();
    const nomeArquivo = `${nome_aluno}-${documento.originalname}`;

    if(id_tipo_documento == 8){

        const buffer = documento.buffer;

        const documentoData = {
            id_tese,
            id_tipo_documento,
            nome_aluno: nome_aluno,
            ficheiro: buffer,
            extensao: extensao.slice(1),
            nome_arquivo: nomeArquivo
        };

        const resultDocumento = await saveDocumentToDatabase(documentoData);
        db.query('UPDATE orientador_tese SET data_aceitacao = CURRENT_DATE WHERE id_tese = $1', [id_tese]);
    }
    if(id_tipo_documento == 10){

        const buffer = documento.buffer;

        const documentoData = {
            id_tese,
            id_tipo_documento,
            nome_aluno: nome_aluno,
            ficheiro: buffer,
            extensao: extensao.slice(1),
            nome_arquivo: nomeArquivo
        };

        const resultDocumento = await saveDocumentToDatabase(documentoData);
        db.query('UPDATE tese SET data_despacho_defesa = CURRENT_DATE WHERE id_tese = $1', [id_tese]);
        db.query('UPDATE tese SET id_estado = 9 WHERE id_tese = $1', [id_tese]);


    }

    if(id_tipo_documento == 15){

        const buffer = documento.buffer;

        const documentoData = {
            id_tese,
            id_tipo_documento,
            nome_aluno: nome_aluno,
            ficheiro: buffer,
            extensao: extensao.slice(1),
            nome_arquivo: nomeArquivo
        };

        const resultDocumento = await saveDocumentToDatabase(documentoData);
        db.query('UPDATE tese SET data_aceitacao_pedido_proposta = CURRENT_DATE WHERE id_tese = $1', [id_tese]);
        db.query('UPDATE tese SET id_estado = 3 WHERE id_tese = $1', [id_tese]);


    }

    if(id_tipo_documento == 12){

        const buffer = documento.buffer;

        const documentoData = {
            id_tese,
            id_tipo_documento,
            nome_aluno: nome_aluno,
            ficheiro: buffer,
            extensao: extensao.slice(1),
            nome_arquivo: nomeArquivo
        };

        const resultDocumento = await saveDocumentToDatabase(documentoData);
        db.query('UPDATE juri SET data_aceitacao = CURRENT_DATE WHERE id_tese = $1', [id_tese]);
        db.query('UPDATE juri SET id_estado_juri = 3 WHERE id_tese = $1', [id_tese]);


    }

    if(id_tipo_documento == 9 || id_tipo_documento == 11 || id_tipo_documento == 14){
         
        const buffer = documento.buffer;

        const documentoData = {
            id_tese,
            id_tipo_documento,
            nome_aluno: nome_aluno,
            ficheiro: buffer,
            extensao: extensao.slice(1),
            nome_arquivo: nomeArquivo
        };

        const resultDocumento = await saveDocumentToDatabase(documentoData);
        db.query('UPDATE juri SET nota_validada = true WHERE id_tese = $1', [id_tese]);
    }

    res.status(201).json({ message: "Documento enviado com sucesso." });
    
})

    // Registar provas e pareceres de uma tese
app.post("/tese/:id_tese/registar-provas-parecer", authenticateToken, async (req, res) => {
    const { id_tese } = req.params;
    const { userId, userType } = req.user;
    const { observacoes, nota } = req.body;
    console.log("id_tese:", id_tese);

    if (userType !== 'coordenador_mestrado' && userType !== 'professor') {
        return res.status(403).json({ message: "Acesso proibido." });
    }

    try {
        const result = await db.query(
            `SELECT id_juri FROM juri WHERE id_tese = $1`,
            [id_tese]
        );

        const id_juri = result.rows[0]?.id_juri;
        if (!id_juri) {
            return res.status(404).json({ message: "Juri não encontrado para esta tese." });
        }

        await db.query(
            `UPDATE elemento_juri SET observacoes = $1, nota = $2 WHERE id_professor = $3 AND id_juri = $4`,
            [observacoes, nota, userId, id_juri]
        );

        res.status(200).json({ message: "Prova de parecer registrada com sucesso." });

    } catch (err) {
        console.error("Erro ao registrar prova de parecer:", err);
        res.status(500).json({ message: "Erro ao registrar prova de parecer." });
    }
});
    // Registar data de defesa
app.post("/tese/:id_tese/registar-data-defesa", authenticateToken, async (req, res) => {
    try {
        const { id_tese } = req.params;
        const {data_entrega } = req.body;

        if (!id_tese || !data_entrega) {
            return res.status(400).json({ message: "Todos os campos obrigatórios devem estar preenchidos." });
        }  

        const dataFormatada = new Date(data_entrega).toISOString().split('T')[0];
        await db.query('UPDATE tese SET data_despacho_defesa = $1, data_defesa = $2, id_estado = 4 WHERE id_tese = $3', [dataFormatada, data_entrega, id_tese]);

        res.status(200).json({ message: "Data de defesa registrada com sucesso!" });
    } catch (err) {
        console.error("Erro ao registrar data de defesa:", err);
        res.status(500).json({ message: "Erro ao registrar data de defesa." });
    } 
    
});

    // Gerar Documentos
app.post("/tese/:id_tese/gerar-atas-provas", authenticateToken, async (req, res) => {
    try {
        const { id_tese } = req.params;

        if (!id_tese) {
            return res.status(400).json({ message: "Todos os campos obrigatórios devem estar preenchidos." });
        }

        const id_juriResult = await db.query('SELECT id_juri FROM juri WHERE id_tese = $1', [id_tese]);
        const id_juri = id_juriResult.rows[0]?.id_juri;

        if (!id_juri) {
            console.error("Não foi possível encontrar o id_juri para o id_tese:", id_tese);
            return res.status(500).send("Erro: id_juri não encontrado.");
        }

        const { rows } = await db.query('SELECT AVG(nota) FROM elemento_juri WHERE id_juri = $1', [id_juri]);


        let nota = rows[0]?.avg;
        
        
        console.log("Nota calculada:", nota);  
        
        nota = parseFloat(nota).toFixed(2); 
        


        await db.query('UPDATE tese SET nota_final = $1 WHERE id_tese = $2', [nota, id_tese]);
        await db.query('UPDATE juri SET data_provas = CURRENT_DATE WHERE id_tese = $1', [id_tese]);

        let resultado = "";
        if (nota >= 9.5) {
            resultado = "Aprovado";
            await db.query('UPDATE tese SET id_estado = 6 WHERE id_tese = $1', [id_tese]);
        } else {
            resultado = "Reprovado";
            await db.query('UPDATE tese SET id_estado = 7 WHERE id_tese = $1', [id_tese]);
        }

        const nota_extenso = atualizarNotaPorExtenso(nota);

        const result = await db.query(`
            SELECT aluno.nome AS nome_candidato, mestrado.nome AS nome_curso
            FROM tese 
            JOIN aluno ON tese.id_aluno = aluno.id_aluno
            JOIN ano_letivo_mestrado ON aluno.id_aluno = ano_letivo_mestrado.id_aluno
            JOIN mestrado ON ano_letivo_mestrado.id_mestrado = mestrado.id_mestrado
            WHERE tese.id_tese = $1
        `, [id_tese]);

        const nome_candidato = result.rows[0].nome_candidato;
        const nome_aluno = nome_candidato;

        const nome_curso = result.rows[0].nome_curso;

        const result2 = await db.query(`
            SELECT STRING_AGG(observacoes, ', ') AS observacoes
            FROM elemento_juri
            WHERE elemento_juri.id_juri = $1
        `, [id_juri]);

        const obs = result2.rows[0].observacoes;

        const result3 = await db.query(`
            SELECT 
                MAX(CASE WHEN cargo_elemento.descricao = 'Presidente' THEN professor.nome END) AS nome_presidente,
                MAX(CASE WHEN cargo_elemento.descricao = 'Vogal' THEN professor.nome END) AS nome_vogal1,
                MAX(CASE WHEN cargo_elemento.descricao = 'Arguente' THEN professor.nome END) AS nome_vogal2
            FROM juri
            JOIN elemento_juri ON juri.id_juri = elemento_juri.id_juri
            JOIN professor ON elemento_juri.id_professor = professor.id_professor
            JOIN cargo_elemento ON elemento_juri.id_cargo = cargo_elemento.id_cargo
            WHERE juri.id_tese = $1
            GROUP BY juri.id_tese
        `, [id_tese]);

        const nome_presidente = result3.rows[0].nome_presidente;
        const nome_vogal1 = result3.rows[0].nome_vogal1;
        const nome_vogal2 = result3.rows[0].nome_vogal2;
        const data = new Date();
        const dataFormatada = data.toISOString().split('T')[0];


        let id_tipo_documento = 4;

        let templateData = {
            nome_curso,
            nome_candidato,
            obs,
            resultado,
            nota,
            nota_extenso,
            data: dataFormatada,
            nome_presidente,
            nome_vogal1,
            nome_vogal2,
        };

        let docxBuffer = await generateDocx("EX_Provas_MEI_parecer.docx", templateData);
        await saveDocumentToDatabase({
            id_tese,
            id_tipo_documento,
            nome_aluno,
            ficheiro: docxBuffer,
            extensao: "docx",   
        });

        let pdfBuffer = await convertDocxToPdf(docxBuffer);
        await saveDocumentToDatabase({
            id_tese,
            id_tipo_documento,
            nome_aluno,
            ficheiro: pdfBuffer,
            extensao: "pdf",
        });

        // Documento 2
        id_tipo_documento = 2;
        const result4 = await db.query('SELECT data_defesa, titulo_pt AS titulo FROM tese WHERE id_tese = $1', [id_tese]);
        const { data_defesa, titulo } = result4.rows[0];
        const data_extenso = dataPorExtenso(data_defesa);
        const result5 = await db.query('SELECT data_aceitacao FROM juri WHERE id_tese = $1', [id_tese]);
        const data_aceitacao = result5.rows[0].data_aceitacao;
        const data_aceitacao_extenso = dataPorExtenso(data_aceitacao);

        templateData = {
            nome_curso,
            nome_candidato,
            data_extenso,
            nome_presidente,
            nome_vogal1,
            nome_vogal2,
            data_aceitacao: data_aceitacao_extenso,
            titulo,
            resultado_relatorio: resultado,
        };

        docxBuffer = await generateDocx("EX_Provas_MEI_acta1.docx", templateData);
        await saveDocumentToDatabase({
            id_tese,
            id_tipo_documento,
            nome_aluno,
            ficheiro: docxBuffer,
            extensao: "docx",
        });

        pdfBuffer = await convertDocxToPdf(docxBuffer);
        await saveDocumentToDatabase({
            id_tese,
            id_tipo_documento,
            nome_aluno,
            ficheiro: pdfBuffer,
            extensao: "pdf",
        });

        // Documento 3
        id_tipo_documento = 13;
        templateData = {
            nome_curso,
            nome_presidente,
            nome_candidato,
            data_extenso,
            nome_vogal1,
            nome_vogal2,
            data_aceitacao: data_aceitacao_extenso,
            titulo,
            resultado,
            nota,
            nota_extenso,
        };

        docxBuffer = await generateDocx("EX_Provas_acta2.docx", templateData);
        await saveDocumentToDatabase({
            id_tese,
            id_tipo_documento,
            nome_aluno,
            ficheiro: docxBuffer,
            extensao: "docx",
        });

        pdfBuffer = await convertDocxToPdf(docxBuffer);
        await saveDocumentToDatabase({
            id_tese,
            id_tipo_documento,
            nome_aluno,
            ficheiro: pdfBuffer,
            extensao: "pdf",
        });

        res.status(200).send("Documentos gerados com sucesso.");
    } catch (error) {
        console.error("Erro ao gerar ou converter o documento", error);
        res.status(500).send("Erro ao gerar o documento ou converter para PDF.");
    }
});

app.post("/tese/:id_tese/proposta_juri", async (req, res) => {
    try {
        const {id_tese} = req.params;
        const { nome_presidente, nome_arguente, nome_vogal, instituicao_arguente, email_arguente, doutorado_arguente, curriculum_arguente } = req.body;
        const id_tipo_documento = 5;

        let result = await db.query(`
            SELECT
                t.id_tese,
                t.titulo_pt AS titulo,
                t.id_aluno,
                a.nome AS nome_aluno,
                a.numero AS n_aluno,
                m.nome AS nome_mestrado,
                p.nome AS nome_coordenador
            FROM tese t
            JOIN aluno a ON t.id_aluno = a.id_aluno
            JOIN ano_letivo_mestrado alm ON a.id_aluno = alm.id_aluno
            JOIN mestrado m ON alm.id_mestrado = m.id_mestrado
            JOIN coordenador_mestrado cm ON m.id_mestrado = cm.id_mestrado
            JOIN professor p ON cm.id_professor = p.id_professor
            WHERE t.id_tese = $1
            AND cm.data_fim > CURRENT_DATE
            AND cm.data_ini <= CURRENT_DATE
        `, [id_tese]);

        if (result.rows.length === 0) {
            throw new Error("Tese não encontrada");
        }

        const { titulo, nome_aluno, n_aluno, nome_mestrado, nome_coordenador } = result.rows[0];

        if (nome_arguente) {
            console.log("Nome do arguente:", nome_arguente);
            
            if (instituicao_arguente && email_arguente && doutorado_arguente !== undefined && curriculum_arguente) {
                const instituicaoResult = await db.query(`
                    SELECT id_instituicao FROM instituicao WHERE sigla = $1
                `, [instituicao_arguente]);

                if (instituicaoResult.rows.length === 0) {
                    throw new Error("Instituição não encontrada");
                }

                const id_instituicao_arguente = instituicaoResult.rows[0].id_instituicao;

                await db.query(`
                    INSERT INTO professor(
                        nome,
                        curriculum,
                        id_instituicao,
                        email,
                        doutorado,
                        password
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6
                    )`, [
                        nome_arguente, curriculum_arguente || '', id_instituicao_arguente,
                        email_arguente || '', doutorado_arguente || false, "$2b$10$rgsiDbVNgwfb7JlDKZhyLeXXBtO9oN4zs6EwZPFUOXywVhc//eAYW"
                    ]);
            }
        }

        if (!nome_presidente) {
            throw new Error("Nome do presidente não fornecido");
        }

        if (!nome_vogal) {
            throw new Error("Nome do vogal não fornecido");
        }

        
        const data = new Date();
        const dataFormatada = data.toISOString().split('T')[0];

        const templateData = {
            titulo, 
            nome_aluno,
            n_aluno,
            nome_mestrado,
            nome_presidente,
            categoria_profissional_presidente: "", 
            nome_arguente,
            categoria_profissional_arguente: "",
            curriculum_arguente,
            nome_vogal,  
            categoria_profissional_vogal: "", 
            data: dataFormatada,
            nome_coordenador,
        };

        console.log("Dados para substituição no template:", templateData);


        const docxBuffer = await generateDocx("Ex_PropostaConstituicaoJuri_CTC.docx", templateData);

        const docId = await saveDocumentToDatabase({
            id_tese,
            id_tipo_documento,
            nome_aluno,
            ficheiro: docxBuffer,
            extensao: "docx",
        });

        const pdfBuffer = await convertDocxToPdf(docxBuffer);

        const pdfId = await saveDocumentToDatabase({
            id_tese,
            id_tipo_documento,
            nome_aluno,
            ficheiro: pdfBuffer,
            extensao: "pdf",
        });

        const tituloDocumento = `${await getTipoDocumentoDescricao(id_tipo_documento)}_${nome_aluno}`;

        res.json({ pdfBuffer: pdfBuffer.toString("base64"), tituloDocumento });
        const data_formatada = new Date().toISOString().split('T')[0];

        try {
            const id_juri_result = await db.query(
                'INSERT INTO juri (id_tese, id_estado_juri, data_despacho) VALUES ($1, $2, $3) RETURNING id_juri',
                [id_tese, 1, data_formatada]
            );
            const id_juri = id_juri_result.rows[0]?.id_juri;
        
            if (!id_juri) {
                throw new Error('Erro ao obter o ID do júri.');
            }
        
            const id_presidente_result = await db.query('SELECT id_professor FROM professor WHERE nome = $1', [nome_presidente]);
            const id_arguente_result = await db.query('SELECT id_professor FROM professor WHERE nome = $1', [nome_arguente]);
            const id_vogal_result = await db.query('SELECT id_professor FROM professor WHERE nome = $1', [nome_vogal]);
        
            const id_presidente = id_presidente_result.rows[0]?.id_professor;
            const id_arguente = id_arguente_result.rows[0]?.id_professor;
            const id_vogal = id_vogal_result.rows[0]?.id_professor;
        
            if (!id_presidente || !id_arguente || !id_vogal) {
                throw new Error('Erro ao obter IDs de professores.');
            }
        
            await db.query('INSERT INTO elemento_juri(id_professor, id_juri, id_cargo) VALUES ($1, $2, $3)', [id_presidente, id_juri, 1]);
            await db.query('INSERT INTO elemento_juri(id_professor, id_juri, id_cargo) VALUES ($1, $2, $3)', [id_arguente, id_juri, 2]);
            await db.query('INSERT INTO elemento_juri(id_professor, id_juri, id_cargo) VALUES ($1, $2, $3)', [id_vogal, id_juri, 3]);
        
            console.log('Dados inseridos com sucesso!');
        } catch (error) {
            console.error('Erro ao inserir os dados:', error);
        }

    } catch (error) {
        console.error("Erro ao gerar ou converter o documento", error);
    }
});

// Registar tese
app.post('/registar-tese', upload.single('documento'), async (req, res) => {
    const { titulo_pt, titulo_en, resumo, id_aluno, nome_aluno, id_orientador, nome_orientador } = req.body;
    const documento = req.file;

    if (!titulo_pt || !titulo_en || !resumo || !id_aluno || !nome_aluno || !documento || !id_orientador || !nome_orientador) {
        return res.status(400).json({ message: "Todos os campos são obrigatórios." });
    }

    const extensao = path.extname(documento.originalname).toLowerCase();
    if (extensao !== '.pdf') {
        return res.status(400).json({ message: "O arquivo deve ser um PDF." });
    }

    try {

        const resultTese = await db.query(
            `INSERT INTO tese (titulo_pt, titulo_en, resumo, id_aluno, data_despacho_pedido_proposta) 
             VALUES ($1, $2, $3, $4, CURRENT_DATE) 
             RETURNING id_tese`,
            [titulo_pt, titulo_en, resumo, id_aluno]
        );

        const idTese = resultTese.rows[0].id_tese;

        const nomeArquivo = `${nome_aluno}-${documento.originalname}`;
        const tipoDocumento = 3; 
        const buffer = documento.buffer;

        const documentoData = {
            id_tese: idTese,
            id_tipo_documento: tipoDocumento,
            nome_aluno: nome_aluno,
            ficheiro: buffer,
            extensao: extensao.slice(1),
            nome_arquivo: nomeArquivo
        };

        const resultDocumento = await saveDocumentToDatabase(documentoData);

        const dataFormatada = new Date().toISOString().split('T')[0];
        await db.query(
            'INSERT INTO orientador_tese (id_tese, id_professor, data_despacho) VALUES ($1, $2, $3)',
            [idTese, id_orientador, dataFormatada]
        );

        const result = await db.query(`
            SELECT 
                aluno.numero AS n_aluno,
                mestrado.nome AS nome_mestrado,
                professor.nome AS nome_coordenador
            FROM 
                tese
            JOIN 
                aluno 
                ON tese.id_aluno = aluno.id_aluno
            JOIN 
                ano_letivo_mestrado 
                ON aluno.id_aluno = ano_letivo_mestrado.id_aluno
            JOIN 
                mestrado 
                ON ano_letivo_mestrado.id_mestrado = mestrado.id_mestrado
            JOIN 
                coordenador_mestrado 
                ON mestrado.id_mestrado = coordenador_mestrado.id_mestrado
            JOIN 
                professor 
                ON coordenador_mestrado.id_professor = professor.id_professor
            WHERE 
                tese.id_tese = $1
        `, [idTese]);

        if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({ message: "Dados para geração do documento não encontrados." });
        }

        const {  n_aluno, nome_mestrado, nome_coordenador } = result.rows[0];

        const result2 = await db.query(`
            SELECT professor.nome AS nome_orientador 
            FROM tese 
            JOIN orientador_tese 
            ON tese.id_tese = orientador_tese.id_tese 
            JOIN professor 
            ON orientador_tese.id_professor = professor.id_professor 
            WHERE tese.id_tese = $1
        `, [idTese]);

        const { nome_orientador } = result2.rows[0];

        const templateData = {
            nome_aluno,
            n_aluno,
            nome_mestrado,
            titulo: titulo_pt, 
            dataFormatada,
            nome_coordenador,
            nome_orientador,
        };

        const docxBuffer = await generateDocx("ACA-14-03-IMP-Parecer_Orientador_R3.docx", templateData);

        await saveDocumentToDatabase({
            id_tese: idTese,
            id_tipo_documento: 6, 
            nome_aluno,
            ficheiro: docxBuffer,
            extensao: "docx",
        });

        const pdfBuffer = await convertDocxToPdf(docxBuffer);
        await saveDocumentToDatabase({
            id_tese: idTese,
            id_tipo_documento: 6, 
            nome_aluno,
            ficheiro: pdfBuffer,
            extensao: "pdf",
        });

        return res.status(201).json({
            message: 'Tese registrada e documento de entrega gerado com sucesso!',
            tese: resultTese.rows[0],
            documento: resultDocumento
        });
    } catch (error) {
        console.error('Erro ao registrar tese ou gerar documento:', error);
        return res.status(500).json({ message: "Erro ao registrar tese ou gerar documento." });
    }
});




//Gets à base de dados
app.get("/alunos-mestrado", authenticateToken, async (req, res) => {
    const { userId, userType } = req.user;

    if (userType !== 'coordenador_mestrado') {
        return res.status(403).json({ message: "Acesso proibido. Apenas coordenadores de mestrado podem acessar os alunos." });
    }

    try {
        const result = await db.query(
            `SELECT aluno.id_aluno, aluno.nome 
             FROM aluno
             JOIN ano_letivo_mestrado alm ON aluno.id_aluno = alm.id_aluno
             JOIN mestrado m ON alm.id_mestrado = m.id_mestrado
             JOIN coordenador_mestrado cm ON m.id_mestrado = cm.id_mestrado
             WHERE cm.id_professor = $1 AND (cm.data_fim IS NULL OR cm.data_fim > CURRENT_DATE)`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Nenhum aluno encontrado para este coordenador." });
        }

        res.status(200).json(result.rows);

    } catch (err) {
        console.error("Erro ao carregar alunos:", err);
        res.status(500).json({ message: "Erro ao carregar alunos." });
    }
});

app.get("/professores", authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id_professor, nome , email
             FROM professor`,
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Nenhum professor." });
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Erro ao carregar professores:", err);
        res.status(500).json({ message: "Erro ao carregar professores." });
    }
});

app.get("/instituicoes", authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id_instituicao, sigla
             FROM instituicao`,
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Nenhuma Instituição." });
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Erro ao carregar Instituições:", err);
        res.status(500).json({ message: "Erro ao carregar Instituições." });
    }
});

app.get("/tipo-documento-assinado", authenticateToken, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM tipo_documento WHERE descricao LIKE '%_assinado'");
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Erro ao carregar tipos de documento:", err);
        res.status(500).json({ message: "Erro ao carregar tipos de documento." });
    }
});

app.get("/estados-tese", authenticateToken, async (req, res) => {
    try {
        const result = await db.query("SELECT id_estado_tese, descricao FROM estado_tese");
        res.json(result.rows); // Retorna id_estado e descricao
    } catch (error) {
        console.error("Erro ao buscar os estados das teses", error);
        res.status(500).send("Erro ao buscar os estados das teses");
    }
});

app.get("/anos-letivos", authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            "SELECT DISTINCT ano_letivo FROM ano_letivo_mestrado ORDER BY ano_letivo DESC"
        );
        res.json(result.rows); // Retorna os anos letivos únicos
    } catch (error) {
        console.error("Erro ao buscar os anos letivos", error);
        res.status(500).send("Erro ao buscar os anos letivos");
    }
});

app.get("/tese/:id_tese/documentos", authenticateToken, async (req, res) => {
    const { id_tese } = req.params;
    const { userType } = req.user;
    if (userType !== 'coordenador_mestrado' && userType !== 'professor') {
        return res.status(403).json({ message: "Acesso proibido. Somente professores podem acessar os documentos da tese." });
    }

    try {
        const result = await db.query(
            `SELECT titulo, ficheiro, data_submissao, extensao
             FROM documento WHERE id_tese = $1 AND extensao = 'pdf'`,
            [id_tese]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Nenhum documento encontrado para esta tese." });
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Erro ao carregar documentos:", err);
        res.status(500).json({ message: "Erro ao carregar documentos." });
    }
});




// Controlo de sessão, login e logout
app.post("/login", async (req, res) => {
    try {
        await auth.login(req, res);
    } catch (err) {
        console.error("Erro ao realizar login:", err.message);
        res.status(500).json({ error: "Erro interno no servidor.", details: err.message });
    }
});

app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: "Erro ao encerrar sessão." });
        }

        res.status(200).json({ message: "Logout realizado com sucesso." });
    });
});





//Funções de preenchimento de documentos e respetiva conversão
async function getTipoDocumentoDescricao(id_tipo_documento) {
    try {
        const query = `SELECT descricao FROM tipo_documento WHERE id_tipo_documento = $1`;
        const result = await db.query(query, [id_tipo_documento]);

        if (result.rows.length > 0) {
            return result.rows[0].descricao;
        } else {
            throw new Error("Tipo de documento não encontrado.");
        }
    } catch (err) {
        console.error("Erro ao obter a descrição do tipo de documento:", err);
        throw err;
    }
}

async function saveDocumentToDatabase(data) {
    const { id_tese, id_tipo_documento, nome_aluno, ficheiro, extensao } = data;

    try {
        // Verifica se nome_aluno é válido
        if (!nome_aluno) {
            throw new Error("Nome do aluno não pode ser vazio ou undefined");
        }

        // Garante que nome_aluno seja uma string válida e aplica o replace
        const tipoDocumentoDescricao = await getTipoDocumentoDescricao(id_tipo_documento);
        const titulo = `${tipoDocumentoDescricao}_${nome_aluno.replace(/\s+/g, '_').toLowerCase()}`;

        const query = `
            INSERT INTO documento (id_tese, id_tipo_documento, titulo, ficheiro, data_submissao, extensao)
            VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING id_documento;
        `;
        const values = [id_tese, id_tipo_documento, titulo, ficheiro, extensao];
        const result = await db.query(query, values);

        return result.rows[0].id_documento;
    } catch (err) {
        console.error("Erro ao guardar documento na base de dados:", err);
        throw err;
    }
}

async function generateDocx(templateFileName, data) {
    const templatePath = path.join(__dirname, "templates", templateFileName);
    const templateBuffer = fs.readFileSync(templatePath);

    const zip = new JSZip();
    await zip.loadAsync(templateBuffer);

    let documentXml = await zip.file("word/document.xml").async("string");

    const unifyPlaceholders = (xml) => {
        return xml.replace(/(\{[^}]+?\})/g, (match) => match.replace(/<\/?w:[^>]+>/g, ""));
    };

    documentXml = unifyPlaceholders(documentXml);

    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`\\{${key}\\}`, "g");
        documentXml = documentXml.replace(regex, value || "");
    }

    console.log("Conteúdo após substituição:", documentXml);

    zip.file("word/document.xml", documentXml);
    const outputDocx = await zip.generateAsync({ type: "nodebuffer" });

    return outputDocx;
}


async function convertDocxToPdf(docxBuffer) {
    const formData = new FormData();
    formData.append("file", docxBuffer, {
        filename: "documento_preenchido.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const apyhubResponse = await fetch("https://api.apyhub.com/convert/word-file/pdf-file", {
        method: "POST",
        headers: {
            "apy-token": process.env.CONVERTER_API_KEY,
        },
        body: formData,
    });

    if (!apyhubResponse.ok) {
        console.error("Erro ao chamar a API: ", apyhubResponse.statusText);
        const errorText = await apyhubResponse.text();
        console.error("Detalhes do erro: ", errorText);
        throw new Error("Erro ao chamar a API de conversão.");
    }

    const result = await apyhubResponse.buffer();
    return result;
}




//Funções de conversão toString
function numeroPorExtenso(numero) {
    const unidades = [
        "zero", "um", "dois", "três", "quatro", "cinco",
        "seis", "sete", "oito", "nove"
    ];
    const especiais = [
        "dez", "onze", "doze", "treze", "quatorze", "quinze",
        "dezasseis", "dezassete", "dezoito", "dezanove"
    ];
    const dezenas = [
        "", "", "vinte" 
    ];

    if (numero < 10) return unidades[numero];
    if (numero < 20) return especiais[numero - 10];
    if (numero === 20) return dezenas[2];

    return "invalido";
}

function atualizarNotaPorExtenso(nota) {
    const notaConvertida = parseFloat(nota.toString().replace(",", "."));

    if (isNaN(notaConvertida) || notaConvertida < 0 || notaConvertida > 20) {
        return "nota inválida"; 
    }

    const parteInteira = Math.floor(notaConvertida);
    const parteDecimal = Math.round((notaConvertida - parteInteira) * 10); 

    const textoParteInteira = numeroPorExtenso(parteInteira);
    const textoParteDecimal =
        parteDecimal > 0 ? `vírgula ${numeroPorExtenso(parteDecimal)}` : "";

    return `${textoParteInteira} ${textoParteDecimal}`.trim();
}

function dataPorExtenso(dataISO) {
    const data = new Date(dataISO);

    // Verifica se a data é válida
    if (isNaN(data)) {
        throw new Error("Data inválida");
    }

    const dia = numeroDataPorExtenso(data.getDate());
    const meses = [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    const mes = meses[data.getMonth()];
    const ano = numeroDataPorExtensoAno(data.getFullYear());

    const horas = numeroDataPorExtenso(data.getUTCHours());  // Hora em UTC
    const minutos = numeroDataPorExtenso(data.getUTCMinutes());  // Minutos em UTC

    if (horas === "invalido" || minutos === "invalido") {
        throw new Error("Hora ou minuto inválido");
    }

    return `dia ${dia} de ${mes} de ${ano}, às ${horas} horas e ${minutos} minutos`;
}

function numeroDataPorExtenso(numero) {
    const unidades = [
        "zero", "um", "dois", "três", "quatro", "cinco",
        "seis", "sete", "oito", "nove"
    ];
    const especiais = [
        "dez", "onze", "doze", "treze", "quatorze", "quinze",
        "dezasseis", "dezassete", "dezoito", "dezanove"
    ];
    const dezenas = [
        "", "", "vinte", "trinta", "quarenta", "cinquenta",
        "sessenta", "setenta", "oitenta", "noventa"
    ];

    if (numero < 10) return unidades[numero];
    if (numero < 20) return especiais[numero - 10];
    if (numero >= 20 && numero < 100) {
        const dezena = Math.floor(numero / 10);
        const unidade = numero % 10;
        return unidade === 0 ? dezenas[dezena] : `${dezenas[dezena]} e ${unidades[unidade]}`;
    }

    return "invalido";  
}

function numeroDataPorExtensoAno(ano) {
    if (ano < 100) return numeroDataPorExtenso(ano); // Se o ano for menor que 100, usa a mesma função

    const milhares = Math.floor(ano / 1000);
    const centenas = Math.floor((ano % 1000) / 100);
    const dezenas = Math.floor((ano % 100) / 10);
    const unidades = ano % 10;

    let resultado = numeroDataPorExtenso(milhares);  // Milhares
    if (centenas > 0) resultado += ` mil e ${numeroDataPorExtenso(centenas * 100)}`;
    if (dezenas > 0 || unidades > 0) resultado += ` e ${numeroDataPorExtenso(dezenas * 10 + unidades)}`;

    return resultado;
}


function getMimeType(extension) {
    switch (extension.toLowerCase()) {
        case 'pdf':
            return 'application/pdf';
        case 'docx':
            return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        default:
            return 'application/octet-stream';
    }
}



// Swagger

const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");


const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API PROJ III - IPVC - Pedro Correia (29241), Afonso Fernandes (29344)",
            description: "Documentation of API routes for thesis management",
            version: "1.0.0"
        },
        servers: [
            {
                url: "http://localhost:3000",
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            }
        },
        security: [
            {
                BearerAuth: []
            }
        ]
    },
    apis: ["./app.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /alunos-mestrado:
 *   get:
 *     summary: List all master's students
 *     security:
 *       - BearerAuth: []
 */

/**
 * @swagger
 * /professores:
 *   get:
 *     summary: List all professors
 *     security:
 *       - BearerAuth: []
 */

/**
 * @swagger
 * /instituicoes:
 *   get:
 *     summary: List all institutions
 *     security:
 *       - BearerAuth: []
 */

/**
 * @swagger
 * /tipo-documento-assinado:
 *   get:
 *     summary: List types of signed documents
 *     security:
 *       - BearerAuth: []
 */

/**
 * @swagger
 * /estados-tese:
 *   get:
 *     summary: List all thesis statuses
 *     security:
 *       - BearerAuth: []
 */

/**
 * @swagger
 * /anos-letivos:
 *   get:
 *     summary: List all academic years
 *     security:
 *       - BearerAuth: []
 */

/**
 * @swagger
 * /tese/{id_tese}/documentos:
 *   get:
 *     summary: List all documents for a thesis
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id_tese
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 */

/**
 * @swagger
 * /dashboard:
 *   post:
 *     summary: Load theses for a specific user
 *     security:
 *       - BearerAuth: []
 */

/**
 * @swagger
 * /aceitar-tese/{id_tese}:
 *   post:
 *     summary: Approve a thesis
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id_tese
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 */

/**
 * @swagger
 * /rejeitar-tese/{id_tese}:
 *   post:
 *     summary: Reject a thesis
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id_tese
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 */

/**
 * @swagger
 * /tese/{id_tese}:
 *   post:
 *     summary: Load a specific thesis page
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id_tese
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 */

/**
 * @swagger
 * /tese/{id_tese}/documentos/download/{fileName}/{fileExtension}:
 *   get:
 *     summary: Download documents for a thesis
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id_tese
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *       - name: fileName
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: fileExtension
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 */

/**
 * @swagger
 * /tese/{id_tese}/upload-documento:
 *   post:
 *     summary: Upload documents for a thesis
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id_tese
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 */

/**
 * @swagger
 * /tese/{id_tese}/registrar-provas-parecer:
 *   post:
 *     summary: Register evidence and reports for a thesis
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id_tese
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 */

/**
 * @swagger
 * /tese/{id_tese}/registrar-data-defesa:
 *   post:
 *     summary: Register a defense date for a thesis
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id_tese
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 */

/**
 * @swagger
 * /tese/{id_tese}/gerar-atas-provas:
 *   post:
 *     summary: Generate proof minutes for a thesis
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id_tese
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 */

/**
 * @swagger
 * /tese/{id_tese}/proposta-juri:
 *   post:
 *     summary: Register a jury proposal for a thesis
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id_tese
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 */

/**
 * @swagger
 * /registrar-tese:
 *   post:
 *     summary: Register a new thesis
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               documento:
 *                 type: string
 *                 format: binary
 */
