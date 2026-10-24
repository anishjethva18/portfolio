import assert from 'node:assert/strict';
import {
  getCategoryIconIdentifier,
  getPublicSkillCategories,
  getSkillIconIdentifier,
  migrateLegacySkillCategories,
  normalizeSkillCategories,
  validateSkillCategories,
} from '../services/skillCatalog';

const migrated = migrateLegacySkillCategories([
  {
    id: 'old-frontend',
    title: 'Frontend Development',
    icon: 'LayoutGrid',
    skills: [
      { id: 'old-js', name: 'TypeScript / JavaScript', level: 95, description: 'legacy' },
      { id: 'old-react', name: 'React 18 / 19', level: 94 },
      { id: 'old-tailwind', name: 'Tailwind CSS', level: 92 },
    ],
  },
  {
    id: 'old-backend',
    title: 'Backend & Cloud',
    icon: 'HardDrive',
    skills: [
      { id: 'old-node', name: 'Node.js & Express', level: 90 },
      { id: 'old-db', name: 'PostgreSQL / SQL', level: 86 },
      { id: 'old-docker', name: 'Docker & Containers', level: 80 },
    ],
  },
]);

assert.equal(validateSkillCategories(migrated), null);
const normalized = normalizeSkillCategories(migrated) as Array<Record<string, unknown>>;
const skills = normalized.flatMap((category) => category.skills as Array<Record<string, unknown>>);
const names = skills.map((skill) => skill.name);
assert.deepEqual(names, ['TypeScript', 'JavaScript', 'React', 'Tailwind CSS', 'Node.js', 'Express.js', 'PostgreSQL', 'SQL', 'Docker', 'Containers']);
assert.equal(skills.find((skill) => skill.name === 'React')?.id, 'old-react');
assert.equal(skills.find((skill) => skill.name === 'React')?.iconIdentifier, 'simple:react');
assert.equal(Object.hasOwn(skills[0], 'level'), false);
assert.equal(Object.hasOwn(skills[0], 'description'), false);
assert.equal(getSkillIconIdentifier('Node JS'), 'simple:nodedotjs');
assert.equal(getSkillIconIdentifier('TS'), 'simple:typescript');
assert.equal(getSkillIconIdentifier('CSS3'), 'simple:css');
assert.equal(getSkillIconIdentifier('Java'), 'custom:java');
assert.equal(getSkillIconIdentifier('Linux'), 'custom:linux');
assert.equal(getSkillIconIdentifier('AWS'), 'custom:aws');
assert.equal(getSkillIconIdentifier('Amazon Web Services'), 'custom:aws');
assert.equal(getSkillIconIdentifier('C'), 'simple:c');
assert.equal(getSkillIconIdentifier('C++'), 'simple:cplusplus');
assert.equal(getSkillIconIdentifier('Apache Kafka'), 'simple:apachekafka');
assert.equal(getSkillIconIdentifier('Figma'), 'simple:figma');
assert.equal(getSkillIconIdentifier('C#'), 'custom:csharp');
assert.equal(getSkillIconIdentifier('C# Programming'), 'custom:csharp');
assert.equal(getSkillIconIdentifier('Anaconda'), 'simple:anaconda');
assert.equal(getSkillIconIdentifier('C Programming'), 'simple:c');
assert.equal(validateSkillCategories(normalizeSkillCategories([{
  id: 'manual-icon-category',
  title: 'Tools',
  skills: [{ id: 'manual-icon-skill', name: 'Custom Tool', iconIdentifier: 'image:/api/portfolio-media/icon.svg' }],
}])), null);
const unsafeManualIcon = normalizeSkillCategories([{
  id: 'unsafe-icon-category',
  title: 'Tools',
  skills: [{ id: 'unsafe-icon-skill', name: 'Custom Tool', iconIdentifier: 'image:javascript:alert(1)' }],
}]) as Array<Record<string, any>>;
unsafeManualIcon[0].skills[0].iconIdentifier = 'image:javascript:alert(1)';
assert.notEqual(validateSkillCategories(unsafeManualIcon), null);
assert.equal(getSkillIconIdentifier('VS Code'), 'custom:vscode');
assert.equal(getSkillIconIdentifier('Visual Studio Code'), 'custom:vscode');
assert.equal(getSkillIconIdentifier('TypeScript / JavaScript'), 'simple:typescript');
assert.equal(getSkillIconIdentifier('Node.js & Express'), 'simple:nodedotjs');
assert.equal(getSkillIconIdentifier('Problem Solving'), 'lucide:Lightbulb');
assert.equal(getSkillIconIdentifier('A made-up technology'), 'lucide:Code2');
assert.equal(getSkillIconIdentifier('OpenAI'), 'custom:openai');
assert.equal(getSkillIconIdentifier('ChatGPT'), 'custom:openai');
assert.equal(getSkillIconIdentifier('DeepSeek'), 'simple:deepseek');
assert.equal(getSkillIconIdentifier('GitHub Copilot'), 'simple:githubcopilot');
assert.equal(getSkillIconIdentifier('Mistral AI'), 'simple:mistralai');
const bundledBrandIcons = normalizeSkillCategories([{
  id: 'icon-validation',
  title: 'Icon validation',
  skills: [
    { id: 'java-icon', name: 'Java', iconIdentifier: 'simple:openjdk' },
    { id: 'chatgpt-icon', name: 'ChatGPT', iconIdentifier: 'lucide:BrainCircuit' },
    { id: 'linux-icon', name: 'Linux', iconIdentifier: 'simple:linux' },
    { id: 'c-icon', name: 'C', iconIdentifier: 'simple:c' },
    { id: 'aws-icon', name: 'AWS' },
  ],
}]) as Array<Record<string, unknown>>;
assert.equal(validateSkillCategories(bundledBrandIcons), null);
assert.equal((bundledBrandIcons[0].skills as Array<Record<string, unknown>>)[0].iconIdentifier, 'custom:java');
assert.equal((bundledBrandIcons[0].skills as Array<Record<string, unknown>>)[1].iconIdentifier, 'custom:openai');
assert.equal((bundledBrandIcons[0].skills as Array<Record<string, unknown>>)[2].iconIdentifier, 'custom:linux');
assert.equal((bundledBrandIcons[0].skills as Array<Record<string, unknown>>)[3].iconIdentifier, 'simple:c');
assert.equal((bundledBrandIcons[0].skills as Array<Record<string, unknown>>)[4].iconIdentifier, 'custom:aws');
const refreshedLegacyIcons = normalizeSkillCategories([{
  id: 'refresh-legacy-icons',
  title: 'Legacy icons',
  skills: [
    { id: 'legacy-react', name: 'React', iconIdentifier: 'lucide:Code2' },
    { id: 'legacy-vscode', name: 'VS Code', iconIdentifier: 'lucide:Code2' },
  ],
}]) as Array<Record<string, unknown>>;
const refreshedSkills = refreshedLegacyIcons[0].skills as Array<Record<string, unknown>>;
assert.equal(refreshedSkills[0].iconIdentifier, 'simple:react');
assert.equal(refreshedSkills[1].iconIdentifier, 'custom:vscode');
assert.equal(validateSkillCategories(refreshedLegacyIcons), null);
assert.equal(getCategoryIconIdentifier('Security'), 'ShieldCheck');
assert.equal(getCategoryIconIdentifier('A custom category'), 'Code2');

