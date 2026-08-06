import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { MAX_NODE_EXPANSION_DEPTH } from "./src/lib/constants";

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
  message: { error: "יותר מדי בקשות ליצירת עצי למידה. נסה שוב בעוד כמה דקות." },
});

const expandNodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "יותר מדי בקשות להרחבת ענפים. נסה שוב בעוד כמה דקות." },
});

// Initialize Gemini Client safely on the server
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
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

// Helper to build fallback Learning Tree when AI rate limit / quota is exceeded or unavailable
function buildFallbackTree(topic: string, language: 'he' | 'en' = 'he') {
  const now = new Date().toISOString();
  const treeId = `tree_${Date.now()}`;
  const rootNodeId = "node_root";
  const cleanTopic = topic.trim();
  const isHe = language === 'he';

  const nodesRecord: Record<string, any> = {
    [rootNodeId]: {
      id: rootNodeId,
      title: cleanTopic,
      description: isHe 
        ? `נתיב למידה מקיף ומדורג לרכישת שליטה ב-${cleanTopic}, החל מיסודות ועד להתמחות מתקדמת.`
        : `Comprehensive and progressive learning path to master ${cleanTopic}, from fundamentals to advanced specialization.`,
      level: "foundation",
      isBaseNode: true,
      parentId: null,
      childrenIds: ["node_foundation_1", "node_core_1"],
      completed: false,
      items: [
        { id: `${rootNodeId}_item_0`, text: isHe ? `הבנת התמונה הרחבה וחשיבות ${cleanTopic}` : `Understand the big picture and importance of ${cleanTopic}`, completed: false },
        { id: `${rootNodeId}_item_1`, text: isHe ? `הכרת המונחים המרכזיים ומפת הדרכים` : `Get familiar with core terminology and roadmap`, completed: false },
        { id: `${rootNodeId}_item_2`, text: isHe ? `קביעת יעדים ומדדי הצלחה אישיים בלמידה` : `Set goals and personal success metrics`, completed: false },
      ],
      resources: [
        {
          id: `${rootNodeId}_res_0`,
          title: isHe ? `קורס אוניברסיטאי: מבוא ל-${cleanTopic}` : `University Course: Intro to ${cleanTopic}`,
          type: "course_free",
          url: sanitizeResourceUrl("", cleanTopic, cleanTopic, "course_free"),
          provider: "edX / Harvard & MIT Online",
          description: isHe ? "קורס אקדמי פתוח מאת אוניברסיטות מובילות" : "Open academic course from top universities",
          isVerifiedAcademic: true,
          completed: false,
        },
        {
          id: `${rootNodeId}_res_1`,
          title: isHe ? `סדרת הרצאות וידאו: ${cleanTopic}` : `Video Lecture Series: ${cleanTopic}`,
          type: "youtube",
          url: sanitizeResourceUrl("", cleanTopic, cleanTopic, "youtube"),
          provider: "YouTube Academic / MIT OCW",
          description: isHe ? "סדרת הרצאות ויזואליות מומלצות" : "Recommended visual video lectures",
          isVerifiedAcademic: true,
          completed: false,
        },
        {
          id: `${rootNodeId}_res_2`,
          title: isHe ? `ספר לימוד וספר אלקטרוני (eBook): ${cleanTopic}` : `Textbook & Electronic eBook: ${cleanTopic}`,
          type: "book",
          url: sanitizeResourceUrl("", cleanTopic, cleanTopic, "book"),
          provider: "OpenStax / Google Books",
          description: isHe ? "ספר עיון אקדמי פתוח ונגיש" : "Open and accessible academic reference book",
          isVerifiedAcademic: true,
          completed: false,
        }
      ],
    },
    "node_foundation_1": {
      id: "node_foundation_1",
      title: isHe ? `יסודות ועקרונות בסיסיים ב-${cleanTopic}` : `Fundamentals and Basic Principles of ${cleanTopic}`,
      description: isHe ? `הקנאת התשתית התיאורטית ומושגי היסוד ההכרחיים לפני מעבר ליישומים מורכבים.` : `Building theoretical groundwork and essential concepts before moving to complex applications.`,
      level: "foundation",
      isBaseNode: true,
      parentId: rootNodeId,
      childrenIds: ["node_core_2"],
      completed: false,
      items: [
        { id: "node_foundation_1_item_0", text: isHe ? `לימוד מושגי יסוד והגדרות מפתח ב-${cleanTopic}` : `Study core concepts and key definitions in ${cleanTopic}`, completed: false },
        { id: "node_foundation_1_item_1", text: isHe ? `סיווג תתי-התחומים והקשרים ביניהם` : `Categorize subfields and their relations`, completed: false },
        { id: "node_foundation_1_item_2", text: isHe ? `תרגול הבנה בסיסית ופתרון שאלות יסוד` : `Practice basic understanding and foundational questions`, completed: false },
      ],
      resources: [
        {
          id: "node_foundation_1_res_0",
          title: isHe ? `קורס Coursera: יסודות ${cleanTopic}` : `Coursera Course: ${cleanTopic} Foundations`,
          type: "course_free",
          url: "https://www.coursera.org/",
          provider: "Coursera / Stanford & Yale Online",
          description: isHe ? "מסלול לימוד מובנה עם תרגול אינטראקטיבי" : "Structured learning track with interactive practice",
          isVerifiedAcademic: true,
          completed: false,
        },
        {
          id: "node_foundation_1_res_1",
          title: isHe ? `קורס מעשי מקיף ב-Udemy` : `Comprehensive Practical Course on Udemy`,
          type: "course_paid",
          url: "https://www.udemy.com/",
          provider: "Udemy Professional",
          description: isHe ? "קורס וידאו מעשי הכולל תרגול hands-on" : "Practical hands-on video course with projects",
          isVerifiedAcademic: false,
          completed: false,
        },
        {
          id: "node_foundation_1_res_2",
          title: isHe ? `מאמר אקדמי ומסמך יסוד` : `Academic Paper & Core Article`,
          type: "article",
          url: sanitizeResourceUrl("", cleanTopic, cleanTopic, "article"),
          provider: "Wikipedia / Academic Sources",
          description: isHe ? "מאמרי סקירה אקדמיים ומסמכי יסוד" : "Academic review papers and foundational documents",
          isVerifiedAcademic: true,
          completed: false,
        }
      ],
    },
    "node_core_1": {
      id: "node_core_1",
      title: isHe ? `ליבת התחום ומתודולוגיות מרכזיות` : `Core Domain and Key Methodologies`,
      description: isHe ? `העמקה בטכניקות העבודה, הכלים והעקרונות המרכזיים ב-${cleanTopic}.` : `Deep dive into working techniques, tools, and central principles in ${cleanTopic}.`,
      level: "core",
      isBaseNode: false,
      parentId: rootNodeId,
      childrenIds: ["node_advanced_1"],
      completed: false,
      items: [
        { id: "node_core_1_item_0", text: isHe ? `ניתוח מתודולוגיות מפתח ב-${cleanTopic}` : `Analyze key methodologies in ${cleanTopic}`, completed: false },
        { id: "node_core_1_item_1", text: isHe ? `עבודה עם כלי עזר ומקורות נתונים מרכזיים` : `Working with primary tools and data sources`, completed: false },
        { id: "node_core_1_item_2", text: isHe ? `יישום תרגילים מעשיים ברמת ליבה` : `Implement core level practical exercises`, completed: false },
      ],
      resources: [
        {
          id: "node_core_1_res_0",
          title: isHe ? `ספר אקדמי וספר אלקטרוני: ${cleanTopic}` : `Textbook & eBook: ${cleanTopic}`,
          type: "book",
          url: sanitizeResourceUrl("", cleanTopic, cleanTopic, "book"),
          provider: "Cambridge / OpenStax / O'Reilly",
          description: isHe ? "ספר עיון מוביל המכסה את כל נושאי הליבה" : "Leading reference book covering all core subjects",
          isVerifiedAcademic: true,
          completed: false,
        },
        {
          id: "node_core_1_res_1",
          title: isHe ? `תיעוד ומדריך רשמי (Official Documentation)` : `Official Documentation & Web Guide`,
          type: "doc",
          url: sanitizeResourceUrl("", cleanTopic, cleanTopic, "doc"),
          provider: "Official Docs / Standards Body",
          description: isHe ? "תיעוד רשמי ומפרט טכני מוסמך" : "Official authoritative documentation and specs",
          isVerifiedAcademic: true,
          completed: false,
        }
      ],
    },
    "node_core_2": {
      id: "node_core_2",
      title: isHe ? `יישום מעשי ופתרון בעיות ב-${cleanTopic}` : `Practical Application and Problem Solving in ${cleanTopic}`,
      description: isHe ? `מעבר מתאוריה למעשה, בניית פרויקטים וניתוח מקרי בוחן (Case Studies).` : `Moving from theory to practice, building projects, and analyzing case studies.`,
      level: "core",
      isBaseNode: false,
      parentId: "node_foundation_1",
      childrenIds: [],
      completed: false,
      items: [
        { id: "node_core_2_item_0", text: isHe ? `בחינת מקרי בוחן מעשיים מהתעשייה/האקדמיה` : `Examine practical case studies from industry/academia`, completed: false },
        { id: "node_core_2_item_1", text: isHe ? `פתרון בעיות מורכבות ואיתור שגיאות נפוצות` : `Solve complex problems and identify common errors`, completed: false },
        { id: "node_core_2_item_2", text: isHe ? `בניית פרויקט אישי קטן ליישום הנלמד` : `Build a small personal project to apply learnings`, completed: false },
      ],
      resources: [
        {
          id: "node_core_2_res_0",
          title: isHe ? `פרויקטים מעשיים ב-Udemy & Coursera` : `Practical Projects on Udemy & Coursera`,
          type: "course_paid",
          url: "https://www.udemy.com/",
          provider: "Udemy / Coursera Guided Projects",
          description: isHe ? "סדנת פרויקטים מעשית לבנייה Hands-on" : "Guided hands-on project workshop",
          isVerifiedAcademic: false,
          completed: false,
        },
        {
          id: "node_core_2_res_1",
          title: isHe ? `סרטון הדרכה ויזואלי ב-YouTube` : `Visual Tutorial Video on YouTube`,
          type: "youtube",
          url: sanitizeResourceUrl("", cleanTopic, cleanTopic, "youtube"),
          provider: "FreeCodeCamp / YouTube Tech",
          description: isHe ? "סרטון פרויקט מודרך שלב אחר שלב" : "Step-by-step guided project video tutorial",
          isVerifiedAcademic: true,
          completed: false,
        }
      ],
    },
    "node_advanced_1": {
      id: "node_advanced_1",
      title: isHe ? `נושאים מתקדמים ומחקר ב-${cleanTopic}` : `Advanced Topics and Research in ${cleanTopic}`,
      description: isHe ? `חקר חזית הידע, מגמות עדכניות וטכניקות מתקדמות של מומחים.` : `Exploring the frontier of knowledge, current trends, and expert advanced techniques.`,
      level: "advanced",
      isBaseNode: false,
      parentId: "node_core_1",
      childrenIds: [],
      completed: false,
      items: [
        { id: "node_advanced_1_item_0", text: isHe ? `סקירת מאמרים ומגמות חדשניות ב-${cleanTopic}` : `Review innovative articles and trends in ${cleanTopic}`, completed: false },
        { id: "node_advanced_1_item_1", text: isHe ? `אופטימיזציה, יעילות ואסטרטגיות מתקדמות` : `Optimization, efficiency, and advanced strategies`, completed: false },
        { id: "node_advanced_1_item_2", text: isHe ? `סיכום אישי ומצגת פרויקט גמר` : `Personal summary and final project presentation`, completed: false },
      ],
      resources: [
        {
          id: "node_advanced_1_res_0",
          title: isHe ? `מאמרים ומחקרים אקדמיים (PDFs)` : `Academic Research & Papers (PDFs)`,
          type: "article",
          url: sanitizeResourceUrl("", cleanTopic, cleanTopic, "article"),
          provider: "Wikipedia / arXiv",
          description: isHe ? "ספריית מאמרים אקדמיים בחזית המחקר" : "Library of leading research papers at the scientific frontier",
          isVerifiedAcademic: true,
          completed: false,
        },
        {
          id: "node_advanced_1_res_1",
          title: isHe ? `קורס מתקדם מאת MIT & Harvard Online` : `Advanced Web Course by MIT & Harvard Online`,
          type: "course_free",
          url: "https://www.edx.org/",
          provider: "MIT / Harvard / edX",
          description: isHe ? "התמחות מתקדמת לרמת מומחה" : "Advanced specialization for expert mastery",
          isVerifiedAcademic: true,
          completed: false,
        }
      ],
    },
  };

  return {
    id: treeId,
    topic: cleanTopic,
    description: `עץ למידה מובנה ומקיף עבור ${cleanTopic}`,
    createdAt: now,
    updatedAt: now,
    rootNodeId,
    nodes: nodesRecord,
    category: "current",
    searchSourcesUsed: [
      { title: `edX & Coursera Courses: ${cleanTopic}`, uri: "https://www.edx.org/" },
      { title: `Academic & Research Papers: ${cleanTopic}`, uri: "https://arxiv.org/" },
      { title: `YouTube Academic & Video Lectures: ${cleanTopic}`, uri: "https://ocw.mit.edu/" }
    ],
  };
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

  // Substring containment check
  if (normA.length > 5 && normB.length > 5) {
    if (normA.includes(normB) || normB.includes(normA)) {
      return true;
    }
  }

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

  if (commonCore.length === minCoreLen) return true;

  const overlapRatio = commonCore.length / Math.max(coreA.length, coreB.length);
  if (overlapRatio >= 0.5) return true;

  return false;
}

