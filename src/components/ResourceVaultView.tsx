import React, { useState } from 'react';
import { 
  Search, 
  ExternalLink, 
  Youtube, 
  GraduationCap, 
  BookOpen, 
  Award, 
  CheckSquare, 
  Square,
  Library,
  FileText,
  BadgeCheck
} from 'lucide-react';
import { LearningTree, Resource, TreeNode } from '../types';

interface ResourceVaultViewProps {
  tree: LearningTree;
  onToggleResource: (nodeId: string, resourceId: string) => void;
  language?: 'he' | 'en';
}

export const ResourceVaultView: React.FC<ResourceVaultViewProps> = ({
  tree,
  onToggleResource,
  language = 'he',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const isHe = language === 'he';

  // Collect all resources with their node title
  const allResourcesWithNode: { resource: Resource; nodeId: string; nodeTitle: string }[] = [];

  (Object.values(tree.nodes) as TreeNode[]).forEach((node) => {
    node.resources.forEach((res) => {
      allResourcesWithNode.push({
        resource: res,
        nodeId: node.id,
        nodeTitle: node.title,
      });
    });
  });

  const filtered = allResourcesWithNode.filter(({ resource, nodeTitle }) => {
    const matchesSearch =
      resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (resource.description && resource.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (resource.provider && resource.provider.toLowerCase().includes(searchTerm.toLowerCase())) ||
      nodeTitle.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'course_free') return resource.type === 'course_free';
    if (filterType === 'course_paid') return resource.type === 'course_paid';
    if (filterType === 'youtube') return resource.type === 'youtube';
    if (filterType === 'book') return resource.type === 'book';
    if (filterType === 'paper_doc') return resource.type === 'article' || resource.type === 'doc';

    return true;
  });

  const completedCount = allResourcesWithNode.filter(r => r.resource.completed).length;

  const getResourceTypeBadge = (res: Resource) => {
    switch (res.type) {
      case 'course_free':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
            {isHe ? 'קורס אוניברסיטאי (edX/Coursera/MIT)' : 'University Course (edX/Coursera)'}
          </span>
        );
      case 'course_paid':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            {isHe ? 'קורס מעשי מקצועי (Udemy)' : 'Professional Course (Udemy)'}
          </span>
        );
      case 'youtube':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
            <Youtube className="w-3.5 h-3.5 text-red-600" />
            {isHe ? 'סרטון/הרצאת YouTube' : 'YouTube Video / Lecture'}
          </span>
        );
      case 'book':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            {isHe ? 'ספר לימוד/ספר אלקטרוני (eBook)' : 'Textbook & Electronic eBook'}
          </span>
        );
      case 'article':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
            <FileText className="w-3.5 h-3.5 text-purple-600" />
            {isHe ? 'מאמר מחקרי / PDF (Google Scholar)' : 'Research Paper / PDF'}
          </span>
        );
      case 'doc':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
            <FileText className="w-3.5 h-3.5 text-teal-600" />
            {isHe ? 'תיעוד רשמי ומפרט' : 'Official Documentation'}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 text-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isHe ? 'מאגר מקורות הלמידה המאומתים' : 'Verified Resource Vault'}
            </h2>
            <p className="text-xs text-slate-500">
              {isHe 
                ? 'קורסים מאוניברסיטאות, edX, Coursera, Udemy, הרצאות YouTube, ספרים, PDFs ומאמרים אקדמיים במקום אחד'
                : 'University courses, edX, Coursera, Udemy, YouTube lectures, eBooks, PDFs, and academic papers in one place'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-indigo-700">
          <span>{completedCount} / {allResourcesWithNode.length} {isHe ? 'מקורות הושלמו' : 'Resources Completed'}</span>
        </div>
      </div>

      {/* Controls: Search & Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isHe ? "חפש קורס, מרצה, ספר, edX, Udemy..." : "Search course, author, book, edX, Udemy..."}
            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 pr-9 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: isHe ? 'הכל' : 'All' },
            { id: 'course_free', label: isHe ? '🎓 edX / Coursera' : '🎓 edX / Coursera' },
            { id: 'course_paid', label: isHe ? '🏆 Udemy' : '🏆 Udemy' },
            { id: 'youtube', label: isHe ? '🎥 YouTube' : '🎥 YouTube' },
            { id: 'book', label: isHe ? '📚 ספרים ו-eBooks' : '📚 Books & eBooks' },
            { id: 'paper_doc', label: isHe ? '📄 PDFs ומאמרים' : '📄 PDFs & Papers' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                filterType === tab.id
                  ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resources Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            {isHe ? 'לא נמצאו מקורות תואמים לחיפוש' : 'No matching resources found'}
          </div>
        ) : (
          filtered.map(({ resource, nodeId, nodeTitle }) => (
            <div
              key={resource.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                resource.completed
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div>
                {/* Node Belonging Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] text-slate-600 font-semibold truncate bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {isHe ? `שייך לשלב: ${nodeTitle}` : `Stage: ${nodeTitle}`}
                  </span>

                  {resource.isVerifiedAcademic && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 shrink-0">
                      <BadgeCheck className="w-3 h-3 text-amber-600" />
                      {isHe ? 'מקור מאומת' : 'Verified Academic'}
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-3">
                  <button
                    onClick={() => onToggleResource(nodeId, resource.id)}
                    className="mt-1 text-emerald-600 shrink-0"
                    title={isHe ? "סמן כהושלם" : "Mark as completed"}
                  >
                    {resource.completed ? (
                      <CheckSquare className="w-5 h-5 fill-emerald-500 text-white" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  <div className="space-y-1">
                    <h3 className={`text-sm font-bold leading-snug ${resource.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                      {resource.title}
                    </h3>

                    {resource.provider && (
                      <div className="text-xs text-indigo-600 font-semibold">
                        {resource.provider}
                      </div>
                    )}

                    {resource.description && (
                      <p className="text-xs text-slate-600 leading-relaxed pt-0.5">
                        {resource.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Resource Type & External Link */}
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <div>
                  {getResourceTypeBadge(resource)}
                </div>

                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 border border-slate-200 text-xs font-semibold transition-all shadow-2xs shrink-0"
                  >
                    <span>{isHe ? 'פתח מקור' : 'Open Source'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

