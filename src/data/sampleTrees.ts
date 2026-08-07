import { LearningTree } from '../types';

export const SAMPLE_TREES: LearningTree[] = [
  {
    id: 'tree_ai_ml_sample',
    topic: 'אינטליגנציה מלאכותית ולמידת מכונה (AI & Machine Learning)',
    description: 'מפת למידה מקיפה מבוססת מקורות מחקריים לעולם ה-AI, החל ממתמטיקה בסיסית ועד למודלי שפה עמוקים',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rootNodeId: 'root_ai',
    category: 'current',
    searchSourcesUsed: [
      { title: 'MIT OpenCourseWare - Introduction to Machine Learning', uri: 'https://ocw.mit.edu' },
      { title: '3Blue1Brown - Neural Networks & Linear Algebra', uri: 'https://youtube.com/3blue1brown' },
      { title: 'DeepLearning.AI - Andrew Ng Courses', uri: 'https://deeplearning.ai' }
    ],
    nodes: {
      'root_ai': {
        id: 'root_ai',
        title: 'יסודות בינה מלאכותית ולמידת מכונה',
        description: 'נקודת השורש - הבנת העקרונות המובילים והחשיבה האלגוריתמית של AI',
        level: 'foundation',
        isBaseNode: true,
        parentId: null,
        childrenIds: ['node_math', 'node_programming'],
        completed: false,
        items: [
          { id: 'item_root_1', text: 'הגדרת בינה מלאכותית, למידה מפוקחת ולא מפוקחת', completed: true },
          { id: 'item_root_2', text: 'הבנת ההבדל בין AI, Machine Learning ו-Deep Learning', completed: true },
          { id: 'item_root_3', text: 'היכרות עם מחזור החיים של פרויקט AI', completed: true }
        ],
        resources: [
          {
            id: 'res_root_1',
            title: 'AI for Everyone - Coursera (Andrew Ng)',
            type: 'course_free',
            provider: 'DeepLearning.AI / Coursera',
            url: 'https://www.coursera.org/learn/ai-for-everyone',
            description: 'קורס מומלץ למתחילים להבנת עולם ה-AI והיישומים המעשיים שלו',
            isVerifiedAcademic: true,
            completed: true
          },
          {
            id: 'res_root_2',
            title: 'ערוץ YouTube: CrashCourse Computer Science',
            type: 'youtube',
            provider: 'CrashCourse',
            url: 'https://www.youtube.com/@crashcourse',
            description: 'סדרת סרטונים מומלצת המציגה את הבסיס המחשבי לבינה מלאכותית',
            isVerifiedAcademic: true,
            completed: true
          }
        ]
      },
      'node_math': {
        id: 'node_math',
        title: 'מתמטיקה וסטטיסטיקה ל-AI',
        description: 'דרישת קדם הכרחית: אלגברה לינארית, חשבון אינפיניטסימלי והסתברות',
        level: 'foundation',
        isBaseNode: true,
        parentId: 'root_ai',
        childrenIds: ['node_ml_basics'],
        completed: false,
        items: [
          { id: 'item_math_1', text: 'ווקטורים, מטריצות ומכפלה סקלרית', completed: false },
          { id: 'item_math_2', text: 'נגזרות חלקיות וגרדיאנט (Gradient Descent)', completed: false },
          { id: 'item_math_3', text: 'הסתברות מותנית, מודלים סטטיסטיים וחוק בייס', completed: false }
        ],
        resources: [
          {
            id: 'res_math_1',
            title: 'Essence of Linear Algebra - 3Blue1Brown',
            type: 'youtube',
            provider: '3Blue1Brown',
            url: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab',
            description: 'סדרת סרטונים ויזואלית מרהיבה להבנת אינטואיטיבית של אלגברה לינארית',
            isVerifiedAcademic: true,
            completed: false
          },
          {
            id: 'res_math_2',
            title: 'Mathematics for Machine Learning - Imperial College London',
            type: 'course_free',
            provider: 'Imperial College / Coursera',
            url: 'https://www.coursera.org/specializations/mathematics-machine-learning',
            description: 'סדרת קורסים אקדמיים המכסה את הבסיס המתמטי המדויק ללמידת מכונה',
            isVerifiedAcademic: true,
            completed: false
          },
          {
            id: 'res_math_3',
            title: 'ספר: Mathematics for Machine Learning (Marc Peter Deisenroth)',
            type: 'book',
            provider: 'Cambridge University Press',
            url: 'https://mml-book.github.io/',
            description: 'ספר לימוד אקדמי חינמי בפורמט PDF מאת אוניברסיטת קמברידג\'',
            isVerifiedAcademic: true,
            completed: false
          }
        ]
      },
      'node_programming': {
        id: 'node_programming',
        title: 'תכנות Python ומדע הנתונים',
        description: 'כלים מעשיים: Python, NumPy, Pandas וניתוח ויזואלי',
        level: 'foundation',
        isBaseNode: true,
        parentId: 'root_ai',
        childrenIds: ['node_ml_basics'],
        completed: false,
        items: [
          { id: 'item_py_1', text: 'שליטה בפייתון מתקדם (List Comprehensions, OOP)', completed: false },
          { id: 'item_py_2', text: 'עיבוד מטריצות ונתונים עם NumPy ו-Pandas', completed: false },
          { id: 'item_py_3', text: 'ויזואליזציית נתונים עם Matplotlib ו-Seaborn', completed: false }
        ],
        resources: [
          {
            id: 'res_py_1',
            title: 'Python for Data Science and Machine Learning Bootcamp',
            type: 'course_paid',
            provider: 'Udemy (Jose Portilla)',
            url: 'https://www.udemy.com/course/python-for-data-science-and-machine-learning-bootcamp/',
            description: 'קורס מקיף ומעשי להשתלטות על פייתון ומדע הנתונים',
            isVerifiedAcademic: false,
            completed: false
          },
          {
            id: 'res_py_2',
            title: 'ערוץ YouTube: FreeCodeCamp - Python for Data Science',
            type: 'youtube',
            provider: 'FreeCodeCamp',
            url: 'https://www.youtube.com/@freecodecamp',
            description: 'מדריכים חינמיים באורך מלא לפיתוח ועיבוד נתונים בפייתון',
            isVerifiedAcademic: true,
            completed: false
          }
        ]
      },
      'node_ml_basics': {
        id: 'node_ml_basics',
        title: 'אלגוריתמי למידת מכונה קלאסיים',
        description: 'רגרסיה, סיווג, עצי החלטה ורשתות נוירונים בסיסיות',
        level: 'core',
        isBaseNode: false,
        parentId: 'node_math',
        childrenIds: ['node_deep_learning'],
        completed: false,
        items: [
          { id: 'item_ml_1', text: 'רגרסיה לינארית ולוגיסטית (Linear & Logistic Regression)', completed: false },
          { id: 'item_ml_2', text: 'עצי החלטה ו-Random Forest', completed: false },
          { id: 'item_ml_3', text: 'אלגוריתם K-Means וסיווג SVM', completed: false },
          { id: 'item_ml_4', text: 'הערכת מודלים: Precision, Recall, ROC-AUC', completed: false }
        ],
        resources: [
          {
            id: 'res_ml_1',
            title: 'Machine Learning Specialization - Stanford & DeepLearning.AI',
            type: 'course_free',
            provider: 'Stanford University',
            url: 'https://www.coursera.org/specializations/machine-learning-introduction',
            description: 'הקורס הקלאסי והמוערך ביותר בעולם של אנדרו נג מאוניברסיטת סטנפורד',
            isVerifiedAcademic: true,
            completed: false
          },
          {
            id: 'res_ml_2',
            title: 'ספר: Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow',
            type: 'book',
            provider: "O'Reilly Media (Aurélien Géron)",
            url: 'https://www.oreilly.com/library/view/hands-on-machine-learning/9781098125967/',
            description: 'תנ"ך הלמידה המעשית - ספר המכסה קוד ופרקטיקה מאפס למודלים מתקדמים',
            isVerifiedAcademic: true,
            completed: false
          }
        ]
      },
      'node_deep_learning': {
        id: 'node_deep_learning',
        title: 'למידה עמוקה (Deep Learning & PyTorch)',
        description: 'רשתות נוירונים עמוקות, Backpropagation וארכיטקטורות CNN/RNN',
        level: 'advanced',
        isBaseNode: false,
        parentId: 'node_ml_basics',
        childrenIds: ['node_transformers'],
        completed: false,
        items: [
          { id: 'item_dl_1', text: 'ארכיטקטורת Perceptron ורשתות הזנה קדימה (FFNN)', completed: false },
          { id: 'item_dl_2', text: 'פונקציות אקטיבציה (ReLU, Sigmoid, Softmax)', completed: false },
          { id: 'item_dl_3', text: 'בנייה ואימון מודלים ב-PyTorch או TensorFlow', completed: false }
        ],
        resources: [
          {
            id: 'res_dl_1',
            title: 'Deep Learning Specialization - Coursera',
            type: 'course_free',
            provider: 'DeepLearning.AI',
            url: 'https://www.coursera.org/specializations/deep-learning',
            description: 'סדרת 5 קורסים אקדמיים מקיפים על למידה עמוקה ופיתוח מודלים',
            isVerifiedAcademic: true,
            completed: false
          },
          {
            id: 'res_dl_2',
            title: 'MIT 6.S191: Introduction to Deep Learning',
            type: 'course_free',
            provider: 'MIT OpenCourseWare',
            url: 'http://introtodeeplearning.com/',
            description: 'הקורס הרשמי של MIT הכולל הרצאות וידאו, מחברות Colab ושקפים',
            isVerifiedAcademic: true,
            completed: false
          }
        ]
      },
      'node_transformers': {
        id: 'node_transformers',
        title: 'טרנספורמרים ומודלי שפה גדולים (LLMs)',
        description: 'מנגנון Attention, GPT, BERT ופיתוח אפליקציות AI מתקדמות',
        level: 'specialization',
        isBaseNode: false,
        parentId: 'node_deep_learning',
        childrenIds: [],
        completed: false,
        items: [
          { id: 'item_tr_1', text: 'מנגנוני Self-Attention ו-Multi-Head Attention', completed: false },
          { id: 'item_tr_2', text: 'ארכיטקטורת Transformer (Encoder / Decoder)', completed: false },
          { id: 'item_tr_3', text: 'אימון מחדש (Fine-Tuning), RAG והנדסת פרומפטים', completed: false }
        ],
        resources: [
          {
            id: 'res_tr_1',
            title: 'Neural Networks: Zero to Hero (Andrej Karpathy)',
            type: 'youtube',
            provider: 'Andrej Karpathy (Ex-OpenAI / Tesla)',
            url: 'https://www.youtube.com/playlist?list=PLAqh13U4cq4NW947012w6gAljwXcjh536',
            description: 'סדרת מופת של אנדריי קרפתי המסבירה ובונה GPT מאפס בקוד',
            isVerifiedAcademic: true,
            completed: false
          },
          {
            id: 'res_tr_2',
            title: 'Hugging Face NLP Course',
            type: 'course_free',
            provider: 'Hugging Face',
            url: 'https://huggingface.co/learn/nlp-course',
            description: 'מדריך מעשי וחינמי לעבודה עם מודלים שפתיים וטרנספורמרים',
            isVerifiedAcademic: true,
            completed: false
          }
        ]
      }
    }
  }
];
