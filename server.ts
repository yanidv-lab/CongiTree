import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { MAX_NODE_EXPANSION_DEPTH } from "./src/lib/constants";
import { FailureKind, classifyFailure, withBurstRetry } from "./src/lib/llmResilience";
import { ModelCaller, expandNodeViaSplit, generateTreeViaSplit } from "./src/lib/llmSplit";
import { normalizeExistingTitles } from "./src/lib/llmShared";

dotenv.config();

const app = express();
// Cloud Run (and most container platforms) inject PORT and require the app to listen on it;
// default to 3000 for local dev where nothing sets it.
const PORT = Number(process.env.PORT) || 3000;

// Trust the platform's reverse proxy (Cloud Run, etc.) so req.ip reflects the real client IP
// from X-Forwarded-For rather than the proxy's own address - required for per-IP rate limiting
// below to actually distinguish clients instead of lumping all traffic together.
app.set("trust proxy", 1);

app.use(express.json());

// There is no user auth in this app, so these two routes (the ones that call the Gemini API)
// are reachable by anyone who has the URL. Rate limit them per-IP as a baseline cost/abuse
// guard - this is not a substitute for real auth on a widely-shared public deployment, but it
// bounds the worst case for casual abuse or a runaway client bug.
const generateTreeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Carry a fallbackReason so the client can tell this app's own per-IP throttle apart from a
  // limit coming from the AI provider - they are both 429s but they mean different things.
  message: { success: false, fallbackReason: "rate_limit", error: "יותר מדי בקשות ליצירת עצי למידה. נסה שוב בעוד כמה דקות." },
});

const expandNodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, fallbackReason: "rate_limit", error: "יותר מדי בקשות להרחבת ענפים. נסה שוב בעוד כמה דקות." },
});

// True when this deployment has no server-side key at all. That is a legitimate configuration:
// the app is designed to run on the user's own key, entered in Settings and kept on their device.
// In that case these routes must FAIL LOUDLY with a 503 so the client falls through to its
// on-device provider path - previously they returned `success: true` with canned filler, which
// meant a user who had entered a perfectly good key never got to use it.
const hasServerKey = () => Boolean(process.env.GEMINI_API_KEY);

function serverKeyMissingResponse(res: any) {
  return res.status(503).json({
    success: false,
    code: "SERVER_KEY_MISSING",
    fallbackReason: "server_key_missing" as FailureKind,
    error: "בשרת זה לא מוגדר מפתח API. יש להזין מפתח אישי בהגדרות כדי להשתמש באפליקציה.",
  });
}

// Map a provider failure onto an HTTP status the client can act on. The body always carries
// `fallbackReason` so the UI can say what actually happened instead of guessing "quota".
function statusForFailure(kind: FailureKind): number {
  if (kind === "auth_error") return 401;
  if (kind === "rate_limit" || kind === "grounding_limit") return 429;
  if (kind === "quota_exhausted") return 402;
  if (kind === "server_key_missing") return 503;
  return 502;
}

// Initialize Gemini Client safely on the server
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("SERVER_KEY_MISSING");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Helper to extract JSON from Gemini text response (handles ```json block wrapping, surrounding text, and truncation)
function parseJsonFromGemini(text: string): any {
  if (!text || !text.trim()) {
    throw new Error("Empty text response received from AI model");
  }

  let cleaned = text.trim();

  // 1. Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Continue to cleanup
  }

  // 2. Remove markdown code block markers
  if (cleaned.includes("```")) {
    cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  // 3. Try parsing again after strip
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Continue to boundary extraction
  }

  // 4. Extract outer JSON object or array bounds
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  let jsonCandidate = "";

  if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1 && lastBracket !== -1) {
    jsonCandidate = cleaned.substring(firstBracket, lastBracket + 1);
  } else {
    jsonCandidate = cleaned;
  }

  return JSON.parse(jsonCandidate);
}

