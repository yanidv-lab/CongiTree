import { GoogleGenAI } from "@google/genai";
import { getStoredApiKey } from "./apiKeyStore";
import { MAX_NODE_EXPANSION_DEPTH } from "./constants";
import { GenerateTreeRequest, ExpandNodeRequest, LearningTree } from "../types";

// Helper to extract JSON from Gemini text response
function parseJsonFromGemini(text: string): any {
  if (!text || !text.trim()) {
    throw new Error("Empty text response received from AI model");
  }

  let cleaned = text.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {}

  if (cleaned.includes("```")) {
    cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {}

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

// Helper to clean and validate resource URLs
function sanitizeResourceUrl(rawUrl: string, title: string, topic: string, type: string): string {
  let url = (rawUrl || "").trim();

  const isGoogleSearchUrl = !url || 
    url.includes("google.com/search") || 
    url.includes("google.co/") || 
    url === "https://www.google.com" ||
    url === "https://google.com";

  if (!isGoogleSearchUrl && (url.startsWith("http://") || url.startsWith("https://"))) {
    return url;
  }

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

  if (hasHebrew) {
    return `https://he.wikipedia.org/w/index.php?search=${encodedQuery}&title=Special:Search&fulltext=1`;
  }
  return `https://en.wikipedia.org/w/index.php?search=${encodedQuery}&title=Special:Search&fulltext=1`;
}

// Fallback learning tree builder
function buildFallbackTree(topic: string, language: 'he' | 'en' = 'he'): LearningTree {
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
      ],
    },
    "node_foundation_1": {
      id: "node_foundation_1",
      title: isHe ? `יסודות ועקרונות בסיסיים ב-${cleanTopic}` : `Fundamentals and Basic Principles of ${cleanTopic}`,
      description: isHe ? `הקנאת התשתית התיאורטית ומושגי היסוד ההכרחיים.` : `Building theoretical groundwork and essential concepts.`,
      level: "foundation",
      isBaseNode: true,
      parentId: rootNodeId,
      childrenIds: ["node_core_2"],
      completed: false,
      items: [
        { id: "node_foundation_1_item_0", text: isHe ? `לימוד מושגי יסוד והגדרות מפתח ב-${cleanTopic}` : `Study core concepts and key definitions in ${cleanTopic}`, completed: false },
        { id: "node_foundation_1_item_1", text: isHe ? `סיווג תתי-התחומים והקשרים ביניהם` : `Categorize subfields and their relations`, completed: false },
      ],
      resources: [
        {
          id: "node_foundation_1_res_0",
          title: isHe ? `קורס Coursera: יסודות ${cleanTopic}` : `Coursera Course: ${cleanTopic} Foundations`,
          type: "course_free",
          url: "https://www.coursera.org/",
          provider: "Coursera / Stanford & Yale Online",
          description: isHe ? "מסלול לימוד מובנה" : "Structured learning track",
          isVerifiedAcademic: true,
          completed: false,
        }
      ],
    },
    "node_core_1": {
      id: "node_core_1",
      title: isHe ? `ליבת התחום ומתודולוגיות מרכזיות` : `Core Domain and Key Methodologies`,
      description: isHe ? `העמקה בטכניקות העבודה והעקרונות המרכזיים ב-${cleanTopic}.` : `Deep dive into working techniques in ${cleanTopic}.`,
      level: "core",
      isBaseNode: false,
      parentId: rootNodeId,
      childrenIds: [],
      completed: false,
      items: [
        { id: "node_core_1_item_0", text: isHe ? `ניתוח מתודולוגיות מפתח ב-${cleanTopic}` : `Analyze key methodologies in ${cleanTopic}`, completed: false },
      ],
      resources: [
        {
          id: "node_core_1_res_0",
          title: isHe ? `ספר אקדמי: ${cleanTopic}` : `Textbook: ${cleanTopic}`,
          type: "book",
          url: sanitizeResourceUrl("", cleanTopic, cleanTopic, "book"),
          provider: "Cambridge / OpenStax",
          description: isHe ? "ספר עיון מוביל" : "Leading reference book",
          isVerifiedAcademic: true,
          completed: false,
        }
      ],
    },
  };

  return {
    id: treeId,
    topic: cleanTopic,
    description: `עץ למידה מובנה עבור ${cleanTopic}`,
    createdAt: now,
    updatedAt: now,
    rootNodeId,
    nodes: nodesRecord,
    category: "current",
  };
}

