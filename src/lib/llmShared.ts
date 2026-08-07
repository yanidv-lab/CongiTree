import { MAX_NODE_EXPANSION_DEPTH } from "./constants";
import { LearningTree } from "../types";

// Shared, provider-agnostic pieces of the client-side ("standalone app") Gemini/OpenAI/Anthropic
// callers: JSON extraction, resource-URL sanitization, dedup, fallback tree/subnode builders, and
// the prompt text itself. Each provider client (geminiClient.ts, openaiClient.ts,
// anthropicClient.ts) only owns the actual HTTP/SDK call and response-shape parsing - everything
// about *what* we ask for and how we validate/repair the result lives here once, so all three
// providers produce trees with the same structure and quality bar.

export type FallbackReason = "rate_limit" | "auth_error" | "api_error" | "parse_error";

export function classifyProviderError(err: any): FallbackReason {
  const status = err?.status ?? err?.statusCode;
  const message: string = err?.message || "";
  const isRateLimit = status === 429 || message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("rate_limit");
  if (isRateLimit) return "rate_limit";
  const isAuthError =
    status === 401 || status === 403 ||
    message.includes("API_KEY_INVALID") || message.includes("PERMISSION_DENIED") ||
    message.includes("authentication_error") || message.includes("permission_error") || message.includes("invalid_api_key");
  if (isAuthError) return "auth_error";
  return "api_error";
}

export function parseJsonFromModelText(text: string): any {
  if (!text || !text.trim()) {
    throw new Error("Empty text response received from AI model");
  }

  let cleaned = text.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Continue to cleanup
  }

  if (cleaned.includes("```")) {
    cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Continue to boundary extraction
  }

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

// Same fallback URL logic as server.ts's sanitizeResourceUrl: a Wikipedia *search* endpoint as
// the universal last resort (never 404s - auto-redirects on an exact title match) rather than
// guessing a direct article link.
export function sanitizeResourceUrl(rawUrl: string, title: string, topic: string, type: string): string {
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
  const hasHebrew = /[֐-׿]/.test(cleanTerm);
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

export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title.toLowerCase().trim().replace(/[^\w֐-׿]/g, ' ').replace(/\s+/g, ' ');
}

// Same core-word tokens & stop/filler word list as server.ts / treeStore.ts, kept in sync so
// dedup behaves identically whether a tree was built server-side or on-device.
export function getCoreTitleWords(title: string): string[] {
  const normalized = normalizeTitle(title);
  const stopAndFillerWords = new Set([
    'של', 'את', 'עם', 'על', 'ב', 'ל', 'מ', 'ה', 'זה', 'כי', 'גם',
    'מבוא', 'יסודות', 'עקרונות', 'למידת', 'מדריך', 'שיטות', 'מערך', 'נושא',
    'תת', 'שלב', 'חלק', 'בסיס', 'מתקדם', 'ליבה', 'בסיסי', 'כללי', 'סקירה',
    'הבנת', 'תרגול', 'יישום', 'פיתוח', 'שימוש', 'ניתוח', 'לימוד', 'כלים',
    'the', 'a', 'an', 'in', 'of', 'for', 'and', 'or', 'to', 'with', 'on', 'at', 'by',
    'introduction', 'intro', 'basics', 'basic', 'fundamentals', 'fundamental',
    'overview', 'guide', 'methods', 'advanced', 'core', 'part', 'section', 'topic',
    'subtopic', 'learning', 'study', 'understanding', 'practice', 'application', 'analysis'
  ]);
  return normalized.split(' ').filter((w) => w.length > 1 && !stopAndFillerWords.has(w));
}

export function areTitlesSimilar(titleA: string, titleB: string): boolean {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Deliberately no raw substring-containment check here: a short title fully contained in a
  // much longer one (e.g. the tree's own topic "Python" inside a legitimate child topic "Python
  // Data Structures") is normal parent/child naming, not a duplicate - the core-word comparison
  // below is a more accurate signal of genuine near-duplicates.
  const coreA = getCoreTitleWords(titleA);
  const coreB = getCoreTitleWords(titleB);

  if (coreA.length === 0 || coreB.length === 0) {
    const rawWordsA = normA.split(' ').filter((w) => w.length > 1);
    const rawWordsB = normB.split(' ').filter((w) => w.length > 1);
    if (rawWordsA.length > 0 && rawWordsB.length > 0) {
      const commonRaw = rawWordsA.filter((w) => rawWordsB.includes(w));
      return commonRaw.length === rawWordsA.length || commonRaw.length === rawWordsB.length;
    }
    return false;
  }

  const commonCore = coreA.filter((w) => coreB.includes(w));
  const minCoreLen = Math.min(coreA.length, coreB.length);

  if (minCoreLen >= 2 && commonCore.length === minCoreLen) return true;

  const overlapRatio = commonCore.length / Math.max(coreA.length, coreB.length);
  if (overlapRatio >= 0.75) return true;

  return false;
}

