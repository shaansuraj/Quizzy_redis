const express = require('express');
const http = require('http');
const compression = require('compression');
require('dotenv').config();
const cors = require('cors');

const app = express();
const portHTTP = process.env.HOST_PORT || 8000; // Set port to 8000

app.use(cors({
  origin: "*",
}));

app.use(compression({ threshold: 256 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const router = require('./routes/routes');
app.use('/', router);

const httpServer = http.createServer(app);

httpServer.listen(portHTTP, () => {
  console.log("Server running on port", portHTTP);
});
