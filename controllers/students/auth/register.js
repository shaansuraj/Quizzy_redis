const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../../config/db');

const studentRegController = async (req, res) => {
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

        // Check if the user already exists
        const existingUser = await pool.query(
            'SELECT * FROM students WHERE registrationnumber = $1 OR email = $2',
            [registrationNumber, email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash the password before storing it in the database
        const hashedPassword = await bcrypt.hash(password, 10);

        // Perform database insertion
        const result = await pool.query(
            'INSERT INTO students (name, registrationnumber, email, password, batch, branch, section, course, AndroidID) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING registrationnumber',
            [name, registrationNumber, email, hashedPassword, batch, branch, section, course, androidId]
        );

        const newStudent = result.rows[0];

        // Generate a JWT token for the newly registered student
        const token = jwt.sign(
            { registrationNumber: newStudent.registrationnumber },
            process.env.JWT_SECRET,
            { expiresIn: '365d' } // Token expiration time 
        );

        res.status(201).json({ token });
    } catch (error) {
        console.error(error);
        // Check for specific errors and provide corresponding responses
        if (error.constraint === 'students_registrationnumber_key') { // Unique constraint violation for registration number
            res.status(400).json({ error: 'Registration number already exists' });
        } else if (error.constraint === 'students_email_key') { // Unique constraint violation for email
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: 'Internal Server Error', details: error.message });
        }
    }
}

module.exports = studentRegController;
