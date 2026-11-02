import express from 'express';
import app from './src/app/app.js';

const vercelApp = express();
vercelApp.use(app);

export default vercelApp;
