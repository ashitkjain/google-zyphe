import { config } from "dotenv";
config();
import { GoogleGenAI, Type } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.VITE_FIREBASE_API_KEY }); // Need to figure out the key

async function run() {
  console.log("Testing...");
}
run();