// Helper to clean and validate resource URLs to provide rich, direct, and free access
function sanitizeResourceUrl(rawUrl: string, title: string, topic: string, type: string): string {
  let url = (rawUrl || "").trim();

  // If Gemini provided a valid direct URL (not a generic Google search page), keep it!
  const isGoogleSearchUrl = !url || 
    url.includes("google.com/search") || 
    url.includes("google.co/") || 
    url === "https://www.google.com" ||
    url === "https://google.com";

  if (!isGoogleSearchUrl && (url.startsWith("http://") || url.startsWith("https://"))) {
    return url;
  }

  // Fallback direct URL generation based on title, topic, and type
  const cleanTerm = (title || topic).trim();
  const hasHebrew = /[\u0590-\u05FF]/.test(cleanTerm);
  const titleLower = cleanTerm.toLowerCase();
  const encodedQuery = encodeURIComponent(cleanTerm);

  if (type === "youtube") {
    if (titleLower.includes("3blue1brown") || titleLower.includes("linear algebra") || titleLower.includes("אלגברה")) return "https://www.youtube.com/@3blue1brown";
    if (titleLower.includes("freecodecamp") || titleLower.includes("code") || titleLower.includes("קוד")) return "https://www.youtube.com/@freecodecamp";
    if (titleLower.includes("crashcourse") || titleLower.includes("crash course")) return "https://www.youtube.com/@crashcourse";
    if (titleLower.includes("mit") || titleLower.includes("ocw")) return "https://www.youtube.com/@mitocw";
    if (titleLower.includes("cs50") || titleLower.includes("harvard")) return "https://www.youtube.com/@cs50";
    if (titleLower.includes("stanford")) return "https://www.youtube.com/@stanfordonline";
    if (titleLower.includes("khan") || titleLower.includes("חאן")) return "https://www.youtube.com/@khanacademy";
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanTerm + ' course tutorial')}`;
  }

  if (type === "course_free") {
    if (titleLower.includes("khan") || titleLower.includes("חאן")) return `https://www.khanacademy.org/search?page_search_query=${encodedQuery}`;
    if (titleLower.includes("mit") || titleLower.includes("ocw")) return `https://ocw.mit.edu/search/?q=${encodedQuery}`;
    if (titleLower.includes("edx") || titleLower.includes("harvard")) return `https://www.edx.org/search?q=${encodedQuery}`;
    if (titleLower.includes("coursera") || titleLower.includes("stanford")) return `https://www.coursera.org/search?query=${encodedQuery}`;
    if (titleLower.includes("freecodecamp")) return `https://www.freecodecamp.org/news/search/?query=${encodedQuery}`;
    return `https://www.khanacademy.org/search?page_search_query=${encodedQuery}`;
  }

  if (type === "course_paid") {
    return `https://www.udemy.com/courses/search/?q=${encodedQuery}`;
  }

  if (type === "book") {
    if (titleLower.includes("openstax")) return "https://openstax.org/subjects";
    if (titleLower.includes("mml") || titleLower.includes("deisenroth")) return "https://mml-book.github.io/";
    if (titleLower.includes("oreilly") || titleLower.includes("o'reilly")) return "https://www.oreilly.com/";
    return "https://openstax.org/subjects";
  }

  if (type === "doc") {
    if (titleLower.includes("mdn") || titleLower.includes("javascript") || titleLower.includes("css") || titleLower.includes("html") || titleLower.includes("web")) {
      return `https://developer.mozilla.org/en-US/search?q=${encodedQuery}`;
    }
    if (titleLower.includes("w3schools")) return `https://www.w3schools.com/`;
  }

  if (type === "article" || type === "doc") {
    if (titleLower.includes("arxiv") || titleLower.includes("paper") || titleLower.includes("מחקר")) {
      return `https://arxiv.org/search/?query=${encodedQuery}&searchtype=all`;
    }
    if (titleLower.includes("scholar")) return `https://scholar.google.com/scholar?q=${encodedQuery}`;
  }

  // Wikipedia search endpoint as the universal last-resort fallback (Hebrew if Hebrew text, English
  // otherwise). Unlike guessing a direct "/wiki/<Title>" URL, this never 404s: on an exact title
  // match Wikipedia auto-redirects straight to the article, and for specific/niche sub-topic titles
  // that have no dedicated article it still lands the user on genuinely relevant search results
  // instead of a broken link.
  if (hasHebrew) {
    return `https://he.wikipedia.org/w/index.php?search=${encodedQuery}&title=Special:Search&fulltext=1`;
  }
  return `https://en.wikipedia.org/w/index.php?search=${encodedQuery}&title=Special:Search&fulltext=1`;
}

// A model can be confidently wrong about a URL even after being told to leave "url" empty when
// unsure - so before handing resources to the user, do a light real-world reachability check and
// swap any definitively-dead link for sanitizeResourceUrl's search-based fallback.
const URL_VERIFY_TIMEOUT_MS = 4000;

async function isUrlDefinitelyDead(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), URL_VERIFY_TIMEOUT_MS);
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CogniTreeBot/1.0)" },
    });
    clearTimeout(timeout);
    // Only a definitive 404/410 counts as "dead" - many legitimate sites (especially academic
    // ones) reject HEAD requests, block unrecognized user agents, or gate behind other status
    // codes, so treating any non-2xx as broken would wrongly discard perfectly good links.
    return response.status === 404 || response.status === 410;
  } catch (err) {
    // Network error, timeout, or the site refused the request outright - can't be sure it's
    // actually broken (could just be blocking bots), so fail open and keep the original link.
    return false;
  }
}

// Runs all resource-link checks for a tree/sub-node batch in parallel (bounded by
// URL_VERIFY_TIMEOUT_MS per link) and swaps in a working fallback for anything confirmed dead.
async function verifyAndFixResourceUrls(nodes: any[], topic: string): Promise<void> {
  const checks: Promise<void>[] = [];
  nodes.forEach((node: any) => {
    (node.resources || []).forEach((res: any) => {
      checks.push(
        (async () => {
          const dead = await isUrlDefinitelyDead(res.url);
          if (dead) {
            res.url = sanitizeResourceUrl("", res.title, topic, res.type);
          }
        })()
      );
    });
  });
  await Promise.all(checks);
}

