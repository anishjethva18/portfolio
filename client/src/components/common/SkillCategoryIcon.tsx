import React from 'react';
import {
  BrainCircuit,
  ChartNoAxesCombined,
  Cloud,
  Code2,
  Database,
  GraduationCap,
  HardDrive,
  LayoutGrid,
  MessagesSquare,
  Monitor,
  Server,
  ShieldCheck,
  Smartphone,
  Sliders,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getCategoryIconIdentifier } from '../../utils/skillIcons';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  BrainCircuit,
  ChartNoAxesCombined,
  Cloud,
  Code2,
  Database,
  GraduationCap,
  HardDrive,
  LayoutGrid,
  MessagesSquare,
  Monitor,
  Server,
  ShieldCheck,
  Smartphone,
  Sliders,
  Sparkles,
  Wrench,
};

export const SkillCategoryIcon: React.FC<{ name?: string; category?: string; className?: string }> = ({
  name,
  category = '',
  className = 'h-5 w-5',
}) => {
  const iconName = name || getCategoryIconIdentifier(category);
  const Icon = CATEGORY_ICONS[iconName] || LayoutGrid;
  return <Icon className={className} aria-hidden="true" />;
};
