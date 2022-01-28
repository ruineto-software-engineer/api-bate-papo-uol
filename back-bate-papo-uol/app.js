import express, { json } from "express";
import cors from 'cors';
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(json());

app.listen(5000, () => {
  console.log('Running app in http://localhost:5000');
});