// Helper to build fallback Sub-Nodes when AI rate limit / quota is exceeded or unavailable
function buildFallbackSubNodes(treeTopic: string, nodeId: string, nodeTitle: string, nodeDescription: string, language: 'he' | 'en' = 'he', existingTitlesList: string[] = []) {
  const timestamp = Date.now();
  const isHe = language === 'he';

  const cand1 = isHe ? `ניתוח מקרים מעשיים ב-${nodeTitle}` : `Practical Case Analysis in ${nodeTitle}`;
  const cand2 = isHe ? `אופטימיזציה וטכניקות מתקדמות ב-${nodeTitle}` : `Optimization & Advanced Techniques in ${nodeTitle}`;

  const candidates = [
    {
      id: `${nodeId}_sub_${timestamp}_0`,
      title: cand1,
      description: isHe ? `חקר מקרים יישומיים ותרגול מעשי של הכלים ב-${nodeTitle}.` : `Practical case exploration and hands-on exercises in ${nodeTitle}.`,
      level: "core",
      isBaseNode: false,
      parentId: nodeId,
      childrenIds: [],
      completed: false,
      items: [
        { id: `${nodeId}_sub_${timestamp}_0_item_0`, text: isHe ? `ניתוח תרחישי אמת ומקרי בוחן ב-${nodeTitle}` : `Analyze real scenarios and case studies in ${nodeTitle}`, completed: false },
        { id: `${nodeId}_sub_${timestamp}_0_item_1`, text: isHe ? `יישום פתרונות וזיהוי אתגרים מרכזיים` : `Implement solutions and identify key challenges`, completed: false },
      ],
      resources: [
        {
          id: `${nodeId}_sub_${timestamp}_0_res_0`,
          title: isHe ? `מדריך יישומי: ${nodeTitle}` : `Applied Guide: ${nodeTitle}`,
          type: "article",
          url: sanitizeResourceUrl("", nodeTitle, treeTopic, "article"),
          provider: isHe ? "מקור לימוד מאומת" : "Verified Learning Source",
          description: isHe ? "חומרי הדרכה מומלצים להעמקה מעשית" : "Recommended instructional materials for practical depth",
          isVerifiedAcademic: true,
          completed: false
        }
      ]
    },
    {
      id: `${nodeId}_sub_${timestamp}_1`,
      title: cand2,
      description: isHe ? `טכניקות מתקדמות, אופטימיזציה ומניעת שגיאות נפוצות ב-${nodeTitle}.` : `Advanced techniques, optimization, and error prevention in ${nodeTitle}.`,
      level: "advanced",
      isBaseNode: false,
      parentId: nodeId,
      childrenIds: [],
      completed: false,
      items: [
        { id: `${nodeId}_sub_${timestamp}_1_item_0`, text: isHe ? `אופטימיזציה ושיפור ביצועים ב-${nodeTitle}` : `Optimization and performance improvement in ${nodeTitle}`, completed: false },
        { id: `${nodeId}_sub_${timestamp}_1_item_1`, text: isHe ? `בחינת שגיאות נפוצות ואופן מניעתן` : `Examine common errors and how to prevent them`, completed: false },
      ],
      resources: [
        {
          id: `${nodeId}_sub_${timestamp}_1_res_0`,
          title: isHe ? `סרטון הסבר וטכניקות מתקדמות: ${nodeTitle}` : `Explanation & Advanced Techniques Video: ${nodeTitle}`,
          type: "youtube",
          url: sanitizeResourceUrl("", nodeTitle, treeTopic, "youtube"),
          provider: "YouTube Education",
          description: isHe ? "הסברים ויזואליים וניתוח מעמיק" : "Visual explanations and deep analysis",
          isVerifiedAcademic: true,
          completed: false
        }
      ]
    }
  ];

  return candidates.filter(cand => !existingTitlesList.some(ex => areServerTitlesSimilar(cand.title, ex)));
}

