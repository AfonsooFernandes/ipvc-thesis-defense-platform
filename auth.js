const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('./db').pool;
const secretKey = process.env.JWT_SECRET;

function generateToken(payload) {
    return jwt.sign(payload, secretKey, { expiresIn: '1h' });
}

async function findUser(email) {
    const tables = ['aluno', 'professor'];
    const currentDate = new Date();

    for (let table of tables) {
        const result = await pool.query(`SELECT id_${table}, password FROM ${table} WHERE email = $1`, [email]);

        if (result.rows.length > 0) {
            const user = {
                userId: result.rows[0][`id_${table}`],
                password: result.rows[0].password,
                userType: table,
            };

            if (table === 'professor') {
                const coordinatorCheck = await pool.query(
                    `SELECT * FROM coordenador_mestrado 
                     WHERE id_professor = $1 AND (data_fim IS NULL OR data_fim > $2)`,
                    [user.userId, currentDate]
                );

                if (coordinatorCheck.rows.length > 0) {
                    user.userType = 'coordenador_mestrado'; 
                }
            }

            return user;
        }
    }

    return null;
}

async function login(req, res) {
    const { email, password } = req.body;

    try {
        const user = await findUser(email);
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password); 

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = generateToken({
            userId: user.userId,
            userType: user.userType,
        });

        return res.json({ token });
    } catch (err) {
        console.error("Erro ao realizar login:", err);
        return res.status(500).json({ error: 'Erro no servidor', details: err.message });
    }
}

function authenticateToken(req, res, next) {
    const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Token não fornecido.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.userType)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        next();
    };
}

module.exports = {
    login,
    authenticateToken,
    authorizeRoles,
};
