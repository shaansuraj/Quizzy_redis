const { memcachedClient, mutex } = require('../../teachers/quiz/makeQuizLive');
const pool = require('../../../config/db');

// Function to calculate score
async function calculateScore(quizData, studentResponses) {
    let correctAttempts = 0;
    let wrongAttempts = 0;
    const totalQuestions = quizData.length;
    let obtainedScore = 0;
    let maximumMarks = 0;

    for (const question of quizData) {
        maximumMarks++; // Increment for each question
        const response = studentResponses.find(resp => resp.question === question.question_text);
        if (response) {
            const trimmedResponse = response.answer.trim();
            const trimmedAnswer = question.answer.trim();
            if (trimmedResponse === trimmedAnswer) {
                correctAttempts++;
                obtainedScore++;
            } else {
                wrongAttempts++;
            }
        } else {
            wrongAttempts++;
        }
    }

    return { correctAttempts, wrongAttempts, totalQuestions, obtainedScore, maximumMarks };
}

// Function to retrieve data from cache with retry logic
async function retrieveDataFromCacheWithRetry(roomKey, retries = 3, delay = 100) {
    for (let i = 0; i < retries; i++) {
        try {
            return await new Promise((resolve, reject) => {
                memcachedClient.get(roomKey, (err, value) => {
                    if (err) reject(err);
                    else resolve(value);
                });
            });
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

const scoreCounter = async (req, res) => {
    try {
        const { registrationNumber, quizId, responses } = req.body;

        // Check if the student has already submitted the quiz
        const checkSubmissionQuery = 'SELECT * FROM results WHERE registrationnumber = $1 AND quizid = $2';
        const submissionCheckResult = await pool.query(checkSubmissionQuery, [registrationNumber, quizId]);

        if (submissionCheckResult.rows.length > 0) {
            return res.status(400).json({ error: 'You have already appeared for this quiz' });
        }

        // Acquire the lock
        const release = await mutex.acquire();

        try {
            // Check if quiz data is cached
            const roomKey = `quiz-room:${quizId}`;
            const data = await retrieveDataFromCacheWithRetry(roomKey);

            if (!data) {
                return res.status(404).json({ error: 'Quiz not found in cache' });
            }

            const { quizDetails, password, roomName, Duration, quizID } = JSON.parse(data.toString());
            const { correctAttempts, wrongAttempts, totalQuestions, obtainedScore, maximumMarks } = await calculateScore(quizDetails.quizData, responses);

            // Start a database transaction
            const client = await pool.connect();
            await client.query('BEGIN');

            try {
                const insertScoreQuery = 'INSERT INTO results (registrationnumber, quizid, score) VALUES ($1, $2, $3)';
                await client.query(insertScoreQuery, [registrationNumber, quizId, obtainedScore]);

                // Commit the transaction
                await client.query('COMMIT');
            } catch (error) {
                // Rollback the transaction in case of an error
                await client.query('ROLLBACK');
                throw error;
            } finally {
                // Release the client back to the pool
                client.release();
            }

            res.json({ 
                success: true, 
                quizTitle: quizDetails.quizTitle, 
                correctAttempts, 
                wrongAttempts, 
                totalQuestions, 
                obtainedScore, 
                maximumMarks 
            });
        } finally {
            // Release the lock
            release();
        }
    } catch (error) {
        console.error('Error in scoreCounter:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = scoreCounter;