// Helper to call Gemini with retry and fallback on 429 quota / rate limits
async function callGeminiApiWithRetry(ai: any, prompt: string, useSearch: boolean = true) {
  const primaryConfig: any = {
    temperature: 0.2,
  };
  if (useSearch) {
    primaryConfig.tools = [{ googleSearch: {} }];
  }

  try {
    return await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: primaryConfig,
    });
  } catch (err: any) {
    const isRateLimit = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED");
    if (isRateLimit && useSearch) {
      console.warn("[Gemini API] 429 Rate Limit/Quota hit with Search Grounding. Retrying immediately WITHOUT search grounding...");
      try {
        return await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: { temperature: 0.2 },
        });
      } catch (retryErr: any) {
        console.warn("[Gemini API] 2nd attempt failed. Waiting 1.5s before final attempt...", retryErr?.message || retryErr);
        await new Promise((r) => setTimeout(r, 1500));
        return await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: { temperature: 0.2 },
        });
      }
    } else if (isRateLimit) {
      console.warn("[Gemini API] 429 Rate Limit hit. Waiting 1.5s before retry...");
      await new Promise((r) => setTimeout(r, 1500));
      return await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: { temperature: 0.2 },
      });
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
      console.warn("JSON parse warning from Gemini tree response, using fallback tree:", parseErr?.message || parseErr);
      const fallbackTree = buildFallbackTree(topic, language);
      return res.json({ success: true, tree: fallbackTree, isFallback: true });
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
    console.warn("Gemini API call failed or rate limited (429), generating intelligent fallback tree:", err?.message || err);
    const fallbackTree = buildFallbackTree(topic, language);
    return res.json({ success: true, tree: fallbackTree, isFallback: true });
  }
});

