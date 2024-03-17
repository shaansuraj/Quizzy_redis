const pool = require('../../../config/db');
const jwt = require('jsonwebtoken');

const studentProfile = async (req, res) => {

    const token = req.header('Authorization');
    // console.log("token", token);

    if (!token) {
        return res.status(401).json({ error: "Unauthorized", details: "No token Found", errorDetails: error.message });
    }

    try {
        const decoded = jwt.verify(token.replace(/^Bearer\s/, ''), process.env.JWT_SECRET);
        // console.log("Decoded Token:", decoded);

        const registrationnumber = decoded.registrationNumber;
        // Get student details from the database based on the registration number in the JWT token
        const result = await pool.query('SELECT * FROM students WHERE registrationnumber = $1', [registrationnumber]);

        const student = result.rows[0];

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Extract profile information
        const { name, email, batch, branch, section } = student;

        // Send the profile information in the response
        res.json({ name, email, batch, branch, section, registrationnumber});
    } catch (error) {
        console.error(error);
        if (error.name === 'JsonWebTokenError') {
            res.status(401).json({ error: 'Unauthorized', details: 'Invalid token' });
        } else if (error.name === 'TokenExpiredError') {
            res.status(401).json({ error: 'Unauthorized', details: 'Token expired' });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

module.exports = studentProfile;