// Fallback learning tree builder, used only if the model is unreachable or returns unparsable JSON.
export function buildFallbackTree(topic: string, language: 'he' | 'en' = 'he'): LearningTree {
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
    node_foundation_1: {
      id: "node_foundation_1",
      title: isHe ? `יסודות ועקרונות בסיסיים ב-${cleanTopic}` : `Fundamentals and Basic Principles of ${cleanTopic}`,
      description: isHe ? `הקנאת התשתית התיאורטית ומושגי היסוד ההכרחיים.` : `Building theoretical groundwork and essential concepts.`,
      level: "foundation",
      isBaseNode: true,
      parentId: rootNodeId,
      childrenIds: [],
      completed: false,
      items: [
        { id: "node_foundation_1_item_0", text: isHe ? `לימוד מושגי יסוד והגדרות מפתח ב-${cleanTopic}` : `Study core concepts and key definitions in ${cleanTopic}`, completed: false },
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
        },
      ],
    },
    node_core_1: {
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
        },
      ],
    },
  };

  return {
    id: treeId,
    topic: cleanTopic,
    description: isHe ? `עץ למידה מובנה עבור ${cleanTopic}` : `Structured learning tree for ${cleanTopic}`,
    createdAt: now,
    updatedAt: now,
    rootNodeId,
    nodes: nodesRecord,
    category: "current",
  };
}

// Same depth-level -> node-count/coverage guidance as server.ts's /api/generate-tree, so a
// standalone build produces trees matching the scope the user picked, same as the server-backed
// deployment.
export function depthGuidanceFor(depthLevel: 'basic' | 'comprehensive' | 'mastery') {
  if (depthLevel === "basic") {
    return "Provide exactly 4 to 5 nodes forming a focused, essential prerequisite tree covering only the most critical must-know concepts. Prioritize breadth of the absolute fundamentals over depth.";
  }
  if (depthLevel === "mastery") {
    return "Provide 8 to 12 nodes forming an in-depth, comprehensive prerequisite tree that thoroughly covers foundation, core, advanced, AND specialization concepts. Explicitly identify and fill every important prerequisite knowledge gap a learner would need to close to reach true mastery-level understanding of the topic - do not stop at a shallow overview.";
  }
  return "Provide 6 to 8 nodes forming a well-rounded prerequisite tree covering foundation, core, and initial advanced concepts.";
}

export function buildGenerateTreePrompt(
  topic: string,
  language: string,
  depthLevel: 'basic' | 'comprehensive' | 'mastery',
  customInstructions: string
): string {
  const isHe = language === 'he';
  const depthGuidance = depthGuidanceFor(depthLevel);
  return `You are an expert academic curriculum designer and knowledge tree builder.
Build a comprehensive visual learning pathway tree for the topic: "${topic.trim()}".
Language requested: ${isHe ? 'Hebrew (עברית)' : 'English'}.

YOUR GOAL:
Create a complete visual learning tree starting from fundamental prerequisite roots up to advanced modules, giving
the learner a comprehensive picture of everything they still need to learn to bring their knowledge of
"${topic.trim()}" up to the requested depth level. Requested scope: ${depthGuidance}
Provide 4 to 6 real, verified study resources per node (university courses, YouTube lectures, textbooks, academic
papers, official documentation).

Return ONLY a valid JSON object matching this structure (no prose outside JSON):
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
      "items": ["Sub-topic objective 1", "Sub-topic objective 2"],
      "resources": [
        {
          "title": "Specific Course / Video / eBook / PDF title",
          "type": "youtube | course_free | course_paid | book | article | doc",
          "url": "https://...",
          "provider": "Coursera / edX / Udemy / MIT OCW / YouTube",
          "description": "Short explanation of why this source is helpful",
          "isVerifiedAcademic": true
        }
      ]
    }
  ]
}

Instructions:
- ${depthGuidance}
- IF YOU ARE NOT CONFIDENT A SPECIFIC URL IS CORRECT AND CURRENTLY VALID, LEAVE "url" AS AN EMPTY STRING ("") INSTEAD OF GUESSING - a working fallback link is supplied automatically whenever "url" is empty, and a confidently wrong link is worse than an empty one.
- STRICTLY FORBIDDEN: Do NOT return generic homepage or search URLs.
- CRITICAL RULE ON TOPICS: Avoid duplicate or highly overlapping nodes.
- Ensure every node has at least 3-5 checklist items.
- ${isHe ? 'Write titles, descriptions, and items in clear, natural HEBREW.' : 'Write titles, descriptions, and items clearly in ENGLISH.'}
${customInstructions ? `Additional user instructions: ${customInstructions}` : ''}`;
}