/**
 * Generate Learning Tree directly from the Client (Android Standalone App Mode).
 * Uses stored API key securely directly to Google Gemini API.
 */
export async function generateLearningTreeClient(
  request: GenerateTreeRequest
): Promise<{ success: boolean; tree: LearningTree; isFallback?: boolean; error?: string }> {
  const apiKey = await getStoredApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  const { topic, language = "he", depthLevel = "comprehensive", customInstructions = "" } = request;
  const depthGuidance = depthLevel === "basic"
    ? "Provide exactly 4 to 5 nodes forming a focused prerequisite tree."
    : depthLevel === "mastery"
    ? "Provide 8 to 12 nodes forming an in-depth prerequisite tree."
    : "Provide 6 to 8 nodes forming a well-rounded prerequisite tree.";

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert academic curriculum designer and knowledge tree builder.
Build a comprehensive visual learning pathway tree for the topic: "${topic.trim()}".
Language requested: ${language === 'he' ? 'Hebrew (עברית)' : 'English'}.

YOUR GOAL:
Create a complete visual learning tree starting from fundamental prerequisite roots up to advanced modules for "${topic.trim()}". Scope: ${depthGuidance}
Provide 4 to 6 study resources per node (Coursera, edX, MIT OCW, YouTube playlists, textbooks, Wikipedia).

Structure requirements:
Return ONLY a valid JSON object matching:
{
  "topic": "${topic.trim()}",
  "description": "Summary",
  "nodes": [
    {
      "id": "node_root",
      "title": "Root Title",
      "description": "Overview",
      "level": "foundation",
      "isBaseNode": true,
      "parentId": null,
      "items": ["Item 1", "Item 2"],
      "resources": [
        {
          "title": "Resource title",
          "type": "youtube | course_free | course_paid | book | article | doc",
          "url": "https://...",
          "provider": "Provider name",
          "description": "Short explanation",
          "isVerifiedAcademic": true
        }
      ]
    }
  ]
}

Instructions:
- Avoid duplicate nodes.
- Write in ${language === 'he' ? 'Hebrew' : 'English'}.
${customInstructions ? `Additional user instructions: ${customInstructions}` : ''}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { temperature: 0.2 },
    });

    const text = response.text || "";
    let parsedTreeData: any;
    try {
      parsedTreeData = parseJsonFromGemini(text);
    } catch (parseErr) {
      return { success: true, tree: buildFallbackTree(topic, language as any), isFallback: true };
    }

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
            ? rawNode.items.map((itemText: any, iIdx: number) => ({
                id: `${nodeId}_item_${iIdx}`,
                text: typeof itemText === "string" ? itemText : itemText?.text || (isHe ? "נושא ללמידה" : "Topic to learn"),
                completed: false,
              }))
            : [],
          resources: Array.isArray(rawNode.resources)
            ? rawNode.resources.map((res: any, rIdx: number) => ({
                id: `${nodeId}_res_${rIdx}`,
                title: res.title || (isHe ? "מקור לימוד" : "Learning Resource"),
                type: res.type || "article",
                url: sanitizeResourceUrl(res.url, res.title || topic, topic, res.type || "article"),
                provider: res.provider || "Academic Source",
                description: res.description || "",
                isVerifiedAcademic: res.isVerifiedAcademic ?? true,
                completed: false,
              }))
            : [],
        };
      });

      Object.values(nodesRecord).forEach((node: any) => {
        if (node.parentId && nodesRecord[node.parentId]) {
          if (!nodesRecord[node.parentId].childrenIds.includes(node.id)) {
            nodesRecord[node.parentId].childrenIds.push(node.id);
          }
        }
      });
    }

    const learningTree: LearningTree = {
      id: treeId,
      topic: parsedTreeData.topic || topic,
      description: parsedTreeData.description || (isHe ? `עץ למידה עבור ${topic}` : `Learning tree for ${topic}`),
      createdAt: now,
      updatedAt: now,
      rootNodeId,
      nodes: nodesRecord,
      category: "current",
    };

    return { success: true, tree: learningTree };
  } catch (err: any) {
    if (err?.message === "GEMINI_API_KEY_MISSING") {
      throw err;
    }
    return { success: true, tree: buildFallbackTree(topic, language as any), isFallback: true };
  }
}

