const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../../config/db');

const studentRegController = async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            name,
            registrationNumber,
            email,
            password,
            batch,
            branch,
            section,
            course,
            androidId
        } = req.body;

        // Log incoming request body for debugging
        console.log('Request Body:', req.body);

        // Check for missing fields
        if (!name || !registrationNumber || !email || !password || !batch || !branch || !section || !course || !androidId) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        await client.query('BEGIN');

        const existingUser = await client.query(
            'SELECT * FROM students WHERE registrationnumber = $1 OR email = $2',
            [registrationNumber, email]
        );

        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash the password before storing it in the database
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await client.query(
            'INSERT INTO students (name, registrationnumber, email, password, batch, branch, section, course, AndroidID) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING registrationnumber',
            [name, registrationNumber, email, hashedPassword, batch, branch, section, course, androidId]
        );

        const newStudent = result.rows[0];

        const token = jwt.sign(
            { registrationNumber: newStudent.registrationnumber },
            process.env.JWT_SECRET,
            { expiresIn: '365d' }
        );

        await client.query('COMMIT');
        res.status(201).json({ token });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        if (error.constraint === 'students_registrationnumber_key') {
            res.status(400).json({ error: 'Registration number already exists' });
        } else if (error.constraint === 'students_email_key') {
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: 'Internal Server Error', details: error.message });
        }
    } finally {
        client.release();
    }
}

module.exports = studentRegController;
