import assert from 'node:assert/strict';
import test from 'node:test';
import type { FileItem } from '../types';
import {
  buildVirtualDDriveFiles,
  D_DRIVE_FOLDER_PATHS,
  getLegacyDDriveChildren,
  isCanonicalCameraCapture,
  isCanonicalDDrivePath,
  isCanonicalDDriveFolderPath,
  isLegacyDDrivePath,
  normalizeVfsDestinationPath,
  normalizeVirtualDriveFiles,
} from './virtualDDrive';

const createFile = (
  id: string,
  name: string,
  path: string,
  parentId: string,
  extension: string,
  content = 'file-content'
): FileItem => ({
  id,
  name,
  path,
  parentId,
  type: 'file',
  extension,
  content,
  modified: '2026-10-19',
});

test('virtual D: layout includes every required folder with the correct parent', () => {
  const files = buildVirtualDDriveFiles([], null);
  const folders = files.filter((file) => file.type === 'folder');
  const expected = [
    [D_DRIVE_FOLDER_PATHS.desktop, 'D:'],
    [D_DRIVE_FOLDER_PATHS.downloads, 'D:'],
    [D_DRIVE_FOLDER_PATHS.documents, 'D:'],
    [D_DRIVE_FOLDER_PATHS.resumes, D_DRIVE_FOLDER_PATHS.documents],
    [D_DRIVE_FOLDER_PATHS.pictures, 'D:'],
    [D_DRIVE_FOLDER_PATHS.wallpapers, D_DRIVE_FOLDER_PATHS.pictures],
    [D_DRIVE_FOLDER_PATHS.photoCaptures, D_DRIVE_FOLDER_PATHS.pictures],
    [D_DRIVE_FOLDER_PATHS.videos, 'D:'],
    [D_DRIVE_FOLDER_PATHS.videoCaptures, D_DRIVE_FOLDER_PATHS.videos],
    [D_DRIVE_FOLDER_PATHS.audio, 'D:'],
    [D_DRIVE_FOLDER_PATHS.projects, 'D:'],
    [D_DRIVE_FOLDER_PATHS.certificates, 'D:'],
    [D_DRIVE_FOLDER_PATHS.aboutMe, 'D:'],
  ];

  for (const [path, parentId] of expected) {
    assert.ok(folders.some((folder) => folder.path === path && folder.parentId === parentId), path);
  }
  assert.equal(folders.filter((folder) => folder.path === D_DRIVE_FOLDER_PATHS.videos).length, 1);
  assert.ok(!folders.some((folder) => folder.path === `${D_DRIVE_FOLDER_PATHS.videos}/Videos`));
  assert.ok(files.some((file) => file.path === `${D_DRIVE_FOLDER_PATHS.aboutMe}/About Me.lnk` && file.content === 'app:about'));
  assert.equal(isCanonicalDDriveFolderPath(`${D_DRIVE_FOLDER_PATHS.downloads}/Nested`), true);
  assert.equal(isCanonicalDDrivePath(`${D_DRIVE_FOLDER_PATHS.downloads}/Nested/file.txt`), true);
});