export function buildExpandNodePrompt(
  treeTopic: string,
  nodeTitle: string,
  nodeDescription: string,
  nodeDepth: number,
  ancestorChain: string[],
  existingTitlesList: string[],
  language: string
): string {
  const isHe = language === 'he';
  return `You are an expert academic curriculum designer.
We are building a structured learning pathway tree for the general subject: "${treeTopic}".
The user wants to EXPAND the following node:
Node Title: "${nodeTitle}"
Node Description: "${nodeDescription}"
Current Hierarchy Depth: Level ${nodeDepth} out of ${MAX_NODE_EXPANSION_DEPTH}.
Ancestor Hierarchy Chain: ${ancestorChain.length > 0 ? ancestorChain.map((a) => `"${a}"`).join(' -> ') : 'Root Topic'}

CRITICAL STRICT ANTI-REPETITION & ANTI-LOOP RULES:
1. Existing nodes ALREADY in this learning tree:
${existingTitlesList.map((t) => `- "${t}"`).join('\n')}
2. YOU ARE STRICTLY FORBIDDEN FROM GENERATING SUB-BRANCHES THAT ARE NEAR-DUPLICATES OF THE EXISTING TITLES LISTED ABOVE OR ANY ANCESTOR TOPICS - i.e. the same underlying concept, just reworded. Being about the same general parent subject is EXPECTED and FINE (that's what makes it a relevant sub-topic) - only reject a candidate if it would teach essentially the same thing as something already in the list.
3. If "${nodeTitle}" is already atomic or specific, or cannot be broken down into distinct, brand-new sub-topics, YOU MUST RETURN AN EMPTY ARRAY [] for "expandedSubNodes".

Language requested: ${isHe ? 'Hebrew (עברית)' : 'English'}.

If distinct, brand new sub-topics exist, generate 2 to 3 detailed SUB-BRANCH NODES with 2-4 verified resources each.

Return ONLY a valid JSON object matching this structure:
{
  "expandedSubNodes": [
    {
      "title": "Detailed Distinct Sub-Branch Title",
      "description": "Specific focus area explanation",
      "level": "core | advanced | specialization",
      "items": ["Subtopic item 1", "Subtopic item 2"],
      "resources": [
        { "title": "Resource title", "type": "youtube | course_free | book | article", "url": "https://...", "provider": "Provider", "isVerifiedAcademic": true }
      ]
    }
  ]
}

- IF YOU ARE NOT CONFIDENT A SPECIFIC URL IS CORRECT, LEAVE "url" EMPTY ("") INSTEAD OF GUESSING.
- All titles, descriptions, and checklist items must be in ${isHe ? 'Hebrew' : 'English'}.`;
}

// Turns the model's raw parsed JSON into our LearningTree shape, running every resource URL
// through sanitizeResourceUrl and wiring up childrenIds from parentId references.
export function assembleTreeFromParsedData(parsedTreeData: any, topic: string, language: string): LearningTree {
  const isHe = language === 'he';
  const now = new Date().toISOString();
  const treeId = `tree_${Date.now()}`;
  const nodesRecord: Record<string, any> = {};

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
              provider: res.provider || (isHe ? "מקור אקדמי" : "Academic Source"),
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

  return {
    id: treeId,
    topic: parsedTreeData.topic || topic,
    description: parsedTreeData.description || (isHe ? `עץ למידה מקיף עבור ${topic}` : `Comprehensive learning tree for ${topic}`),
    createdAt: now,
    updatedAt: now,
    rootNodeId,
    nodes: nodesRecord,
    category: "current",
  };
}

// Turns the model's raw expandedSubNodes JSON into tree sub-nodes, filtering out anything too
// similar to an existing title (in the tree or already accepted earlier in this same batch).
export function assembleSubNodesFromParsedData(
  data: any,
  nodeId: string,
  existingTitlesList: string[],
  treeTopic: string,
  nodeTitle: string,
  language: string
): { subNodes: any[]; isEndOfTopic: boolean; message?: string } {
  const isHe = language === 'he';

  if (!data.expandedSubNodes || !Array.isArray(data.expandedSubNodes) || data.expandedSubNodes.length === 0) {
    return {
      subNodes: [],
      isEndOfTopic: true,
      message: isHe ? "נושא זה כוסה במלואו" : "Topic fully covered",
    };
  }

  const timestamp = Date.now();
  const seenInBatch = new Set<string>();
  const subNodes: any[] = [];

  data.expandedSubNodes.forEach((raw: any, idx: number) => {
    const subTitle = (raw.title || '').trim();
    if (!subTitle) return;

    const isDuplicate =
      existingTitlesList.some((ex) => areTitlesSimilar(subTitle, ex)) ||
      Array.from(seenInBatch).some((prev) => areTitlesSimilar(subTitle, prev));
    if (isDuplicate) return;
    seenInBatch.add(subTitle);

    const subId = `${nodeId}_sub_${timestamp}_${idx}`;
    subNodes.push({
      id: subId,
      title: subTitle,
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
            provider: res.provider || (isHe ? "מקור אקדמי" : "Academic Source"),
            description: res.description || "",
            isVerifiedAcademic: res.isVerifiedAcademic ?? true,
            completed: false,
          }))
        : [],
    });
  });

  return { subNodes, isEndOfTopic: subNodes.length === 0 };
}
