import React, { useState } from 'react';
import {
  Search,
  ExternalLink,
  Youtube,
  GraduationCap,
  BookOpen,
  Award,
  CheckCircle2,
  FileText,
  BadgeCheck
} from 'lucide-react';
import { LearningTree, Resource, ResourceType, TreeNode } from '../types';

interface ResourceVaultViewProps {
  tree: LearningTree;
  onToggleResource: (nodeId: string, resourceId: string) => void;
  language?: 'he' | 'en';
}

const RESOURCE_TYPE_META: Record<ResourceType, { icon: React.ElementType; labelHe: string; labelEn: string }> = {
  course_free: { icon: GraduationCap, labelHe: 'edX / Coursera', labelEn: 'edX / Coursera' },
  course_paid: { icon: Award, labelHe: 'Udemy', labelEn: 'Udemy' },
  youtube: { icon: Youtube, labelHe: 'YouTube', labelEn: 'YouTube' },
  book: { icon: BookOpen, labelHe: 'ספר / eBook', labelEn: 'Book / eBook' },
  article: { icon: FileText, labelHe: 'מאמר אקדמי', labelEn: 'Academic PDF' },
  doc: { icon: FileText, labelHe: 'תיעוד רשמי', labelEn: 'Official Doc' },
};

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

  return (
    <div className="flex-1 overflow-auto bg-paper font-body">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-9 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-1">
        <div>
          <h2 className="font-heading text-[28px] text-ink leading-tight mb-1">
            {isHe ? 'מאגר מקורות' : 'Resource vault'}
          </h2>
          <p className="text-ink/60 text-sm">
            {isHe ? `כל מקור שנאסף לאורך ${tree.topic}, במקום אחד.` : `Every source collected across ${tree.topic}, in one shelf.`}
          </p>
        </div>
        <span className="text-xs font-bold text-accent-800 bg-accent-100 px-3 py-1.5 rounded-full shrink-0">
          {completedCount} / {allResourcesWithNode.length} {isHe ? 'הושלמו' : 'completed'}
        </span>
      </div>

      {/* Search */}
      <div className="relative w-full my-5">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={isHe ? "חפש קורס, מרצה, ספר, edX, Udemy..." : "Search course, author, book, edX, Udemy..."}
          className="w-full bg-panel/40 border border-ink/10 rounded-full px-4 py-2.5 pr-10 text-sm text-ink placeholder-ink/40 focus:outline-none focus:border-accent"
        />
        <Search className="w-4 h-4 text-ink/35 absolute right-3.5 top-3" strokeWidth={2.5} />
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 flex-wrap mb-5">
        {[
          { id: 'all', label: isHe ? 'הכל' : 'All' },
          { id: 'youtube', label: isHe ? 'וידאו' : 'Video' },
          { id: 'book', label: isHe ? 'ספרים' : 'Book' },
          { id: 'course_free', label: isHe ? 'קורסים' : 'Course' },
          { id: 'paper_doc', label: isHe ? 'מאמרים' : 'Article' },
          { id: 'course_paid', label: isHe ? 'Udemy' : 'Udemy' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-heading transition-colors ${
              filterType === tab.id ? 'bg-accent text-paper' : 'text-ink/70 border border-ink/15 hover:bg-panel'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Resource Rows */}
      <div className="flex flex-col gap-2.5">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-ink/50 bg-panel/40 rounded-card border border-ink/10">
            {isHe ? 'לא נמצאו מקורות תואמים לחיפוש' : 'No matching resources found'}
          </div>
        ) : (
          filtered.map(({ resource, nodeId, nodeTitle }) => {
            const meta = RESOURCE_TYPE_META[resource.type];
            const TypeIcon = meta.icon;
            return (
              <div
                key={resource.id}
                className={`p-3.5 rounded-panel border transition-all flex items-center gap-3.5 ${
                  resource.completed ? 'bg-sage-100/50 border-sage-300' : 'bg-panel/40 border-ink/10 hover:border-accent-300'
                }`}
              >
                <div className="w-[34px] h-[34px] rounded-[9px] bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
                  <TypeIcon className="w-4 h-4" strokeWidth={2.75} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-sm font-bold leading-snug ${resource.completed ? 'line-through opacity-55 text-ink' : 'text-ink'}`}>
                      {resource.title}
                    </h3>
                    {resource.isVerifiedAcademic && (
                      <span className="text-[9px] font-bold text-sand-800 bg-sand-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                        <BadgeCheck className="w-2.5 h-2.5" strokeWidth={2.75} />
                        {isHe ? 'מאומת' : 'Verified'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink/50 truncate">
                    {resource.provider ? `${resource.provider} · ` : ''}
                    {isHe ? `מתוך ${nodeTitle}` : `from ${nodeTitle}`}
                  </div>
                </div>

                <span className="hidden sm:inline-block text-[10px] font-bold px-2.5 py-1 rounded-full bg-panel text-ink/60 shrink-0">
                  {isHe ? meta.labelHe : meta.labelEn}
                </span>

                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="p-2 rounded-full bg-panel hover:bg-accent hover:text-paper text-ink/60 transition-colors shrink-0"
                    title={isHe ? 'פתח מקור' : 'Open source'}
                  >
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.75} />
                  </a>
                )}

                <button
                  onClick={() => onToggleResource(nodeId, resource.id)}
                  className="shrink-0"
                  title={isHe ? "סמן כהושלם" : "Mark as completed"}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center border-[1.5px] transition-colors ${
                    resource.completed ? 'bg-sage-500 border-sage-500' : 'border-ink/25'
                  }`}>
                    {resource.completed && <CheckCircle2 className="w-3.5 h-3.5 text-paper" strokeWidth={3} />}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
};