/**
 * Expand Tree Node directly from Client.
 */
export async function expandTreeNodeClient(
  request: ExpandNodeRequest
): Promise<{ success: boolean; isEndOfTopic?: boolean; subNodes?: any[]; message?: string }> {
  const apiKey = await getStoredApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  const { treeTopic, nodeId, nodeTitle, nodeDescription, language = "he" } = request;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert curriculum designer.
Generate 2 to 3 sub-topic nodes expanding upon: "${nodeTitle}" (Parent Topic: "${treeTopic}").
Language: ${language === 'he' ? 'Hebrew (עברית)' : 'English'}.

Return ONLY JSON:
{
  "isEndOfTopic": false,
  "subNodes": [
    {
      "title": "Subnode title",
      "description": "Subnode description",
      "level": "core | advanced",
      "items": ["Item 1", "Item 2"],
      "resources": [
        {
          "title": "Resource title",
          "type": "youtube | course_free | book | article",
          "url": "https://...",
          "provider": "Provider"
        }
      ]
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { temperature: 0.2 },
    });

    const text = response.text || "";
    const data = parseJsonFromGemini(text);

    const timestamp = Date.now();
    const isHe = language === 'he';

    if (data.isEndOfTopic || !Array.isArray(data.subNodes) || data.subNodes.length === 0) {
      return {
        success: true,
        isEndOfTopic: true,
        subNodes: [],
        message: isHe ? "נושא זה כוסה במלואו" : "Topic fully covered"
      };
    }

    const subNodes = data.subNodes.map((raw: any, idx: number) => {
      const subId = `${nodeId}_sub_${timestamp}_${idx}`;
      return {
        id: subId,
        title: raw.title || `${nodeTitle} - ${idx + 1}`,
        description: raw.description || "",
        level: raw.level || "core",
        isBaseNode: false,
        parentId: nodeId,
        childrenIds: [],
        completed: false,
        items: Array.isArray(raw.items)
          ? raw.items.map((it: any, iIdx: number) => ({
              id: `${subId}_item_${iIdx}`,
              text: typeof it === "string" ? it : it?.text || (isHe ? "משימה" : "Task"),
              completed: false,
            }))
          : [],
        resources: Array.isArray(raw.resources)
          ? raw.resources.map((res: any, rIdx: number) => ({
              id: `${subId}_res_${rIdx}`,
              title: res.title || (isHe ? "מקור" : "Resource"),
              type: res.type || "article",
              url: sanitizeResourceUrl(res.url, res.title || nodeTitle, treeTopic, res.type || "article"),
              provider: res.provider || "Academic Source",
              description: res.description || "",
              isVerifiedAcademic: true,
              completed: false,
            }))
          : [],
      };
    });

    return { success: true, isEndOfTopic: false, subNodes };
  } catch (err: any) {
    if (err?.message === "GEMINI_API_KEY_MISSING") {
      throw err;
    }
    return {
      success: true,
      isEndOfTopic: false,
      subNodes: []
    };
  }
}
