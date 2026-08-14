import type { Project, Chapter } from '../services/types';

export const exportNovelToHTML = (project: Project, chapters: Chapter[]) => {
  const sortedChapters = [...chapters].sort((a, b) => a.position - b.position);
  
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.title}</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1.title {
      font-size: 3em;
      text-align: center;
      margin-bottom: 0.5em;
    }
    h2.author {
      font-size: 1.5em;
      text-align: center;
      color: #666;
      margin-bottom: 4em;
    }
    h1.chapter-title {
      font-size: 2em;
      margin-top: 3em;
      margin-bottom: 1.5em;
      text-align: center;
      page-break-before: always;
    }
    p {
      text-indent: 1.5em;
      margin-bottom: 0;
      margin-top: 0;
    }
    p.no-indent {
      text-indent: 0;
    }
    .mention {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1 class="title">${project.title}</h1>
  <h2 class="author">By ${project.author_name || 'Unknown Author'}</h2>
`;

  sortedChapters.forEach((chapter, index) => {
    html += `
  <h1 class="chapter-title">Chapter ${index + 1}: ${chapter.title}</h1>
  <div class="chapter-content">
    ${chapter.content}
  </div>
`;
  });

  html += `
</body>
</html>
`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