test('D: includes photo wallpapers alongside the existing themed wallpapers and media collections', () => {
  const publicMedia = {
    wallpapers: [
      'Cloud_Architecture.png', 'Data_Flow.png', 'Developer_Network.png', 'Gaming_Arena.jpg',
      'Landscape_Mountain_Lake.jpg', 'Midnight_Sports_Car.jpg', 'Mountain_Lake_Landscape.jpg',
      'Neural_Code.png', 'Performance_Car.jpg', 'Road_Bike.jpg', 'Sports_Action.jpg',
      'Stadium_Night.jpg', 'Superbike_Sunset.jpg',
    ].map((name) => ({ name, url: `/wallpapers/${encodeURIComponent(name)}` })),
    videos: [
      'React_Debug_Walkthrough.mp4', 'Software_Engineering_Overview.mp4',
    ].map((name) => ({ name, url: `/videos/${encodeURIComponent(name)}` })),
    audio: [
      'Circuit_Flow.wav', 'Code_Focus.wav', 'Digital_Sunrise.wav',
    ].map((name) => ({ name, url: `/audio/${encodeURIComponent(name)}` })),
    downloads: [
      'Windows11.jpg', 'Windows_11.jpg', 'resume.pdf',
    ].map((name) => ({ name, url: `/downloads/${encodeURIComponent(name)}` })),
  };
  const files = buildVirtualDDriveFiles([], null, [], publicMedia);
  const wallpapers = files.filter((file) => file.parentId === D_DRIVE_FOLDER_PATHS.wallpapers && file.type === 'file');
  const videos = files.filter((file) => file.parentId === D_DRIVE_FOLDER_PATHS.videos && file.type === 'file');
  const audio = files.filter((file) => file.parentId === D_DRIVE_FOLDER_PATHS.audio && file.type === 'file');

  assert.equal(wallpapers.length, 5);
  assert.ok(wallpapers.every((file) => file.readOnly && file.content?.startsWith('/')));
  assert.ok(wallpapers.every((file) => ['jpg', 'png'].includes(file.extension || '')));
  assert.ok(!wallpapers.some((file) => file.extension === 'svg'));
  for (const name of [
    'Gaming_Arena.jpg',
    'Landscape_Mountain_Lake.jpg',
    'Performance_Car.jpg',
    'Road_Bike.jpg',
    'Sports_Action.jpg',
  ]) {
    assert.ok(wallpapers.some((file) => file.name === name && file.content === `/wallpapers/${name}`));
  }
  for (const name of [
    'Cloud_Architecture.png',
    'Data_Flow.png',
    'Developer_Network.png',
    'Midnight_Sports_Car.jpg',
    'Mountain_Lake_Landscape.jpg',
    'Neural_Code.png',
    'Stadium_Night.jpg',
    'Superbike_Sunset.jpg',
  ]) {
    assert.ok(!wallpapers.some((file) => file.name === name));
  }
  assert.equal(videos.length, 2);
  assert.ok(videos.every((file) => file.extension === 'mp4' && file.content?.startsWith('/videos/')));
  assert.equal(audio.length, 3);
  assert.ok(audio.every((file) => file.extension === 'wav' && file.content?.startsWith('/audio/')));
  const downloads = files.filter((file) => file.parentId === D_DRIVE_FOLDER_PATHS.downloads && file.type === 'file');
  assert.deepEqual(downloads.map((file) => file.name).sort(), ['Windows11.jpg', 'Windows_11.jpg', 'resume.pdf']);
  assert.ok(downloads.every((file) => file.readOnly && file.content?.startsWith('/downloads/')));
});

test('D: keeps an unmarked uploaded wallpaper visible in the Wallpapers folder', () => {
  const files = buildVirtualDDriveFiles([], {
    siteSettings: {
      defaultWallpaperUrl: '/api/portfolio-media/screenshot-wallpaper',
      defaultWallpaperName: 'Screenshot_2024-12-13_171640.png',
    },
  });

  assert.ok(files.some((file) =>
    file.parentId === D_DRIVE_FOLDER_PATHS.wallpapers &&
    file.name === 'Screenshot_2024-12-13_171640.png'
  ));
});

test('Desktop shortcut files track published app availability and admin visibility', () => {
  const files = buildVirtualDDriveFiles([], {
    siteSettings: {
      disabledApps: ['camera', 'photos', 'about'],
      adminAppEnabledInStart: false,
    },
  });
  const shortcuts = files.filter((file) => file.parentId === D_DRIVE_FOLDER_PATHS.desktop && file.extension === 'lnk');

  assert.ok(!shortcuts.some((file) => file.name === 'Camera.lnk'));
  assert.ok(!shortcuts.some((file) => file.name === 'Media.lnk'));
  assert.ok(!shortcuts.some((file) => file.name === 'About Me.lnk'));
  assert.ok(!shortcuts.some((file) => file.name === 'Admin Control Center.lnk'));
  assert.ok(shortcuts.some((file) => file.name === 'Projects.lnk' && file.content === 'app:projects'));

  const adminEnabled = buildVirtualDDriveFiles([], {
    siteSettings: { adminAppEnabledInStart: true },
  });
  assert.ok(adminEnabled.some((file) =>
    file.parentId === D_DRIVE_FOLDER_PATHS.desktop &&
    file.name === 'Admin Control Center.lnk' &&
    file.content === 'app:admin'
  ));
});

