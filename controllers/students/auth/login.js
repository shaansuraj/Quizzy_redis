const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../../config/db');

const studentLoginController = async (req, res) => {
    try {
        const { registrationNumber, password, androidId } = req.body;

        // Retrieve the student from the database based on registration number
        const result = await pool.query('SELECT * FROM students WHERE registrationnumber = $1', [registrationNumber]);

        const student = result.rows[0];
        // console.log("Student:", student);


        if (!student) {
            return res.status(401).json({ error: 'Please Register' });
        }

        const { password: hashedPassword, androidid: storedAndroidId } = student;
        // console.log("AndroidID", storedAndroidId);

        // Compare the provided password with the hashed password from the database
        const passwordMatch = await bcrypt.compare(password, hashedPassword);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid Password' });
        }

        // Check if the androidId matches the one stored in the database
        if (androidId !== storedAndroidId && (androidId !== null || storedAndroidId !== null)) {
            return res.status(401).json({ error: 'Use the device used during registration to login only' });
        }
        

        // Generate a JWT token for the authenticated student
        const token = jwt.sign(
            { registrationNumber },
            process.env.JWT_SECRET,
            { expiresIn: '365d' } 
        );

        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

module.exports = studentLoginController;
