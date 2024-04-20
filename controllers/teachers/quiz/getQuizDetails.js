const pool = require('../../../config/db');
const jwt = require('jsonwebtoken');

async function getQuizDetailsController(req, res) {
    const token = req.header('Authorization');
  
    // Verify the token
    const decoded = jwt.verify(token.replace(/^Bearer\s/, ''), process.env.JWT_SECRET);
    const teacherId = decoded.teacherId;
  
    try {
      const { quizId } = req.query.quizId;
  
      // Fetch quiz details
      const quizDetailsQuery = `
        SELECT q.Title, q.Description, q.DateCreated, t.TopicName, qu.Question, qu.Option1, qu.Option2, qu.Option3, qu.Option4, qu.Answer
        FROM Quizzes q
        INNER JOIN Topics t ON q.TopicID = t.TopicID
        INNER JOIN QuizQuestions qq ON q.QuizID = qq.QuizID
        INNER JOIN Questions qu ON qq.QuestionID = qu.QuestionID
        WHERE q.QuizID = $1 AND q.TeacherID = $2
      `;
      const quizDetailsResult = await pool.query(quizDetailsQuery, [quizId, teacherId]);
  
      if (quizDetailsResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Quiz not found or unauthorized access' });
      }
  
      // Format the quiz details response
      const quizDetails = {
        Title: quizDetailsResult.rows[0].title,
        Description: quizDetailsResult.rows[0].description,
        DateCreated: quizDetailsResult.rows[0].datecreated,
        TopicName: quizDetailsResult.rows[0].topicname,
        Questions: quizDetailsResult.rows.map(row => ({
          Question: row.question,
          Options: [row.option1, row.option2, row.option3, row.option4],
          Answer: row.answer
        }))
      };
  
      res.status(200).json({ success: true, quizDetails });
    } catch (error) {
      console.error('Error fetching quiz details:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
  
  module.exports = getQuizDetailsController;