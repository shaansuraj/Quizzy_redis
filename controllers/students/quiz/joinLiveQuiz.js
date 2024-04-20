const { memcachedClient, mutex } = require('../../teachers/quiz/makeQuizLive');
const jwt = require('jsonwebtoken');
const pool = require('../../../config/db');

const MAX_RETRIES = 3; // Maximum number of retry attempts
const RETRY_DELAY = 1000; // Delay between retry attempts in milliseconds

const joinLiveQuiz = async (req, res) => {
    try {
        const token = req.header('Authorization');
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized', details: 'No token found' });
        }

        const decoded = jwt.verify(token.replace(/^Bearer\s/, ''), process.env.JWT_SECRET);
        const registrationNumber = decoded.registrationNumber;
        const { quizId, password } = req.body;
        const roomKey = `quiz-room:${quizId}`;

        let cachedData;
        let retries = 0;

        // Retry loop to handle socket timeout errors
        while (retries < MAX_RETRIES) {
            try {
                cachedData = await new Promise((resolve, reject) => {
                    memcachedClient.get(roomKey, (err, value) => {
                        if (err) reject(err);
                        else resolve(value);
                    });
                });
                break; // Exit the loop if successful
            } catch (error) {
                console.error('Error retrieving data from Memcached:', error);
                if (retries === MAX_RETRIES - 1) {
                    // Max retries reached, return error response
                    return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to retrieve data from Memcached' });
                }
                retries++;
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY)); // Delay before retry
            }
        }

        if (!cachedData) {
            return res.status(404).json({ error: 'Quiz not found in cache' });
        }

        const { quizDetails, roomPassword } = JSON.parse(cachedData.toString());

        if (password !== roomPassword) {
            return res.status(403).json({ error: 'Invalid password' });
        }

        // Fetch student details from the database
        const studentQuery = 'SELECT name, batch, branch, section FROM students WHERE registrationnumber = $1';
        const studentResult = await pool.query(studentQuery, [registrationNumber]);

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Student details not found' });
        }

        const sanitizedQuizDetails = quizDetails.quizData.map(question => ({
            question_text: question.question_text,
            options: question.options
        }));

        const quizDetailsWithoutSensitiveInfo = {
            quizDetails: {
                quizTitle: quizDetails.quizTitle,
                quizData: sanitizedQuizDetails
            },
            studentDetails: studentResult.rows[0],
            registrationNumber,
            roomKey,
            quizID: quizId
        };

        res.json(quizDetailsWithoutSensitiveInfo);
    } catch (error) {
        console.error('Error joining quiz:', error);
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Unauthorized', details: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};

module.exports = joinLiveQuiz;
