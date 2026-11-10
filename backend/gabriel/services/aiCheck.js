// AI photo check for "Snap your food" (Gabriel). Uses Google Gemini.
// Sends the kid's photo + the dish they say it is to Gemini, and gets back 3 answers:
//   isFood       is the photo actually food or a drink?
//   matchesDish  does it look like the dish they ordered?
//   hasFaces     is there a person's face in it? (we don't post faces, privacy)
// plus confidence (0-100, how sure it's food) and label (what Gemini thinks it is).
//
// No GEMINI_API_KEY on this server -> DEMO MODE: always says "yes it's food, matches, no faces",
// so the pages work before the key is set. Add the key to .env (and Vercel) and it's real.
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

// which Gemini model to use. Change it in .env with GEMINI_MODEL=... without touching the code
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenAI({ apiKey }): null ;

// the exact JSON shape Gemini must answer with, so it can't reply in free text
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    is_food: { type: "boolean" },
    matches_dish: { type: "boolean" },
    has_faces: { type: "boolean" },
    confidence: { type: "integer" },
    label: { type: "string" },
  },
  required: ["is_food", "matches_dish", "has_faces", "confidence", "label"],
};

const SYSTEM =
  "You check photos that children upload to a school hawker-food ordering app. " +
  "Judge only what is visible in the photo. Be fair to kids' photos: messy, half-eaten, " +
  "odd angles and different plating are fine.";

// photo: a Buffer (the JPEG), mediaType: "image/jpeg", dishName: e.g. "Kids Chicken Rice Set"
// returns { isFood, matchesDish, hasFaces, confidence, label, demo } or null if the check couldn't run
async function checkPhoto(photo, mediaType, dishName) {
  if (!client) {
    return { isFood: true, matchesDish: true, hasFaces: false, confidence: 98, label: dishName, demo: true };
  }

  const interaction = await client.interactions.create({
    model: MODEL,
    system_instruction: SYSTEM,
    store: false, // don't keep kids' photos on Google's side
    response_format: { type: "text", mime_type: "application/json", schema: RESULT_SCHEMA },
    // the v1 API wants the photo + text wrapped in one "user_input" turn
    input: [
      {
        type: "user_input",
        content: [
          { type: "image", data: photo.toString("base64"), mime_type: mediaType },
          {
            type: "text",
            text:
              `The child says this photo is: "${dishName}".\n` +
              "is_food: is the main subject food or a drink?\n" +
              `matches_dish: could this plausibly be "${dishName}"? Be lenient about portion, angle and plating.\n` +
              "has_faces: is any human face visible, even partly?\n" +
              "confidence: 0-100, how sure you are about is_food.\n" +
              'label: a short name for what you see, e.g. "chicken rice".',
          },
        ],
      },
    ],
  });

  if (!interaction.output_text) return null; // no answer (e.g. blocked by safety filters): leave it pending

  const r = JSON.parse(interaction.output_text);
  return {
    isFood: r.is_food,
    matchesDish: r.matches_dish,
    hasFaces: r.has_faces,
    confidence: Math.max(0, Math.min(100, r.confidence)),
    label: r.label,
    demo: false,
  };
}

// passed = all 3 checks are good
function passed(result) {
  return result.isFood && result.matchesDish && !result.hasFaces;
}

module.exports = { checkPhoto, passed, MODEL };