function normalizeServerTitle(title: string): string {
  if (!title) return '';
  return title.toLowerCase().trim().replace(/[^\w\u0590-\u05FF]/g, ' ').replace(/\s+/g, ' ');
}

function getCoreServerTitleWords(title: string): string[] {
  const normalized = normalizeServerTitle(title);
  const stopAndFillerWords = new Set([
    // Hebrew
    'של', 'את', 'עם', 'על', 'ב', 'ל', 'מ', 'ה', 'זה', 'כי', 'גם',
    'מבוא', 'יסודות', 'עקרונות', 'למידת', 'מדריך', 'שיטות', 'מערך', 'נושא', 
    'תת', 'שלב', 'חלק', 'בסיס', 'מתקדם', 'ליבה', 'בסיסי', 'כללי', 'סקירה',
    'הבנת', 'תרגול', 'יישום', 'פיתוח', 'שימוש', 'ניתוח', 'לימוד', 'כלים',
    // English
    'the', 'a', 'an', 'in', 'of', 'for', 'and', 'or', 'to', 'with', 'on', 'at', 'by',
    'introduction', 'intro', 'basics', 'basic', 'fundamentals', 'fundamental', 
    'overview', 'guide', 'methods', 'advanced', 'core', 'part', 'section', 'topic', 
    'subtopic', 'learning', 'study', 'understanding', 'practice', 'application', 'analysis'
  ]);
  return normalized.split(' ').filter(w => w.length > 1 && !stopAndFillerWords.has(w));
}

