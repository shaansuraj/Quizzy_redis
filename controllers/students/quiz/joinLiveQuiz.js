const { memcachedClient } = require('../../teachers/quiz/makeQuizLive');
const jwt = require('jsonwebtoken');
const pool = require('../../../config/db');

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
        
        memcachedClient.get(roomKey, async (err, cachedData) => {
            if (err) {
                console.error('MemCachier Error:', err);
                return res.status(500).json({ error: 'Internal Server Error', details: 'MemCachier error' });
            }
            if (!cachedData) {
                return res.status(404).json({ error: 'Quiz not found in cache' });
            }

            const { quizDetails, roomPassword } = JSON.parse(cachedData.toString());

            if (password !== roomPassword) {
                return res.status(403).json({ error: 'Invalid password' });
            }

            const studentQuery = 'SELECT name, batch, branch, section FROM students WHERE registrationnumber = $1';
            const studentResult = await pool.query(studentQuery, [registrationNumber]);

            if (studentResult.rows.length === 0) {
                return res.status(404).json({ error: 'Student details not found' });
            }

            const sanitizedQuizDetails = quizDetails.quizData.map(question => ({
                question_text: question.question_text,
                options: question.options
            }));

            const quizTitle = quizDetails.quizTitle;

            res.json({ 
                quizTitle, 
                quizData: sanitizedQuizDetails,
                studentDetails: studentResult.rows[0],
                registrationNumber,
                roomKey,
                Duration: quizDetails.Duration,
                quizID: quizId
            });
        });
    } catch (error) {
        console.error('Error joining quiz:', error);
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Unauthorized', details: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};

module.exports = joinLiveQuiz;