test('simulated C: keeps only its root and discards obsolete child entries', () => {
  const sources = [
    { id: 'drive-c', name: 'Local Disk (C:)', path: 'C:', parentId: 'This PC', type: 'folder' as const, modified: '2026-10-19' },
    createFile('obsolete-child', 'old.txt', 'C:/Obsolete/old.txt', 'C:/Obsolete', 'txt'),
  ];

  const normalized = normalizeVirtualDriveFiles(sources);
  assert.deepEqual(normalized.filter((file) => file.path.startsWith('C:')).map((file) => file.path), ['C:']);
  assert.ok(!normalized.some((file) => file.id === 'obsolete-child'));
});

test('new file destinations cannot write back into simulated C:', () => {
  assert.equal(normalizeVfsDestinationPath('C:/Temporary'), D_DRIVE_FOLDER_PATHS.documents);
  assert.equal(normalizeVfsDestinationPath('C:'), D_DRIVE_FOLDER_PATHS.documents);
  assert.equal(normalizeVfsDestinationPath('D:/Projects'), 'D:/Projects');
});

test('Projects contains only generated Markdown references for visible published projects', () => {
  const oldStoredProjectFile = createFile(
    'static-project-file',
    'Aether_AI_Spec.txt',
    `${D_DRIVE_FOLDER_PATHS.projects}/Aether_AI_Spec.txt`,
    D_DRIVE_FOLDER_PATHS.projects,
    'txt',
    'static demo content'
  );
  const files = buildVirtualDDriveFiles([oldStoredProjectFile], null, [
    {
      id: 'visible-project',
      title: 'Portfolio App',
      description: 'A published project.',
      category: 'Full Stack',
      technologies: ['React', 'TypeScript'],
      features: ['Admin-managed visibility'],
      caseStudy: { goal: 'Publish a reliable portfolio.' },
      githubUrl: 'https://github.com/example/portfolio',
      visible: true,
    },
    { id: 'second-project', title: 'Second Project', visible: true },
    { id: 'third-project', title: 'Third Project', visible: true },
    { id: 'hidden-project', title: 'Hidden Project', visible: false },
  ]);

  const projectFiles = files.filter((file) => file.parentId === D_DRIVE_FOLDER_PATHS.projects && file.type === 'file');
  assert.equal(projectFiles.length, 3);
  const portfolioApp = projectFiles.find((file) => file.name === 'Portfolio App.md');
  assert.ok(portfolioApp);
  assert.match(portfolioApp.content || '', /A published project\./);
  assert.match(portfolioApp.content || '', /- React\n- TypeScript/);
  assert.match(portfolioApp.content || '', /Publish a reliable portfolio\./);
  assert.ok(portfolioApp.readOnly);
  assert.ok(!projectFiles.some((file) => file.name === 'Hidden Project.md'));
});

test('published resumes, named wallpaper, and certificates appear as read-only references', () => {
  const publishedContent = {
    profile: { resumeUrl: '/api/portfolio-media/legacy-resume' },
    resumes: [
      { id: 'active-resume', title: 'Current Resume', file: '/api/portfolio-media/resume-1', active: true },
      { id: 'inactive-resume', title: 'Old Resume', file: '/api/portfolio-media/resume-2', active: false },
    ],
    siteSettings: {
      defaultWallpaperUrl: '/api/portfolio-media/wallpaper-1',
      defaultWallpaperName: 'My Aurora Wallpaper.png',
    },
    certifications: [
      { id: 'cert-image', title: 'First Certificate', image: '/api/portfolio-media/certificate-1' },
      { id: 'cert-pdf', title: 'Second Certificate', documentUrl: '/api/portfolio-media/certificate-2.pdf' },
    ],
  };
  const files = buildVirtualDDriveFiles([], publishedContent);

  assert.ok(files.some((file) =>
    file.path === `${D_DRIVE_FOLDER_PATHS.resumes}/Current Resume.pdf` &&
    file.content === '/api/portfolio-media/resume-1' &&
    file.readOnly
  ));
  assert.ok(!files.some((file) => file.name === 'Old Resume.pdf'));
  assert.ok(files.some((file) =>
    file.name === 'My Aurora Wallpaper.png' &&
    file.parentId === D_DRIVE_FOLDER_PATHS.wallpapers &&
    file.content === '/api/portfolio-media/wallpaper-1' &&
    file.readOnly
  ));
  assert.ok(files.some((file) =>
    file.name === 'First Certificate.png' &&
    file.parentId === D_DRIVE_FOLDER_PATHS.certificates &&
    file.readOnly
  ));
  assert.ok(files.some((file) =>
    file.name === 'Second Certificate.pdf' &&
    file.parentId === D_DRIVE_FOLDER_PATHS.certificates &&
    file.readOnly
  ));
  const deletedResumes = buildVirtualDDriveFiles([], {
    profile: { resumeUrl: '/api/portfolio-media/legacy-resume' },
    resumes: [],
  });
  assert.ok(!deletedResumes.some((file) => file.parentId === D_DRIVE_FOLDER_PATHS.resumes && file.type === 'file'));
});