function areServerTitlesSimilar(titleA: string, titleB: string): boolean {
  const normA = normalizeServerTitle(titleA);
  const normB = normalizeServerTitle(titleB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Deliberately no raw substring-containment check here: a short title fully contained in a
  // much longer one (e.g. the tree's own topic "Python" inside a legitimate child topic "Python
  // Data Structures") is normal parent/child naming, not a duplicate - the core-word comparison
  // below is a more accurate signal of genuine near-duplicates.
  const coreA = getCoreServerTitleWords(titleA);
  const coreB = getCoreServerTitleWords(titleB);

  if (coreA.length === 0 || coreB.length === 0) {
    const rawWordsA = normA.split(' ').filter(w => w.length > 1);
    const rawWordsB = normB.split(' ').filter(w => w.length > 1);
    if (rawWordsA.length > 0 && rawWordsB.length > 0) {
      const commonRaw = rawWordsA.filter(w => rawWordsB.includes(w));
      return commonRaw.length === rawWordsA.length || commonRaw.length === rawWordsB.length;
    }
    return false;
  }

  const commonCore = coreA.filter(w => coreB.includes(w));
  const minCoreLen = Math.min(coreA.length, coreB.length);

  // Full containment of the smaller title's core words only signals a duplicate once the smaller
  // title carries enough distinct signal (2+ core words) - a single shared word is very often
  // just the parent topic's own name, which every sibling node in the tree will also share.
  if (minCoreLen >= 2 && commonCore.length === minCoreLen) return true;

  // Require most (not just half) of the core words to overlap - a 50% bar false-collides
  // distinct sibling topics that merely mention the same parent subject.
  const overlapRatio = commonCore.length / Math.max(coreA.length, coreB.length);
  if (overlapRatio >= 0.75) return true;

  return false;
}

const GEMINI_MODEL = "gemini-3.6-flash";

function generateContent(ai: any, prompt: string, useSearch: boolean): Promise<any> {
  const config: any = { temperature: 0.2 };
  if (useSearch) config.tools = [{ googleSearch: {} }];
  return ai.models.generateContent({ model: GEMINI_MODEL, contents: prompt, config });
}

/**
 * A ModelCaller over the server's Gemini client, so the split-and-reassemble path in llmSplit.ts
 * can drive the server exactly the way it drives the on-device clients.
 */
function makeServerCaller(ai: any): ModelCaller {
  return async (prompt, opts) => {
    const response = await generateContent(ai, prompt, opts?.grounded !== false);
    return response?.text || "";
  };
}

/**
 * Call Gemini with backoff on transient failures, plus one ungrounded retry when Google Search
 * grounding specifically is what ran out.
 *
 * Grounding draws on a separate, much smaller quota than the model itself, so a grounded call
 * failing says nothing about whether the key has quota left - dropping grounding usually gets
 * straight through (at the cost of guessed rather than searched resource links).
 *
 * Hard quota and auth failures are NOT retried: they are the same in five seconds, and retrying
 * only delays an accurate message to the user.
 */
async function callGeminiApiWithRetry(ai: any, prompt: string, useSearch: boolean = true) {
  try {
    return await withBurstRetry(() => generateContent(ai, prompt, useSearch), {
      attempts: 3,
      onRetry: ({ attempt, waitMs, failure }) =>
        console.warn(`[Gemini API] ${failure.kind} (attempt ${attempt}). Retrying in ${waitMs}ms.`),
    });
  } catch (err: any) {
    // Grounding is provisioned separately from the model, so a key that cannot use it (free tier,
    // no billing, unsupported model) rejects the *tool* - sometimes with an error that mentions
    // neither quotas nor grounding. Retrying without it is cheap and always preferable to failing,
    // so this covers every failure except the ones that are about the key itself.
    const kind = classifyFailure(err).kind;
    if (useSearch && kind !== "auth_error" && kind !== "quota_exhausted" && kind !== "server_key_missing") {
      console.warn(`[Gemini API] Grounded call failed (${kind}). Retrying without search grounding.`);
      return await withBurstRetry(() => generateContent(ai, prompt, false), { attempts: 2 });
    }
    throw err;
  }
}

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Generate Tree Route
app.post("/api/generate-tree", generateTreeLimiter, async (req, res) => {
  const { topic, language = "he", depthLevel = "comprehensive", customInstructions = "" } = req.body;
  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: "נושא הוא שדה חובה" });
  }
  if (!hasServerKey()) return serverKeyMissingResponse(res);

  // Node-count & coverage guidance driven by the depthLevel the user picked in the UI
  // ('basic' | 'comprehensive' | 'mastery') - previously this field was accepted but ignored,
  // so every generated tree got the same node count regardless of the user's chosen scope.
  const depthGuidance = depthLevel === "basic"
    ? "Provide exactly 4 to 5 nodes forming a focused, essential prerequisite tree covering only the most critical must-know concepts. Prioritize breadth of the absolute fundamentals over depth."
    : depthLevel === "mastery"
    ? "Provide 8 to 12 nodes forming an in-depth, comprehensive prerequisite tree that thoroughly covers foundation, core, advanced, AND specialization concepts. Explicitly identify and fill every important prerequisite knowledge gap a learner would need to close to reach true mastery-level understanding of the topic - do not stop at a shallow overview."
    : "Provide 6 to 8 nodes forming a well-rounded prerequisite tree covering foundation, core, and initial advanced concepts.";

  try {
    const ai = getGeminiClient();

    const prompt = `You are an expert academic curriculum designer and knowledge tree builder.
Build a comprehensive visual learning pathway tree for the topic: "${topic.trim()}".
Language requested: ${language === 'he' ? 'Hebrew (עברית)' : 'English or prompt language'}.

YOUR GOAL:
Create a complete visual learning tree starting from fundamental prerequisite roots up to advanced modules, giving
the learner a comprehensive, broad picture of everything they still need to learn or complete to bring their
knowledge of "${topic.trim()}" up to the requested depth level. Requested scope: ${depthGuidance}
For EACH node in the learning tree, provide a rich, multi-platform collection of 4 to 6 REAL, VERIFIED study resources:
1. University Web Courses & OpenCourseWare (e.g. Campus IL, Technion, Open University Israel, MIT OpenCourseWare, Harvard Online, Stanford Online, edX, Coursera)
2. Full University Courses & Playlists on YouTube (e.g. Technion lectures, Hebrew University courses, Harvard CS50, MIT OCW playlists, 3Blue1Brown, FreeCodeCamp, Khan Academy Hebrew)
3. Professional & Practical Courses (e.g. Udemy, Pluralsight, Coursera Guided Projects, Campus IL)
4. Authoritative Books & Electronic Books (e.g., OpenStax textbooks, O'Reilly books, Google Books, Hebrew Academic Coursebooks, Cambridge / Oxford Press)
5. Academic PDFs, Research Papers & Official Documentation (e.g., arXiv, Google Scholar papers, W3C, RFCs, IEEE, Official Specs)

HEBREW & ACADEMIC YOUTUBE SEARCH MANDATE:
- ACTIVELY SEARCH FOR HEBREW COURSES AND RESOURCES: Search for courses on Campus IL (קמפוס IL), Open University Israel (האוניברסיטה הפתוחה), Technion YouTube playlists, Tel Aviv University, and Hebrew Wikipedia/textbooks when available.
- COMPREHENSIVE YOUTUBE UNIVERSITY SEARCH: Thoroughly search YouTube for FULL ACADEMIC COURSES, university video lecture playlists, and complete educational series on "${topic.trim()}" (from Technion, Hebrew U, MIT OCW, Harvard, Stanford, freeCodeCamp, etc.). Include exact YouTube video or playlist links whenever found.

Structure requirements:
Return ONLY a valid JSON object with the following structure (no prose outside JSON):

{
  "topic": "${topic.trim()}",
  "description": "A comprehensive summary of the topic learning pathway",
  "nodes": [
    {
      "id": "node_root",
      "title": "Root Topic Title",
      "description": "Overview of the root topic",
      "level": "foundation",
      "isBaseNode": true,
      "parentId": null,
      "items": [
        "Sub-topic objective 1 to check off",
        "Sub-topic objective 2 to check off",
        "Sub-topic objective 3 to check off"
      ],
      "resources": [
        {
          "title": "Specific Course / Video / eBook / PDF title",
          "type": "youtube | course_free | course_paid | book | article | doc",
          "url": "https://...",
          "provider": "Coursera / edX / Udemy / MIT OCW / OpenStax / Google Scholar / YouTube",
          "description": "Short explanation of why this source is helpful",
          "isVerifiedAcademic": true
        }
      ]
    },
    {
      "id": "node_foundation_1",
      "title": "Prerequisite / Foundational Module 1",
      "description": "Explanation of base concept needed first",
      "level": "foundation",
      "isBaseNode": true,
      "parentId": "node_root",
      "items": ["Concept 1", "Concept 2"],
      "resources": [...]
    },
    {
      "id": "node_core_1",
      "title": "Core Topic Module 1",
      "description": "Core knowledge build up",
      "level": "core",
      "isBaseNode": false,
      "parentId": "node_foundation_1",
      "items": [...],
      "resources": [...]
    },
    {
      "id": "node_advanced_1",
      "title": "Advanced Application",
      "description": "Deep dive and mastery",
      "level": "advanced",
      "isBaseNode": false,
      "parentId": "node_core_1",
      "items": [...],
      "resources": [...]
    }
  ]
}

Instructions:
- ${depthGuidance}
- DIRECT & FREE RESOURCES MANDATE: Search Google deeply to find specific courses (e.g. MIT OCW, Coursera, edX free audit, Khan Academy), specific high-value YouTube tutorials/channels (e.g. 3Blue1Brown, freeCodeCamp, CrashCourse, CS50), direct Wikipedia articles (in Hebrew or English), open academic books (OpenStax), and MDN/arXiv docs.
- EVERY RESOURCE MUST HAVE A DIRECT URL LEADING STRAIGHT TO THE KNOWLEDGE SOURCE (e.g., "https://he.wikipedia.org/wiki/...", "https://ocw.mit.edu/courses/...", "https://www.khanacademy.org/...", "https://www.youtube.com/watch?v=...").
- IF YOU ARE NOT CONFIDENT A SPECIFIC URL IS CORRECT AND CURRENTLY VALID, LEAVE "url" AS AN EMPTY STRING ("") INSTEAD OF GUESSING. The server automatically supplies a reliable, working fallback link (a targeted search page on the right platform) whenever "url" is empty - a confidently wrong/broken link is worse for the learner than an empty one.
- STRICTLY FORBIDDEN: Do NOT return generic homepage or search URLs (such as google.com/search or generic landing pages).
- DIVERSITY OF SOURCES: Every node MUST include at least 1 University/MOOC course, 1 YouTube video/channel, 1 Book/eBook, and 1 Article/PDF/Doc.
- CRITICAL RULE ON TOPICS: Avoid duplicate or highly overlapping nodes. If there are topics that collide, merge them into a single comprehensive node.
- Ensure every node has at least 3-5 checklist items and 4-6 diverse, verified study resources.
- ${language === 'he' ? 'Write titles, descriptions, and items in clear, natural HEBREW. Resource titles can be in Hebrew or English if originally in English.' : 'Write titles, descriptions, and items clearly in ENGLISH.'}
${customInstructions ? `Additional user instructions: ${customInstructions}` : ''}`;

    const response = await callGeminiApiWithRetry(ai, prompt, true);

    const text = response.text || "";
    let parsedTreeData;
    try {
      parsedTreeData = parseJsonFromGemini(text);
    } catch (parseErr) {
      // A truncated / malformed response is usually an output-size problem, and the split path
      // asks for a fraction of that output per call - so rebuild rather than serve filler.
      console.warn("JSON parse warning from Gemini tree response, rebuilding via split requests:", parseErr?.message || parseErr);
      try {
        const split = await generateTreeViaSplit(makeServerCaller(ai), topic, language, depthLevel, undefined);
        return res.json({ success: true, tree: split.tree, isSplit: true, isPartial: split.partial });
      } catch (splitErr: any) {
        const kind = classifyFailure(splitErr).kind;
        console.warn("Split rebuild failed after parse error:", splitErr?.message || splitErr);
        return res.status(statusForFailure(kind)).json({
          success: false,
          fallbackReason: kind === "api_error" ? "parse_error" : kind,
          error: "לא התקבלה תגובה תקינה מהבינה המלאכותית.",
        });
      }
    }

    // Extract search grounding metadata and filter out search engine query pages
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const searchSourcesUsed = groundingChunks
      .map((chunk: any) => chunk?.web)
      .filter((web: any) => web && web.uri && !web.uri.includes('google.com/search') && !web.uri.includes('youtube.com/results'))
      .map((web: any) => ({ title: web.title || web.uri, uri: web.uri }));

    // Transform into standard LearningTree model
    const now = new Date().toISOString();
    const treeId = `tree_${Date.now()}`;
    const nodesRecord: Record<string, any> = {};
    const isHe = language === 'he';

    let rootNodeId = "node_root";
    if (parsedTreeData.nodes && Array.isArray(parsedTreeData.nodes)) {
      parsedTreeData.nodes.forEach((rawNode: any, idx: number) => {
        const nodeId = rawNode.id || `node_${idx}`;
        if (idx === 0) rootNodeId = nodeId;

        nodesRecord[nodeId] = {
          id: nodeId,
          title: rawNode.title || (isHe ? `שלב ${idx + 1}` : `Step ${idx + 1}`),
          description: rawNode.description || "",
          level: rawNode.level || (idx === 0 ? "foundation" : idx > 4 ? "advanced" : "core"),
          isBaseNode: rawNode.isBaseNode ?? (idx <= 1),
          parentId: rawNode.parentId || (idx === 0 ? null : rootNodeId),
          childrenIds: [],
          completed: false,
          items: Array.isArray(rawNode.items)
            ? rawNode.items.map((itemText: string, iIdx: number) => ({
                id: `${nodeId}_item_${iIdx}`,
                text: typeof itemText === "string" ? itemText : (itemText as any).text || (isHe ? "נושא ללמידה" : "Topic to learn"),
                completed: false,
              }))
            : [],
          resources: Array.isArray(rawNode.resources)
            ? rawNode.resources.map((res: any, rIdx: number) => ({
                id: `${nodeId}_res_${rIdx}`,
                title: res.title || (isHe ? "מקור לימוד" : "Learning Resource"),
                type: res.type || "article",
                url: sanitizeResourceUrl(res.url, res.title || topic, topic, res.type || "article"),
                provider: res.provider || (isHe ? "מקור אקדמי / ברשת" : "Academic / Web Source"),
                description: res.description || "",
                isVerifiedAcademic: res.isVerifiedAcademic ?? true,
                completed: false,
              }))
            : [],
        };
      });

      // Populate childrenIds based on parentId references
      Object.values(nodesRecord).forEach((node: any) => {
        if (node.parentId && nodesRecord[node.parentId]) {
          if (!nodesRecord[node.parentId].childrenIds.includes(node.id)) {
            nodesRecord[node.parentId].childrenIds.push(node.id);
          }
        }
      });

      await verifyAndFixResourceUrls(Object.values(nodesRecord), topic);
    }

    const learningTree = {
      id: treeId,
      topic: parsedTreeData.topic || topic,
      description: parsedTreeData.description || (isHe ? `עץ למידה מקיף עבור ${topic}` : `Comprehensive learning tree for ${topic}`),
      createdAt: now,
      updatedAt: now,
      rootNodeId,
      nodes: nodesRecord,
      category: "current",
      searchSourcesUsed,
    };

    return res.json({ success: true, tree: learningTree });
  } catch (err: any) {
    const failure = classifyFailure(err);
    if (failure.kind === "server_key_missing") return serverKeyMissingResponse(res);
    console.warn(`Gemini generate-tree failed (${failure.kind}):`, err?.message || err);

    // A short-term burst limit means the request was too big for right now, not that the key is
    // spent - so rebuild the same tree from one small outline call plus spaced detail calls.
    if (failure.kind === "rate_limit" || failure.kind === "grounding_limit") {
      try {
        const split = await generateTreeViaSplit(makeServerCaller(getGeminiClient()), topic, language, depthLevel, failure);
        return res.json({ success: true, tree: split.tree, isSplit: true, isPartial: split.partial });
      } catch (splitErr: any) {
        console.warn("Split rebuild failed after rate limit:", splitErr?.message || splitErr);
      }
    }

    // Report the real failure with a real status code. The client then falls through to the
    // user's own on-device key, which is exactly what it could never do while this returned 200.
    return res.status(statusForFailure(failure.kind)).json({
      success: false,
      fallbackReason: failure.kind,
      fallbackDetail: failure.detail,
      retryAfterMs: failure.retryAfterMs,
      error: "הפנייה לבינה המלאכותית נכשלה.",
    });
  }
});