// Expand Node Route - Creates sub-branches under a chosen node
app.post("/api/expand-node", expandNodeLimiter, async (req, res) => {
  const { treeTopic, nodeId, nodeTitle, nodeDescription, nodeDepth = 0, ancestors = [], existingTreeContext = "", language = "he" } = req.body;
  if (!treeTopic || !nodeId || !nodeTitle) {
    return res.status(400).json({ error: "פרטי הנושא והצומת חסרים" });
  }

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

  // Parse existing titles array
  const existingTitlesList: string[] = existingTreeContext
    ? existingTreeContext.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

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

CRITICAL STRICT ANTI-REPETITION & ANTI-LOOP RULES:
1. Existing nodes ALREADY in this learning tree:
${existingTitlesList.map(t => `- "${t}"`).join('\n')}

2. YOU ARE STRICTLY FORBIDDEN FROM GENERATING SUB-BRANCHES THAT REPEAT, OVERLAP, OR RE-WORD ANY OF THE EXISTING TITLES LISTED ABOVE OR ANY ANCESTOR TOPICS.
3. DO NOT generate titles that just append prefixes or suffixes like "Introduction to...", "Basics of...", "Advanced...", "מבוא ל...", "יסודות...", "מתקדם...".
4. If "${nodeTitle}" is already atomic or specific, or if logically it cannot be broken down into distinct, brand-new sub-topics that don't overlap with existing topics, YOU MUST RETURN AN EMPTY ARRAY [] for "expandedSubNodes".
5. Do NOT inflate the tree artificially. It is much better to return [] than to create duplicate or redundant sub-nodes.

Language requested: ${language === 'he' ? 'Hebrew (עברית)' : 'English or prompt language'}.

If distinct, brand new sub-topics exist, generate 2 to 3 detailed SUB-BRANCH NODES.
Use Google Search Grounding to find real, verified learning sources.

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
      console.warn("JSON parse warning on expand node, using fallback subnodes:", parseErr?.message || parseErr);
      const fallbackSubNodes = buildFallbackSubNodes(treeTopic, nodeId, nodeTitle, nodeDescription, language, existingTitlesList);
      const isEndOfTopic = fallbackSubNodes.length === 0;
      return res.json({ success: true, parentNodeId: nodeId, subNodes: fallbackSubNodes, isFallback: true, isEndOfTopic });
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

    const isEndOfTopic = createdSubNodes.length === 0;
    return res.json({ success: true, parentNodeId: nodeId, subNodes: createdSubNodes, isEndOfTopic });
  } catch (err: any) {
    console.warn("Gemini API call failed for expand-node (429/quota), using fallback sub-nodes generator:", err?.message || err);
    const fallbackSubNodes = buildFallbackSubNodes(treeTopic, nodeId, nodeTitle, nodeDescription, language, existingTitlesList);
    const isEndOfTopic = fallbackSubNodes.length === 0;
    return res.json({ success: true, parentNodeId: nodeId, subNodes: fallbackSubNodes, isFallback: true, isEndOfTopic });
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