test('marked Documents demo files are discarded without deleting the Resumes folder', () => {
  const demoNames = [
    'About_Anish_Jethva.txt',
    'Alex_Rivera_Resume.pdf',
    'Anish_Jethva_Resume.pdf',
    'Career_Goals_2026.txt',
    'Technical_Portfolio_A.pdf',
  ];
  const files = [
    ...demoNames.map((name, index) => createFile(
      `demo-${index}`,
      name,
      `${D_DRIVE_FOLDER_PATHS.documents}/${name}`,
      D_DRIVE_FOLDER_PATHS.documents,
      name.split('.').pop() || 'txt'
    )),
    createFile(
      'real-resume',
      'Published Resume.pdf',
      `${D_DRIVE_FOLDER_PATHS.resumes}/Published Resume.pdf`,
      D_DRIVE_FOLDER_PATHS.resumes,
      'pdf'
    ),
  ];

  const normalized = normalizeVirtualDriveFiles(files);
  assert.ok(!normalized.some((file) => demoNames.includes(file.name)));
  assert.ok(normalized.some((file) => file.path === D_DRIVE_FOLDER_PATHS.resumes));
  assert.ok(normalized.some((file) => file.id === 'real-resume'));
});

test('obsolete D:/Videos/Videos folder is removed and nested files stay available in D:/Videos', () => {
  const obsoleteFolder = {
    id: 'obsolete-videos-folder',
    name: 'Videos',
    path: 'D:/Videos/Videos',
    parentId: D_DRIVE_FOLDER_PATHS.videos,
    type: 'folder' as const,
    modified: '2026-10-19',
  };
  const nestedVideo = createFile(
    'nested-video',
    'walkthrough.mp4',
    'D:/Videos/Videos/walkthrough.mp4',
    'D:/Videos/Videos',
    'mp4'
  );

  const migrated = normalizeVirtualDriveFiles([obsoleteFolder, nestedVideo]);
  assert.ok(!migrated.some((file) => file.path === 'D:/Videos/Videos'));
  assert.ok(migrated.some((file) =>
    file.id === nestedVideo.id &&
    file.path === 'D:/Videos/walkthrough.mp4' &&
    file.parentId === D_DRIVE_FOLDER_PATHS.videos &&
    !file.legacyDHidden
  ));

  const projected = buildVirtualDDriveFiles([obsoleteFolder, nestedVideo], null);
  assert.ok(!projected.some((file) => file.path === 'D:/Videos/Videos'));
  assert.ok(projected.some((file) =>
    file.name === 'walkthrough.mp4' &&
    file.path === 'D:/Videos/walkthrough.mp4' &&
    file.parentId === D_DRIVE_FOLDER_PATHS.videos
  ));
});