// Expand Node Route - Creates sub-branches under a chosen node
app.post("/api/expand-node", expandNodeLimiter, async (req, res) => {
  const { treeTopic, nodeId, nodeTitle, nodeDescription, nodeDepth = 0, ancestors = [], existingTitles, existingTreeContext = "", language = "he" } = req.body;
  if (!treeTopic || !nodeId || !nodeTitle) {
    return res.status(400).json({ error: "פרטי הנושא והצומת חסרים" });
  }
  if (!hasServerKey()) return serverKeyMissingResponse(res);

  // Hard safety ceiling only (bounds cost / prevents runaway trees) - deliberately generous so it
  // doesn't block expansion attempts in advance at shallow depths. Normal stopping happens earlier,
  // organically, once the anti-repetition rules below determine there's nothing distinct left to add.
  if (nodeDepth >= MAX_NODE_EXPANSION_DEPTH) {
    return res.json({
      success: true,
      isEndOfTopic: true,
      subNodes: [],
      message: language === 'he' ? "הענף הגיע לעומק מפורט מרבי" : "Branch reached maximum depth level"
    });
  }

  // Titles already in the tree, used for the anti-repetition prompt and for dedup. Prefers the
  // array form; the old comma-joined string is still accepted but shredded any title containing a
  // comma into fragments that then matched far too eagerly (see normalizeExistingTitles).
  const existingTitlesList: string[] = normalizeExistingTitles(existingTitles, existingTreeContext);

  const ancestorChain = Array.isArray(ancestors) ? ancestors.filter(Boolean) : [];

  try {
    const ai = getGeminiClient();

    const prompt = `You are an expert academic curriculum designer.
We are building a structured learning pathway tree for the general subject: "${treeTopic}".
The user wants to EXPAND the following node:
Node Title: "${nodeTitle}"
Node Description: "${nodeDescription}"
Current Hierarchy Depth: Level ${nodeDepth} out of ${MAX_NODE_EXPANSION_DEPTH}.
Ancestor Hierarchy Chain: ${ancestorChain.length > 0 ? ancestorChain.map(a => `"${a}"`).join(' -> ') : 'Root Topic'}

RULES:
1. Existing nodes ALREADY in this learning tree (avoid recreating these):
${existingTitlesList.map(t => `- "${t}"`).join('\n')}

2. Only reject a candidate sub-topic if it would teach essentially the same concept as one of the existing titles above (a reworded duplicate). Being about the same general parent subject is EXPECTED and desirable - that IS what makes it a relevant sub-topic.
3. Prefer specific, concrete titles over generic prefixes like "Introduction to...", "Basics of...", "Advanced...", "מבוא ל...", "יסודות...", "מתקדם...".
4. Almost every topic - even a seemingly specific one - can still be broken down further: deeper mechanisms, specific techniques or tools, notable edge cases, real-world applications, common pitfalls, comparisons with alternatives, or historical/theoretical context not yet covered by the existing titles. Make a genuine, thorough effort to find such angles before concluding there is nothing left. Returning an empty array should be rare - reserve it for cases where "${nodeTitle}" is truly a single atomic fact or every reasonable angle is already covered above, not merely because a topic feels narrow.
5. Dig for BREADTH of angle, not just theoretical depth: practical applications, hands-on tools/frameworks, case studies, comparisons, or the historical development of the idea are all valid, distinct sub-topics even if the parent node already covers the core theory.

Language requested: ${language === 'he' ? 'Hebrew (עברית)' : 'English or prompt language'}.

Generate 3 to 5 detailed, distinct SUB-BRANCH NODES if any reasonable ones exist (see rule 4) - only return fewer, or an empty array, if you genuinely cannot find that many non-overlapping angles.
Use Google Search Grounding to research the topic deeply and find real, verified learning sources.

Return ONLY a valid JSON object matching this structure:
{
  "expandedSubNodes": [
    {
      "id": "subnode_1",
      "title": "Detailed Distinct Sub-Branch Title",
      "description": "Specific focus area explanation",
      "level": "core | advanced | specialization",
      "isBaseNode": false,
      "items": [
        "Subtopic item 1",
        "Subtopic item 2",
        "Subtopic item 3"
      ],
      "resources": [
        {
          "title": "Specific Course / Video / Book title",
          "type": "youtube | course_free | course_paid | book | article | doc",
          "url": "https://...",
          "provider": "Channel / Platform / Author",
          "description": "Why this specific resource helps master this subnode",
          "isVerifiedAcademic": true
        }
      ]
    }
  ]
}

Instructions:
- All titles, descriptions, and checklist items must be in ${language === 'he' ? 'Hebrew' : 'English'}.
- HEBREW & ACADEMIC YOUTUBE SEARCH MANDATE: Search for Hebrew courses on Campus IL (קמפוס IL), Open University Israel, Technion, Tel Aviv U, and Hebrew YouTube lecture playlists whenever available.
- COMPREHENSIVE YOUTUBE UNIVERSITY SEARCH: Actively search YouTube for full university course playlists and video series from Technion, Hebrew U, MIT OCW, Harvard CS50, Stanford, and top educational channels relevant to "${nodeTitle}".
- DIRECT & FREE RESOURCES MANDATE: Use Google Search to deeply search for actual study courses (Campus IL, Khan Academy, MIT OCW, Coursera, edX free audit), specific high-quality YouTube educational videos, direct Wikipedia articles, open textbooks (OpenStax), and MDN/arXiv papers.
- YOU MUST return the direct URL leading straight to the specific resource page (e.g., "https://he.wikipedia.org/wiki/...", "https://ocw.mit.edu/courses/...", "https://www.khanacademy.org/...", "https://www.youtube.com/watch?v=...").
- IF YOU ARE NOT CONFIDENT A SPECIFIC URL IS CORRECT AND CURRENTLY VALID, LEAVE "url" AS AN EMPTY STRING ("") INSTEAD OF GUESSING. The server automatically supplies a reliable, working fallback link whenever "url" is empty - a confidently wrong/broken link is worse for the learner than an empty one.
- STRICTLY FORBIDDEN: Do NOT return generic homepage or search URLs.
- Make sure each subnode is strictly relevant to "${nodeTitle}" within the overarching context of "${treeTopic}".
- Provide 3-5 checklist items and 2-4 highly reputable, verified resources per subnode.`;

    const response = await callGeminiApiWithRetry(ai, prompt, true);

    const text = response.text || "";
    let parsedData;
    try {
      parsedData = parseJsonFromGemini(text);
    } catch (parseErr) {
      // Truncated / malformed JSON is an output-size problem more often than a model problem, and
      // each split call asks for a fraction of that output - so rebuild instead of serving filler.
      console.warn("JSON parse warning on expand node, rebuilding via split requests:", parseErr?.message || parseErr);
      try {
        const split = await expandNodeViaSplit(
          makeServerCaller(ai),
          { treeTopic, nodeId, nodeTitle, nodeDescription, ancestorChain, existingTitlesList, language },
          undefined
        );
        return res.json({
          success: true,
          parentNodeId: nodeId,
          subNodes: split.subNodes,
          isEndOfTopic: split.isEndOfTopic,
          isSplit: true,
          isPartial: split.partial,
        });
      } catch (splitErr: any) {
        const kind = classifyFailure(splitErr).kind;
        console.warn("Split rebuild failed after parse error:", splitErr?.message || splitErr);
        return res.status(statusForFailure(kind)).json({
          success: false,
          fallbackReason: kind === "api_error" ? "parse_error" : kind,
          error: "לא התקבלה תגובה תקינה מהבינה המלאכותית.",
        });
      }
    }

    const createdSubNodes: any[] = [];
    const isHe = language === 'he';
    const seenTitlesInBatch = new Set<string>();

    if (parsedData.expandedSubNodes && Array.isArray(parsedData.expandedSubNodes)) {
      parsedData.expandedSubNodes.forEach((rawSub: any, idx: number) => {
        const subTitle = (rawSub.title || '').trim();
        if (!subTitle) return;

        // Strict Server Deduplication against existing titles & current batch
        const isDuplicateOfExisting = existingTitlesList.some(ex => areServerTitlesSimilar(subTitle, ex));
        const isDuplicateInBatch = Array.from(seenTitlesInBatch).some(prev => areServerTitlesSimilar(subTitle, prev));

        if (isDuplicateOfExisting || isDuplicateInBatch) {
          console.log(`[Deduplicator] Filtered duplicate subnode title: "${subTitle}"`);
          return; // Skip duplicate
        }

        seenTitlesInBatch.add(subTitle);

        const subId = `${nodeId}_sub_${Date.now()}_${idx}`;
        const newNode = {
          id: subId,
          title: subTitle,
          description: rawSub.description || "",
          level: rawSub.level || "specialization",
          isBaseNode: false,
          parentId: nodeId,
          childrenIds: [],
          completed: false,
          items: Array.isArray(rawSub.items)
            ? rawSub.items.map((itemText: string, iIdx: number) => ({
                id: `${subId}_item_${iIdx}`,
                text: typeof itemText === "string" ? itemText : (itemText as any).text || (isHe ? "נושא ללמידה" : "Topic to learn"),
                completed: false,
              }))
            : [],
          resources: Array.isArray(rawSub.resources)
            ? rawSub.resources.map((res: any, rIdx: number) => ({
                id: `${subId}_res_${rIdx}`,
                title: res.title || (isHe ? "מקור מומלץ" : "Recommended Source"),
                type: res.type || "youtube",
                url: sanitizeResourceUrl(res.url, res.title || nodeTitle, treeTopic, res.type || "youtube"),
                provider: res.provider || (isHe ? "מקור אקדמי" : "Academic Source"),
                description: res.description || "",
                isVerifiedAcademic: res.isVerifiedAcademic ?? true,
                completed: false,
              }))
            : [],
        };
        createdSubNodes.push(newNode);
      });
    }

    await verifyAndFixResourceUrls(createdSubNodes, treeTopic);

    const isEndOfTopic = createdSubNodes.length === 0;
    return res.json({ success: true, parentNodeId: nodeId, subNodes: createdSubNodes, isEndOfTopic });
  } catch (err: any) {
    const failure = classifyFailure(err);
    if (failure.kind === "server_key_missing") return serverKeyMissingResponse(res);
    console.warn(`Gemini expand-node failed (${failure.kind}):`, err?.message || err);

    // Short-term burst limit: the request was too much right now, not proof the key is spent.
    // Rebuild the sub-branches from one small outline call plus spaced detail calls.
    if (failure.kind === "rate_limit" || failure.kind === "grounding_limit") {
      try {
        const split = await expandNodeViaSplit(
          makeServerCaller(getGeminiClient()),
          { treeTopic, nodeId, nodeTitle, nodeDescription, ancestorChain, existingTitlesList, language },
          failure
        );
        return res.json({
          success: true,
          parentNodeId: nodeId,
          subNodes: split.subNodes,
          isEndOfTopic: split.isEndOfTopic,
          isSplit: true,
          isPartial: split.partial,
        });
      } catch (splitErr: any) {
        console.warn("Split rebuild failed after rate limit:", splitErr?.message || splitErr);
      }
    }

    // Report the real failure with a real status code, and deliberately WITHOUT isEndOfTopic: an
    // API failure is not a finding that the topic has nothing left to teach. Sending isEndOfTopic
    // here used to let the client permanently disable this branch's expand button.
    return res.status(statusForFailure(failure.kind)).json({
      success: false,
      parentNodeId: nodeId,
      fallbackReason: failure.kind,
      fallbackDetail: failure.detail,
      retryAfterMs: failure.retryAfterMs,
      error: "הרחבת הענף נכשלה.",
    });
  }
});

// Vite Development or Static Production Server Setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LearningTree AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
