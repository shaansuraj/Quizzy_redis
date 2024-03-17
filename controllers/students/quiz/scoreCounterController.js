const { memcachedClient } = require('../../teachers/quiz/makeQuizLive');
const pool = require('../../../config/db');

// Function to calculate score
function calculateScore(quizData, studentResponses) {
    let correctAttempts = 0;
    let wrongAttempts = 0;
    const totalQuestions = quizData.length;
    let obtainedScore = 0;
    let maximumMarks = 0;

    quizData.forEach(question => {
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
    });

    return { correctAttempts, wrongAttempts, totalQuestions, obtainedScore, maximumMarks };
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

        // Check if quiz data is cached
        const roomKey = `quiz-room:${quizId}`;
        const data = await new Promise((resolve, reject) => {
            memcachedClient.get(roomKey, (err, value) => {
                if (err) reject(err);
                else resolve(value);
            });
        });

        if (!data) {
            return res.status(404).json({ error: 'Quiz not found in cache' });
        }

        const { quizDetails, password, roomName, Duration, quizID } = JSON.parse(data.toString());
        const { correctAttempts, wrongAttempts, totalQuestions, obtainedScore, maximumMarks } = calculateScore(quizDetails.quizData, responses);

        const insertScoreQuery = 'INSERT INTO results (registrationnumber, quizid, score) VALUES ($1, $2, $3)';
        await pool.query(insertScoreQuery, [registrationNumber, quizId, obtainedScore]);

        res.json({ 
            success: true, 
            quizTitle: quizDetails.quizTitle, 
            correctAttempts, 
            wrongAttempts, 
            totalQuestions, 
            obtainedScore, 
            maximumMarks 
        });
    } catch (error) {
        console.error('Error in scoreCounter:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = scoreCounter;