test('camera captures, audio, certificates, and About Me documents are referenced without modifying source records', () => {
  const sources = [
    createFile('photo-1', 'Photo_20261019_103927.jpg', `${D_DRIVE_FOLDER_PATHS.photoCaptures}/Photo_20261019_103927.jpg`, D_DRIVE_FOLDER_PATHS.photoCaptures, 'jpg'),
    createFile('video-1', 'Video_20261019_103927.mp4', `${D_DRIVE_FOLDER_PATHS.videoCaptures}/Video_20261019_103927.mp4`, D_DRIVE_FOLDER_PATHS.videoCaptures, 'mp4'),
    createFile('audio-1', 'sample.mp3', `${D_DRIVE_FOLDER_PATHS.audio}/sample.mp3`, D_DRIVE_FOLDER_PATHS.audio, 'mp3'),
    createFile('certificate-1', 'award.pdf', `${D_DRIVE_FOLDER_PATHS.certificates}/award.pdf`, D_DRIVE_FOLDER_PATHS.certificates, 'pdf'),
    createFile('about-1', 'bio.txt', `${D_DRIVE_FOLDER_PATHS.aboutMe}/bio.txt`, D_DRIVE_FOLDER_PATHS.aboutMe, 'txt'),
  ];
  const originalSources = structuredClone(sources);
  const files = buildVirtualDDriveFiles(sources, null);

  assert.ok(files.some((file) => file.parentId === D_DRIVE_FOLDER_PATHS.photoCaptures && file.name === sources[0].name && !file.readOnly));
  assert.ok(files.some((file) => file.parentId === D_DRIVE_FOLDER_PATHS.videoCaptures && file.name === sources[1].name && !file.readOnly));
  assert.ok(files.some((file) => file.parentId === D_DRIVE_FOLDER_PATHS.audio && file.name === 'sample.mp3' && !file.readOnly));
  assert.ok(files.some((file) => file.parentId === D_DRIVE_FOLDER_PATHS.certificates && file.name === 'award.pdf' && !file.readOnly));
  assert.ok(files.some((file) => file.parentId === D_DRIVE_FOLDER_PATHS.aboutMe && file.name === 'bio.txt' && !file.readOnly));
  assert.deepEqual(sources, originalSources);
});

test('legacy D: entries stay stored but hidden while new canonical D: files remain visible', () => {
  const legacyFolder = {
    id: 'legacy-folder',
    name: 'Old Folder',
    path: 'D:/Old Folder',
    parentId: 'D:',
    type: 'folder' as const,
    modified: '2026-10-19',
  };
  const legacyFile = createFile('legacy-file', 'old.txt', 'D:/Old Folder/old.txt', 'D:/Old Folder', 'txt');
  const canonicalFile = createFile('canonical-file', 'legacy.jpg', 'D:/Pictures/legacy.jpg', 'D:/Pictures', 'jpg');
  const stored = [legacyFolder, legacyFile, canonicalFile];
  const visible = buildVirtualDDriveFiles(stored, null);

  assert.ok(!visible.some((file) => file.id === legacyFolder.id || file.id === legacyFile.id));
  assert.ok(visible.some((file) => file.id === canonicalFile.id && !file.readOnly));
  const migratedLegacy = normalizeVirtualDriveFiles(stored, true, true);
  assert.ok(
    stored.every((source) => migratedLegacy.find((file) => file.id === source.id)?.legacyDHidden)
  );
  assert.deepEqual(
    migratedLegacy.filter((file) => stored.some((source) => source.id === file.id))
      .map(({ id, path }) => ({ id, path })),
    stored.map(({ id, path }) => ({ id, path }))
  );
  const hiddenLegacyView = buildVirtualDDriveFiles(migratedLegacy, null);
  assert.ok(!hiddenLegacyView.some((file) =>
    file.id === legacyFolder.id || file.id === legacyFile.id || file.id === canonicalFile.id
  ));
  assert.deepEqual(getLegacyDDriveChildren(stored, 'D:/Old Folder').map((file) => ({
    id: file.id,
    path: file.path,
    readOnly: file.readOnly,
  })), [{ id: 'legacy-file', path: 'D:/Old Folder/old.txt', readOnly: true }]);
  assert.equal(getLegacyDDriveChildren(migratedLegacy, 'D:/Old Folder').length, 0);
  assert.deepEqual(stored, [legacyFolder, legacyFile, canonicalFile]);
  assert.equal(getLegacyDDriveChildren(stored, D_DRIVE_FOLDER_PATHS.pictures).length, 0);
  assert.equal(isCanonicalDDriveFolderPath(D_DRIVE_FOLDER_PATHS.pictures), true);
  assert.equal(isLegacyDDrivePath('D:/Old Folder/old.txt'), true);
});

test('new camera capture names are recognized only in the two canonical camera folders', () => {
  const photo = createFile(
    'd-photo',
    'Photo_20261019_103927.jpg',
    `${D_DRIVE_FOLDER_PATHS.photoCaptures}/Photo_20261019_103927.jpg`,
    D_DRIVE_FOLDER_PATHS.photoCaptures,
    'jpg'
  );
  const unrelated = { ...photo, path: 'D:/Pictures/Photo_20261019_103927.jpg', parentId: D_DRIVE_FOLDER_PATHS.pictures };

  assert.equal(isCanonicalCameraCapture(photo), true);
  assert.equal(isCanonicalCameraCapture(unrelated), false);
});
