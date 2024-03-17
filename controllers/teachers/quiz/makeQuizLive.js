const memjs = require('memjs');
const jwt = require('jsonwebtoken');
const pool = require('../../../config/db');
require('dotenv').config();

// Create a MemCachier client
const memcachedClient = memjs.Client.create(
    process.env.MEMCACHIER_SERVERS,
    {
        username: process.env.MEMCACHIER_USERNAME,
        password: process.env.MEMCACHIER_PASSWORD
    }
);

// Function to get Quiz details from the database
async function getQuizDetailsFromDatabase(quizId, teacherId) {
    try {
        const quizQuery = `
            SELECT 
                quizzes.quizid,
                quizzes.title AS quiz_title, 
                questions.question AS question_text, 
                questions.option1, 
                questions.option2, 
                questions.option3, 
                questions.option4, 
                questions.answer
            FROM 
                quizzes 
            INNER JOIN 
                quizquestions ON quizzes.quizid = quizquestions.quizid
            INNER JOIN 
                questions ON quizquestions.questionid = questions.questionid
            WHERE 
                quizzes.quizid = $1 AND quizzes.teacherId = $2
        `;

        const quizResult = await pool.query(quizQuery, [quizId, teacherId]);

        if (quizResult.rows.length === 0) {
            return null; // Quiz not found or unauthorized access
        }

        const quizData = quizResult.rows.map(row => ({
            question_text: row.question_text,
            options: [row.option1, row.option2, row.option3, row.option4],
            answer: row.answer, 
        }));

        const quizTitle = quizResult.rows[0].quiz_title;

        return { quizTitle, quizData };
    } catch (error) {
        console.error(error);
        return null; 
    }
}

// Function to generate random password
function generateRandomPassword() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        password += characters.charAt(randomIndex);
    }
    return password;
}

// makeQuizLive controller with MemCachier caching
const makeQuizLive = async (req, res) => {
    try {
        // Teacher verification
        const token = req.header('Authorization');
        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ error: 'Unauthorized', details: 'No token found' });
        }

        const decoded = jwt.verify(token.replace(/^Bearer\s/, ''), process.env.JWT_SECRET);
        const teacherId = decoded.teacherId;

        // Get quiz ID and duration from the request
        const { quizId, duration } = req.body;

        // Fetch quiz details from MemCachier cache or database
        const roomKey = `quiz-room:${quizId}`;
        memcachedClient.get(roomKey, async (err, cachedData) => {
            if (err) {
                console.error('MemCachier Error:', err);
                return res.status(500).json({ error: 'Internal Server Error', details: 'MemCachier error' });
            }
            let quizDetails, roomPassword;
            if (cachedData) {
                // Use cached data if available
                const { quizDetails: cachedQuizDetails, roomPassword: cachedRoomPassword, duration: cachedDuration } = JSON.parse(cachedData.toString());
                quizDetails = cachedQuizDetails;
                roomPassword = cachedRoomPassword;
                duration;
                // console.log('Cached data:', cachedData.toString());
            } else {
                // Fetch quiz details from the database if not cached
                const quizDetailsFromDB = await getQuizDetailsFromDatabase(quizId, teacherId);
                if (!quizDetailsFromDB) {
                    return res.status(404).json({ error: 'Quiz not found or unauthorized' });
                }
                quizDetails = quizDetailsFromDB;
                roomPassword = generateRandomPassword();
                // Cache the fetched data for future use
                memcachedClient.set(roomKey, JSON.stringify({ quizDetails, roomPassword, duration }));
            }

            // Respond to the teacher with the room password, duration, and quiz ID
            res.json({ "RoomPassword": roomPassword, "Duration": duration, "quizID": quizId });
        });

    } catch (error) {
        console.error('Error in makeQuizLive:', error);
        res.status(500).json({ error: 'Internal Server Error', details: 'Exception caught in makeQuizLive' });
    }
};

module.exports = { makeQuizLive, memcachedClient };
