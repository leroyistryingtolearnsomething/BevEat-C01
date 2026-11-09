// AI photo check for "Snap your food" (Gabriel).
// Sends the kid's photo + the dish they say it is to Claude, and gets back 3 answers:
//   isFood       is the photo actually food or a drink?
//   matchesDish  does it look like the dish they ordered?
//   hasFaces     is there a person's face in it? (we don't post faces, privacy)
// plus confidence (0-100, how sure it's food) and label (what Claude thinks it is).
//
// No ANTHROPIC_API_KEY on this server -> DEMO MODE: always says "yes it's food, matches, no faces",
// so the pages can be built and tested before the team has a key. Add the key to .env and it's real.
require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-opus-5-5"; // change to "claude-haiku-5-5" for ~30x cheaper checks

const hasKey = !!process.env.ANTHROPIC_API_KEY;
const client = hasKey ? new (Anthropic.default || Anthropic)() : null;

// the exact JSON shape Claude must answer with (structured output, so it can't reply in free text)
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
  additionalProperties: false,
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

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // if Claude's safety filter declines, Anthropic retries on a fallback model
    system: SYSTEM,
    output_config: {
      effort: "low", // a simple yes/no check, doesn't need deep thinking
      format: { type: "json_schema", schema: RESULT_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: photo.toString("base64") } },
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

  if (response.stop_reason === "refusal") return null; // declined, leave the photo for a person to check
  const text = response.content.find((b) => b.type === "text");
  if (!text) return null;

  const r = JSON.parse(text.text);
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
