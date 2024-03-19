const { memcachedClient } = require('./makeQuizLive');

const removeCachedQuizData = async (req, res) => {
    const token = req.header('Authorization');
  
    // Verify the token
    const decoded = jwt.verify(token.replace(/^Bearer\s/, ''), process.env.JWT_SECRET);
    
    if(!decoded){
        return res.status(401).json({ error: 'You are not a teacher', details: 'Ending quiz error' });
    }

    try {
        const { quizId } = req.body;
        const roomKey = `quiz-room:${quizId}`;

        memcachedClient.delete(roomKey, (err, result) => {
            if (err) {
                console.error('MemCachier Error:', err);
                return res.status(500).json({ error: 'Internal Server Error', details: 'MemCachier error' });
            }
            if (result) {
                return res.json({ message: `Cached data for quiz with ID ${quizId} has been removed successfully` });
            } else {
                return res.status(404).json({ error: 'Quiz not found in cache' });
            }
        });
    } catch (error) {
        console.error('Error removing cached quiz data:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};

module.exports = removeCachedQuizData;
