const express = require('express');
const router = express.Router();
const cors = require('cors');

// Middlewares
const authenticateTeacher = require('../middlewares/teacher/auth/authenticateTeacher');
const authenticateStudent = require('../middlewares/student/auth/authenticateStudent');

// Controller Imports
const loginController = require("../controllers/teachers/auth/login");
const { logoutTeacherController } = require("../controllers/teachers/auth/logout");
const registerController = require("../controllers/teachers/auth/register");
const checkResultController = require("../controllers/teachers/quiz/checkResultController");
const myQuizesController = require("../controllers/teachers/quiz/myQuizesController");
const createQuizController = require("../controllers/quizzes/createQuizController");
const { makeQuizLive } = require("../controllers/teachers/quiz/makeQuizLive");
const removeCachedQuizData = require('../controllers/teachers/quiz/endQuiz');
const joinLiveQuizController = require("../controllers/students/quiz/joinLiveQuiz");
const getQuizDetailsController = require("../controllers/teachers/quiz/getQuizDetails");
const scoreCounterController = require("../controllers/students/quiz/scoreCounterController");
const studentLoginController = require("../controllers/students/auth/login");
const studentRegController = require("../controllers/students/auth/register");
const studentProfile = require("../controllers/students/profile/studentProfile");
const checkStudentResultController = require("../controllers/students/profile/checkResultController");
const { logoutStudentController } = require('../controllers/students/auth/logout');

router.use(cors());

// Routes Configuration
// Teacher routes
router.post('/teacher-login', loginController);
router.post('/teacher-register', registerController);
router.post('/teacher-logout', authenticateTeacher, logoutTeacherController);
router.post('/dashboard/add-quiz', authenticateTeacher, createQuizController);
router.post('/dashboard/make-quiz-live', authenticateTeacher, makeQuizLive);
router.get('/dashboard/previous-quizes', authenticateTeacher, myQuizesController);
router.get('/dashboard/previous-quizes/:quizId/results', authenticateTeacher, checkResultController);
router.get('/dashboard/quiz-preview/:quizId', authenticateTeacher, getQuizDetailsController);

router.get('/dashboard/make-quiz-live/:quizId/end-quiz',authenticateTeacher,removeCachedQuizData);

// Student routes
router.post('/student-login',studentLoginController);
router.post('/student-register',studentRegController);
router.post('/student-logout', authenticateStudent, logoutStudentController);
router.post('/join-quiz', authenticateStudent, joinLiveQuizController);
router.post('/score-counter', authenticateStudent,scoreCounterController);
router.get('/student-profile', authenticateStudent, studentProfile);
router.get('/my-results', authenticateStudent, checkStudentResultController);

// Export the configured router
module.exports = router;