const categoriesWithInactiveItems = normalizeSkillCategories([
  {
    id: 'active-category',
    title: 'Frontend',
    icon: 'Monitor',
    active: true,
    skills: [
      { id: 'active-skill', name: 'React', active: true },
      { id: 'inactive-skill', name: 'Vue', active: false },
    ],
  },
  {
    id: 'inactive-category',
    title: 'Hidden',
    icon: 'Code2',
    active: false,
    skills: [{ id: 'hidden-skill', name: 'Python', active: true }],
  },
]);
const publicCategories = getPublicSkillCategories(categoriesWithInactiveItems) as Array<Record<string, unknown>>;
assert.equal(publicCategories.length, 1);
assert.deepEqual((publicCategories[0].skills as Array<Record<string, unknown>>).map((skill) => skill.name), ['React']);

const duplicateCategories = normalizeSkillCategories([
  { id: 'one', title: 'Frontend', skills: [] },
  { id: 'two', title: 'frontend', skills: [] },
]);
assert.match(validateSkillCategories(duplicateCategories) || '', /already exists/);

const invalidReference = normalizeSkillCategories([
  { id: 'category', title: 'Frontend', skills: [{ id: 'skill', name: 'React', categoryId: 'wrong' }] },
]) as Array<Record<string, unknown>>;
(invalidReference[0].skills as Array<Record<string, unknown>>)[0].categoryId = 'wrong';
assert.notEqual(validateSkillCategories(invalidReference), null);

console.log('Skills catalog migration and validation tests passed.');
